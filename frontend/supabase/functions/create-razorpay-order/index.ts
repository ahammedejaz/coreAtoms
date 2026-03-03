// supabase/functions/create-razorpay-order/index.ts
//
// Creates a Razorpay order via their API.
// The frontend calls this Edge Function before opening the payment popup.
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//
// Request body: { amount: number (in paise), receipt: string }
// Response:     { id: string, amount: number, currency: string }

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);

    try {
        const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            return new Response(
                JSON.stringify({ error: "Razorpay keys not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { amount, receipt } = await req.json();

        if (!amount || amount <= 0) {
            return new Response(
                JSON.stringify({ error: "Invalid amount" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create Razorpay order via their API
        const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({
                amount: Math.round(amount), // amount in paise
                currency: "INR",
                receipt: receipt || `rcpt_${Date.now()}`,
            }),
        });

        if (!rzpResponse.ok) {
            const errText = await rzpResponse.text();
            console.error("Razorpay API error:", errText, "Amount sent:", Math.round(amount));
            return new Response(
                JSON.stringify({ error: `Razorpay error: ${errText}` }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const rzpOrder = await rzpResponse.json();

        return new Response(
            JSON.stringify({
                id: rzpOrder.id,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
            }),
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
