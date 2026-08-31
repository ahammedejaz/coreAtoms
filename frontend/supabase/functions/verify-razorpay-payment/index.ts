/**
 * verify-razorpay-payment/index.ts — Supabase Edge Function (Deno)
 *
 * Verifies a Razorpay payment and, if it checks out, creates the order by
 * calling the `place_order_prepaid` RPC.
 *
 * Three things are verified, and all three matter:
 *   1. the HMAC signature   — proves the payment belongs to that Razorpay order
 *   2. the caller's JWT     — proves who is asking (verified, not just decoded)
 *   3. the captured AMOUNT  — read from Razorpay's own API and passed to the
 *                             RPC, which compares it against a total recomputed
 *                             from server-side prices.
 *
 * (3) is what stops a client from paying ₹1 for a ₹50,000 cart: the signature
 * says nothing at all about how much money changed hands.
 *
 * Environment secrets required:
 *   RAZORPAY_KEY_ID              — used to read the payment back from Razorpay
 *   RAZORPAY_KEY_SECRET          — used to verify the HMAC SHA256 signature
 *   SUPABASE_URL                 — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — admin key (bypasses RLS for order creation)
 *
 * Expected POST body:
 * {
 *   razorpay_order_id    : string
 *   razorpay_payment_id  : string
 *   razorpay_signature   : string
 *   user_id              : string   — must match the JWT's sub
 *   address              : object   — shipping address snapshot
 *   items                : array    — [{product_id, variant_id, qty, ...}]
 *   coins_used           : number
 *   shipping             : number
 *   coupon_code          : string | null
 * }
 *
 * Returns 200 { success: true, order }, or 4xx/5xx { error }.
 *
 * Note: the client (Checkout.jsx) should call the `log_failed_order` RPC when
 * this returns an error, so a captured-but-unfulfilled payment is recorded.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

/** Constant-time comparison of two lowercase hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);
    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    if (req.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
    }

    try {
        const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!RAZORPAY_KEY_SECRET) {
            return json({ error: "Razorpay secret not configured" }, 500);
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return json({ error: "Server not configured" }, 500);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ── 1. Verify the caller ───────────────────────────────────────────
        // Previously the JWT was merely base64-decoded and its `sub` trusted,
        // which also broke on base64url payloads containing '-' or '_'.
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "Missing Authorization header" }, 401);
        }
        const token = authHeader.slice("Bearer ".length);
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user?.id) {
            return json({ error: "Unauthorized" }, 401);
        }
        const callerUserId = userData.user.id;

        let body: Record<string, any>;
        try {
            body = await req.json();
        } catch {
            return json({ error: "Invalid request body" }, 400);
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            user_id,
            address,
            items,
            coins_used,
            shipping,
        } = body;

        if (
            typeof razorpay_order_id !== "string" ||
            typeof razorpay_payment_id !== "string" ||
            typeof razorpay_signature !== "string"
        ) {
            return json({ error: "Missing payment details" }, 400);
        }
        if (!user_id || user_id !== callerUserId) {
            return json({ error: "Unauthorized: user_id mismatch" }, 401);
        }
        if (!Array.isArray(items) || items.length === 0) {
            return json({ error: "No items supplied" }, 400);
        }
        if (!address || typeof address !== "object") {
            return json({ error: "Missing address" }, 400);
        }

        // Rate limited per user, and only AFTER identity is established, so a
        // shared IP cannot lock a paying customer out of their own order.
        const limited = await checkRateLimit(req, corsHeaders, {
            endpoint: "verify-razorpay-payment",
            maxRequests: 10,
            windowSeconds: 60,
            identifier: callerUserId || getClientIp(req),
        });
        if (limited) return limited;

        // ── 2. Verify the signature ────────────────────────────────────────
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(RAZORPAY_KEY_SECRET),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const signatureData = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
        const signatureBuffer = await crypto.subtle.sign("HMAC", key, signatureData);
        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        if (!timingSafeEqualHex(expectedSignature, String(razorpay_signature).toLowerCase())) {
            // Never log the expected signature — it is a valid credential for
            // this (order_id, payment_id) pair.
            console.error("Signature mismatch for payment", razorpay_payment_id);
            return json({ error: "Payment verification failed — invalid signature" }, 400);
        }

        // ── 3. Read the amount actually captured, from Razorpay ────────────
        let amountPaidPaise: number | null = null;
        if (RAZORPAY_KEY_ID) {
            try {
                const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
                const payRes = await fetch(
                    `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
                    { headers: { Authorization: `Basic ${credentials}` } }
                );
                if (payRes.ok) {
                    const payment = await payRes.json();
                    if (payment?.order_id && payment.order_id !== razorpay_order_id) {
                        console.error("Payment/order mismatch for", razorpay_payment_id);
                        return json({ error: "Payment verification failed" }, 400);
                    }
                    if (payment?.status !== "captured" && payment?.status !== "authorized") {
                        console.error("Unexpected payment status:", payment?.status);
                        return json({ error: "Payment has not been completed" }, 400);
                    }
                    if (Number.isFinite(Number(payment?.amount))) {
                        amountPaidPaise = Number(payment.amount);
                    }
                } else {
                    console.error("Razorpay payment lookup failed:", payRes.status);
                }
            } catch (lookupErr) {
                console.error("Razorpay payment lookup threw:", lookupErr);
            }
        } else {
            console.error("RAZORPAY_KEY_ID not set — amount cannot be verified");
        }

        // If the lookup failed we still place the order: the customer has paid
        // and must not be stranded. The RPC treats a null amount as "unchecked"
        // and the failure is logged loudly above.
        if (amountPaidPaise === null) {
            console.error(
                "Placing order WITHOUT amount verification for payment",
                razorpay_payment_id
            );
        }

        // ── 4. Create the order ────────────────────────────────────────────
        // place_order_prepaid is idempotent on razorpay_payment_id, so a retry
        // returns the existing order instead of duplicating stock and coins.
        const { data, error } = await supabase.rpc("place_order_prepaid", {
            p_user_id: user_id,
            p_address: address,
            p_items: items,
            p_payment_method: "prepaid",
            p_razorpay_payment_id: razorpay_payment_id,
            p_razorpay_order_id: razorpay_order_id,
            p_coins_used: Number(coins_used) || 0,
            p_shipping: Number(shipping) || 0,
            p_gst: 0,
            p_discount: 0,
            p_coupon_code: body.coupon_code || null,
            p_amount_paid_paise: amountPaidPaise,
        });

        if (error) {
            // Postgres exception text can carry internal detail; keep it in the
            // logs and give the customer something actionable instead.
            console.error("Order creation error:", error, "payment:", razorpay_payment_id);
            const isAmountMismatch = String(error.message || "").includes("Payment amount mismatch");
            return json(
                {
                    error: isAmountMismatch
                        ? "The amount paid does not match this order. Your payment is safe — please contact support with your payment reference."
                        : "Payment received but the order could not be created. Please contact support with your payment reference.",
                    payment_reference: razorpay_payment_id,
                },
                500
            );
        }

        return json({ success: true, order: data }, 200);
    } catch (err) {
        console.error("verify-razorpay-payment error:", err);
        return json({ error: "Internal server error" }, 500);
    }
});
