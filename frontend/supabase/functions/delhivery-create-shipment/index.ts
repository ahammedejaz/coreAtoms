// supabase/functions/delhivery-create-shipment/index.ts
//
// Creates a shipment on Delhivery and assigns a waybill.
// Called from the Admin Dashboard when admin clicks "Ship Order".
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   DELHIVERY_API_TOKEN   — Your Delhivery API token (staging or production)
//   DELHIVERY_BASE_URL    — https://staging-express.delhivery.com (staging)
//                           https://track.delhivery.com (production)
//   DELHIVERY_CLIENT_NAME — Your Delhivery client name
//
// Supabase connection (auto-available in edge functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Request body: {
//   order_id: string (UUID),
//   shipping_address: { name, phone, address, city, state, pin, country },
//   items: [{ name, qty, price }],
//   total_amount: number,
//   payment_method: "cod" | "prepaid",
//   weight: number (in grams)
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        const CLIENT_NAME = Deno.env.get("DELHIVERY_CLIENT_NAME");

        if (!DELHIVERY_TOKEN || !CLIENT_NAME) {
            return new Response(
                JSON.stringify({ error: "Delhivery credentials not configured" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Parse request ──
        const {
            order_id,
            shipping_address,
            items,
            total_amount,
            payment_method,
            weight,
        } = await req.json();

        if (!order_id || !shipping_address) {
            return new Response(
                JSON.stringify({ error: "order_id and shipping_address are required" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Step 1: Fetch a waybill from Delhivery ──
        const wbRes = await fetch(
            `${DELHIVERY_BASE}/waybill/api/fetch/json/?cl=${encodeURIComponent(CLIENT_NAME)}&count=1`,
            {
                headers: {
                    Authorization: `Token ${DELHIVERY_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!wbRes.ok) {
            const errText = await wbRes.text();
            console.error("Waybill fetch error:", errText);
            return new Response(
                JSON.stringify({ error: `Waybill fetch failed: ${errText}` }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const wbData = await wbRes.json();
        // Delhivery may return:
        //   - a plain string: "51064810000011"
        //   - an object: { waybill: "..." }
        //   - an array: ["..."]
        const waybill =
            typeof wbData === "string"
                ? wbData
                : typeof wbData === "number"
                    ? String(wbData)
                    : wbData.waybill || (Array.isArray(wbData) && wbData[0]) || (wbData.json && wbData.json[0]);

        if (!waybill) {
            return new Response(
                JSON.stringify({
                    error: "No waybill returned from Delhivery",
                    raw: wbData,
                }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Step 2: Create shipment with the waybill ──
        const addr = shipping_address;
        const isCOD = (payment_method || "").toLowerCase() === "cod";

        const shipmentPayload = {
            shipments: [
                {
                    name: addr.name || "Customer",
                    add: addr.address || "",
                    pin: addr.pin || addr.pincode || "",
                    city: addr.city || "",
                    state: addr.state || "",
                    country: addr.country || "India",
                    phone: addr.phone || "",
                    order: order_id,
                    payment_mode: isCOD ? "COD" : "Prepaid",
                    return_pin: "",
                    return_city: "",
                    return_phone: "",
                    return_add: "",
                    return_state: "",
                    return_country: "",
                    products_desc: (items || [])
                        .map((i: { name: string }) => i.name)
                        .join(", "),
                    hsn_code: "",
                    cod_amount: isCOD ? String(total_amount || 0) : "0",
                    order_date: new Date().toISOString(),
                    total_amount: String(total_amount || 0),
                    seller_add: "",
                    seller_name: "",
                    seller_inv: "",
                    quantity: String(
                        (items || []).reduce(
                            (sum: number, i: { qty: number }) => sum + (i.qty || 1),
                            0
                        )
                    ),
                    waybill: waybill,
                    shipment_width: "10",
                    shipment_height: "10",
                    weight: String(weight || 500), // grams
                    seller_gst_tin: "",
                    shipping_mode: "Surface",
                    address_type: "home",
                },
            ],
            pickup_location: {
                name: CLIENT_NAME,
            },
        };

        const createBody = `format=json&data=${JSON.stringify(shipmentPayload)}`;

        const createRes = await fetch(`${DELHIVERY_BASE}/api/cmu/create.json`, {
            method: "POST",
            headers: {
                Authorization: `Token ${DELHIVERY_TOKEN}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: createBody,
        });

        const createData = await createRes.json();

        if (!createRes.ok) {
            console.error("Shipment creation error:", createData);
            return new Response(
                JSON.stringify({
                    error: "Shipment creation failed",
                    details: createData,
                }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Check if Delhivery returned success
        const pkg = createData?.packages?.[0] || {};
        const success = pkg.status === "Success" || createData.success;

        // If Delhivery rejected the shipment, do NOT update the DB
        if (!success) {
            const remarks = (pkg.remarks || []).join("; ") || "Unknown error";
            console.error("Delhivery shipment rejected:", remarks, createData);
            return new Response(
                JSON.stringify({
                    error: `Delhivery rejected shipment: ${remarks}`,
                    details: createData,
                }),
                {
                    status: 422,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Step 3: Update the order in Supabase ──
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const trackingUrl = `https://www.delhivery.com/track/package/${waybill}`;

        const { error: dbError } = await supabase
            .from("orders")
            .update({
                delhivery_waybill: waybill,
                courier_name: "Delhivery",
                tracking_url: trackingUrl,
                shipped_at: new Date().toISOString(),
                status: "shipped",
            })
            .eq("id", order_id);

        if (dbError) {
            console.error("DB update error:", dbError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                waybill,
                tracking_url: trackingUrl,
                delhivery_response: createData,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
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
