/**
 * verify-razorpay-payment/index.ts — Supabase Edge Function (Deno)
 *
 * Verifies a Razorpay payment signature and, if valid, creates the order
 * in the database by calling the `place_order_prepaid` RPC.
 *
 * Environment secrets required:
 *   RAZORPAY_KEY_SECRET          — used to verify HMAC SHA256 signature
 *   SUPABASE_URL                 — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — admin key (bypasses RLS for order creation)
 *
 * Expected POST body:
 * {
 *   razorpay_order_id    : string   — from Razorpay
 *   razorpay_payment_id  : string   — from Razorpay
 *   razorpay_signature   : string   — HMAC to verify
 *   user_id              : string   — Supabase user UUID
 *   address              : object   — shipping address snapshot
 *   items                : array    — [{product_id, variant_id, qty, unit_price_inr, ...}]
 *   coins_used           : number   — CoreCoins redeemed (0 if none)
 *   shipping             : number   — shipping amount in INR
 *   gst                  : number   — GST amount in INR
 * }
 *
 * Returns:
 *   200 { success: true, order_id }
 *   400 { error: 'Invalid signature' }
 *   500 { error: message }
 *
 * Note: The calling client (Checkout.jsx) should call `log_failed_order` RPC
 * if this function returns an error, to ensure the failed attempt is recorded.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);

    try {
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!RAZORPAY_KEY_SECRET) {
            return new Response(
                JSON.stringify({ error: "Razorpay secret not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }


        // ── 0. JWT user_id verification ────────────────────────────────────────
        // "Verify JWT" is enabled at the gateway — the token is already validated.
        // We just decode the payload to extract the sub (user ID) claim.
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        const token = authHeader.replace('Bearer ', '');
        let callerUserId: string;
        try {
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64));
            callerUserId = payload.sub;
            if (!callerUserId) throw new Error('No sub in JWT');
        } catch {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: could not decode token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        // ───────────────────────────────────────────────────────────────────────

        const body = await req.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            user_id,
            address,
            items,
            coins_used,
            shipping,
            gst,
        } = body;

        // Verify the claimed user_id in the body matches the JWT's sub
        if (!user_id || user_id !== callerUserId) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: user_id mismatch' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 1. Verify the payment signature using Web Crypto API
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

        if (expectedSignature !== razorpay_signature) {
            console.error("Signature mismatch!", { expectedSignature, razorpay_signature });
            return new Response(
                JSON.stringify({ error: "Payment verification failed — invalid signature" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Signature valid — create the order in Supabase
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

        // Use the same RPC as COD but with prepaid payment details
        const { data, error } = await supabase.rpc("place_order_prepaid", {
            p_user_id: user_id,
            p_address: address,
            p_items: items,
            p_payment_method: "prepaid",
            p_razorpay_payment_id: razorpay_payment_id,
            p_razorpay_order_id: razorpay_order_id,
            p_coins_used: coins_used || 0,
            p_shipping: shipping || 0,
            p_gst: gst || 0,
            p_discount: (body.discount || 0),
            p_coupon_code: body.coupon_code || null,
        });

        if (error) {
            console.error("Order creation error:", error);
            return new Response(
                JSON.stringify({ error: `Order creation failed: ${error.message}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, order: data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
