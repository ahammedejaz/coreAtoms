// supabase/functions/delhivery-pincode-check/index.ts
//
// Checks if a pincode is serviceable by Delhivery, returns estimated
// delivery days, and calculates the shipping charge for that route.
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   DELHIVERY_API_TOKEN        — Your Delhivery API token
//   DELHIVERY_BASE_URL         — https://track.delhivery.com (production)
//   DELHIVERY_WAREHOUSE_PIN    — Origin warehouse pincode (optional —
//                                  falls back to warehouse_address in app_settings)
//
// Supabase connection (auto-available in edge functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Request body: { pincode: "560034", weight_grams?: 500 }
// Response:     { serviceable, cod, prepaid, city, state_code,
//                 estimated_days, is_metro, is_oda, shipping_charge }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);

    // Rate limit: 15 requests per 60 seconds per IP
    const limited = await checkRateLimit(req, corsHeaders, {
        endpoint: "delhivery-pincode-check",
        maxRequests: 15,
        windowSeconds: 60,
        identifier: getClientIp(req),
    });
    if (limited) return limited;

    try {
        const DELHIVERY_TOKEN = Deno.env.get("DELHIVERY_API_TOKEN");
        const DELHIVERY_BASE = (
            Deno.env.get("DELHIVERY_BASE_URL") ||
            "https://track.delhivery.com"
        ).replace(/\/$/, "");

        if (!DELHIVERY_TOKEN) {
            return new Response(
                JSON.stringify({ error: "Delhivery token not configured" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Parse request body
        const { pincode, weight_grams } = await req.json();
        const weightGrams = Number(weight_grams) || 500; // default 500g

        if (!pincode || !/^\d{6}$/.test(String(pincode))) {
            return new Response(
                JSON.stringify({ error: "Valid 6-digit pincode is required" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ─── 1. Serviceability check ────────────────────────────────────
        const res = await fetch(
            `${DELHIVERY_BASE}/c/api/pin-codes/json/?filter_codes=${pincode}`,
            {
                headers: {
                    Authorization: `Token ${DELHIVERY_TOKEN}`,
                    Accept: "application/json",
                },
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error("Delhivery pincode check error:", errText);
            return new Response(
                JSON.stringify({ error: "Failed to check pincode serviceability" }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const data = await res.json();
        const codes = data?.delivery_codes || [];

        if (codes.length === 0) {
            return new Response(
                JSON.stringify({
                    serviceable: false,
                    pincode: String(pincode),
                    message: "This pincode is not serviceable by Delhivery",
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const info = codes[0]?.postal_code || {};

        // Estimate delivery days based on zone/ODA classification
        const isODA = info.is_oda === "Y";
        const district = (info.district || "").toLowerCase();
        const metroDistricts = [
            "bangalore", "mumbai", "delhi", "chennai", "hyderabad",
            "kolkata", "pune", "ahmedabad", "gurugram", "noida",
            "gurgaon", "new delhi", "thane", "navi mumbai",
        ];
        const isMetro = metroDistricts.some((m) => district.includes(m));

        let estimatedDays: string;
        if (isODA) {
            estimatedDays = "7–10";
        } else if (isMetro) {
            estimatedDays = "3–5";
        } else {
            estimatedDays = "5–7";
        }

        // ─── 2. Freight / shipping charge calculation ───────────────────
        // Get origin pincode: prefer secret, fall back to warehouse_address in DB
        let originPin = Deno.env.get("DELHIVERY_WAREHOUSE_PIN") || "";

        if (!originPin) {
            try {
                const sbUrl = Deno.env.get("SUPABASE_URL")!;
                const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                const sb = createClient(sbUrl, sbKey);
                const { data: warehouseRow } = await sb
                    .from("app_settings")
                    .select("value")
                    .eq("key", "warehouse_address")
                    .maybeSingle();
                originPin = String(warehouseRow?.value?.pin || "").trim();
            } catch (e) {
                console.warn("Could not read warehouse_address from DB:", e);
            }
        }

        let shippingChargePrepaid: number | null = null;
        let shippingChargeCod: number | null = null;

        if (originPin && /^\d{6}$/.test(originPin)) {
            try {
                const baseChargeUrl =
                    `${DELHIVERY_BASE}/api/kinko/v1/invoice/charges/.json` +
                    `?cgm=${weightGrams}&o_pin=${originPin}&d_pin=${pincode}&ss=Delivered`;

                // Fetch prepaid and COD rates in parallel
                // md=E = Express mode, pt=COD = payment type Cash on Delivery (adds COD surcharge)
                const [prepaidRes, codRes] = await Promise.all([
                    fetch(`${baseChargeUrl}&md=E`, {
                        headers: {
                            Authorization: `Token ${DELHIVERY_TOKEN}`,
                            Accept: "application/json",
                        },
                    }),
                    fetch(`${baseChargeUrl}&md=E&pt=COD`, {
                        headers: {
                            Authorization: `Token ${DELHIVERY_TOKEN}`,
                            Accept: "application/json",
                        },
                    }),
                ]);

                if (prepaidRes.ok) {
                    const prepaidData = await prepaidRes.json();
                    const total = prepaidData?.[0]?.total_amount;
                    if (total !== undefined && total !== null) {
                        shippingChargePrepaid = Math.ceil(Number(total));
                    }
                } else {
                    console.warn(
                        "Delhivery prepaid freight API returned",
                        prepaidRes.status,
                        await prepaidRes.text()
                    );
                }

                if (codRes.ok) {
                    const codData = await codRes.json();
                    const total = codData?.[0]?.total_amount;
                    if (total !== undefined && total !== null) {
                        shippingChargeCod = Math.ceil(Number(total));
                    }
                } else {
                    console.warn(
                        "Delhivery COD freight API returned",
                        codRes.status,
                        await codRes.text()
                    );
                }
            } catch (e) {
                console.warn("Freight charge calculation failed:", e);
            }
        }

        // ─── 3. Return combined result ──────────────────────────────────
        const result = {
            serviceable: true,
            pincode: String(pincode),
            cod: info.cod === "Y",
            prepaid: info.pre_paid === "Y",
            city: info.district || "",
            state_code: info.state_code || "",
            estimated_days: estimatedDays,
            is_metro: isMetro,
            is_oda: isODA,
            shipping_charge: shippingChargePrepaid, // backward compat: prepaid rate
            shipping_charge_prepaid: shippingChargePrepaid,
            shipping_charge_cod: shippingChargeCod,
        };

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Error:", err);
        return new Response(
            JSON.stringify({ error: (err as Error).message || "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
