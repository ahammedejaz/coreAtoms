// supabase/functions/delhivery-pincode-check/index.ts
//
// Checks if a pincode is serviceable by Delhivery and returns
// estimated delivery days based on zone classification.
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   DELHIVERY_API_TOKEN   — Your Delhivery API token
//   DELHIVERY_BASE_URL    — https://track.delhivery.com (production)
//
// Request body: { pincode: "560034" }
// Response: { serviceable, cod, prepaid, city, state, estimated_days, zone }

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

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

        // Parse pincode from POST body
        const { pincode } = await req.json();

        if (!pincode || !/^\d{6}$/.test(String(pincode))) {
            return new Response(
                JSON.stringify({ error: "Valid 6-digit pincode is required" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Call Delhivery pincode serviceability API
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
        // Metro cities: 3-5 days, Non-metro: 5-7 days, ODA: 7-10 days
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
