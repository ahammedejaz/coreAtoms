// supabase/functions/verify-razorpay-payment/index.ts
//
// Verifies a Razorpay payment signature and creates the order in the database.
// This is the secure backend that ensures payment was actually completed before
// creating the order.
//
// Secrets required:
//   RAZORPAY_KEY_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Request body: {
//   razorpay_order_id, razorpay_payment_id, razorpay_signature,
//   user_id, address, items[]
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

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

        const body = await req.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            user_id,
            address,
            items,
        } = body;

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
