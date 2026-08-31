// supabase/functions/create-razorpay-order/index.ts
//
// Creates a Razorpay order via their API.
// The frontend calls this Edge Function before opening the payment popup.
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (to verify the caller's JWT)
//
// Request body: { amount: number (in paise), receipt?: string }
// Response:     { id: string, amount: number, currency: string }
//
// The amount is only ever a REQUEST to Razorpay for how much to collect — it is
// not trusted as the order value. `verify-razorpay-payment` reads the amount
// actually captured from Razorpay and hands it to place_order_prepaid, which
// compares it against a total recomputed from server-side prices.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

// ₹1 (Razorpay's minimum) to ₹5,00,000, in paise.
const MIN_AMOUNT_PAISE = 100;
const MAX_AMOUNT_PAISE = 50_000_000;

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

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            return json({ error: "Razorpay keys not configured" }, 500);
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return json({ error: "Server not configured" }, 500);
        }

        // ── Caller identity ────────────────────────────────────────────────
        // This endpoint previously accepted anyone holding the public anon key,
        // so it could be used to mint unlimited orders against the merchant
        // account. The token is verified against the auth server, not decoded.
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "Missing Authorization header" }, 401);
        }
        const token = authHeader.slice("Bearer ".length);
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
        if (userErr || !userData?.user?.id) {
            return json({ error: "Unauthorized" }, 401);
        }
        const userId = userData.user.id;

        // Rate limit per user rather than per IP — an IP is shared behind NAT
        // and, before this change, was spoofable outright.
        const limited = await checkRateLimit(req, corsHeaders, {
            endpoint: "create-razorpay-order",
            maxRequests: 10,
            windowSeconds: 60,
            identifier: userId || getClientIp(req),
        });
        if (limited) return limited;

        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return json({ error: "Invalid request body" }, 400);
        }

        const amount = Number(body?.amount);
        if (!Number.isFinite(amount) || !Number.isInteger(Math.round(amount))) {
            return json({ error: "Invalid amount" }, 400);
        }
        const amountPaise = Math.round(amount);
        if (amountPaise < MIN_AMOUNT_PAISE || amountPaise > MAX_AMOUNT_PAISE) {
            return json({ error: "Amount out of allowed range" }, 400);
        }

        // Razorpay caps receipt at 40 characters.
        const rawReceipt = typeof body?.receipt === "string" ? body.receipt : "";
        const receipt = (rawReceipt || `rcpt_${Date.now()}`).slice(0, 40);

        const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({
                amount: amountPaise,
                currency: "INR",
                receipt,
                // Lets a captured payment be reconciled back to an account
                // later (refunds, webhook recovery).
                notes: { user_id: userId },
            }),
        });

        if (!rzpResponse.ok) {
            const errText = await rzpResponse.text();
            console.error("Razorpay API error:", errText, "amount:", amountPaise);
            return json({ error: "Could not start the payment. Please try again." }, 502);
        }

        const rzpOrder = await rzpResponse.json();

        return json(
            { id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency },
            200
        );
    } catch (err) {
        console.error("create-razorpay-order error:", err);
        return json({ error: "Internal server error" }, 500);
    }
});
