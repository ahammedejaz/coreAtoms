// supabase/functions/delhivery-create-shipment/index.ts
//
// Creates a shipment on Delhivery and assigns a waybill.
// Supports all Delhivery payment modes:
//   - "Prepaid" / "COD"  — Forward shipment (warehouse → customer)
//   - "Pickup"           — Reverse pickup  (customer → warehouse)
//   - "REPL"             — Replacement exchange (single waybill, pickup + delivery)
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   DELHIVERY_API_TOKEN       — Your Delhivery API token
//   DELHIVERY_BASE_URL        — https://staging-express.delhivery.com (staging)
//                                https://track.delhivery.com (production)
//   DELHIVERY_CLIENT_NAME     — Your Delhivery client name
//   DELHIVERY_PICKUP_NAME     — Pickup location name (optional, defaults to client name)
//   DELHIVERY_WAREHOUSE_NAME  — Warehouse contact name
//   DELHIVERY_WAREHOUSE_PHONE — Warehouse phone number
//   DELHIVERY_WAREHOUSE_ADD   — Warehouse street address
//   DELHIVERY_WAREHOUSE_CITY  — Warehouse city
//   DELHIVERY_WAREHOUSE_STATE — Warehouse state
//   DELHIVERY_WAREHOUSE_PIN   — Warehouse pincode
//
// Supabase connection (auto-available in edge functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Request body: {
//   order_id: string (UUID),
//   shipping_address: { name, phone, address, city, state, pin, country },
//   items: [{ name, qty, price }],
//   payment_method: "cod" | "prepaid" | "pickup" | "repl",
//   weight: number (in grams),
//   skip_order_update?: boolean  — if true, skip updating the orders table
// }
//
// Amounts are NOT taken from the request body. The COD amount and the declared
// value are read from the `orders` row, because `cod_amount` is how much cash
// the courier collects at the customer's door.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);

    // Rate limit: 10 requests per 60 seconds per IP
    const limited = await checkRateLimit(req, corsHeaders, {
        endpoint: "delhivery-create-shipment",
        maxRequests: 10,
        windowSeconds: 60,
        identifier: getClientIp(req),
    });
    if (limited) return limited;

    try {
        // ── Admin auth check ──
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        // Verify caller is an admin
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const { data: profile } = await adminClient
            .from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profile?.role !== "admin") {
            return new Response(JSON.stringify({ error: "Admin access required" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const DELHIVERY_TOKEN = Deno.env.get("DELHIVERY_API_TOKEN");
        const DELHIVERY_BASE = (
            Deno.env.get("DELHIVERY_BASE_URL") ||
            "https://track.delhivery.com"
        ).replace(/\/$/, "");
        let CLIENT_NAME = Deno.env.get("DELHIVERY_CLIENT_NAME") || "";
        let PICKUP_NAME = Deno.env.get("DELHIVERY_PICKUP_NAME") || "";

        // Fall back to app_settings if env vars aren't set
        if (!CLIENT_NAME || !PICKUP_NAME) {
            try {
                const keys = ["delhivery_client_name", "delhivery_pickup_name"];
                const { data: rows } = await adminClient
                    .from("app_settings").select("key, value").in("key", keys);
                const settingsMap: Record<string, string> = {};
                (rows || []).forEach((r: { key: string; value: string }) => {
                    settingsMap[r.key] = typeof r.value === "string" ? r.value : String(r.value || "");
                });
                if (!CLIENT_NAME) CLIENT_NAME = settingsMap["delhivery_client_name"] || "";
                if (!PICKUP_NAME) PICKUP_NAME = settingsMap["delhivery_pickup_name"] || CLIENT_NAME;
            } catch (e) {
                console.warn("Could not read Delhivery settings from DB:", e);
            }
        }
        if (!PICKUP_NAME) PICKUP_NAME = CLIENT_NAME;

        if (!DELHIVERY_TOKEN || !CLIENT_NAME) {
            return new Response(
                JSON.stringify({ error: "Delhivery credentials not configured. Set DELHIVERY_CLIENT_NAME in Supabase secrets or add 'delhivery_client_name' to app_settings." }),
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
            payment_method,
            weight,
            skip_order_update,
            warehouse,
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

        // ── Load the order ──
        // Money and payment mode come from here, never from the request body.
        // `cod_amount` tells the courier how much cash to collect from the
        // customer; taking that from the caller meant a wrong or tampered
        // number became a real amount collected at the door.
        const { data: order, error: orderErr } = await adminClient
            .from("orders")
            .select("id, status, payment_method, total_amount_inr, delhivery_waybill")
            .eq("id", order_id)
            .maybeSingle();

        if (orderErr || !order) {
            return new Response(
                JSON.stringify({ error: "Order not found" }),
                {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // A forward shipment for an order that already has a waybill is almost
        // always a double-click or a retry. Waybills cost money and a second one
        // orphans the first, so return what the order already has.
        if (!skip_order_update && order.delhivery_waybill) {
            return new Response(
                JSON.stringify({
                    success: true,
                    already_shipped: true,
                    waybill: order.delhivery_waybill,
                    tracking_url: `https://www.delhivery.com/track/package/${order.delhivery_waybill}`,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Build warehouse address (request body takes priority over env vars) ──
        const WAREHOUSE = {
            name: warehouse?.name || Deno.env.get("DELHIVERY_WAREHOUSE_NAME") || "",
            phone: warehouse?.phone || Deno.env.get("DELHIVERY_WAREHOUSE_PHONE") || "",
            address: warehouse?.address || Deno.env.get("DELHIVERY_WAREHOUSE_ADD") || "",
            city: warehouse?.city || Deno.env.get("DELHIVERY_WAREHOUSE_CITY") || "",
            state: warehouse?.state || Deno.env.get("DELHIVERY_WAREHOUSE_STATE") || "",
            pin: warehouse?.pin || Deno.env.get("DELHIVERY_WAREHOUSE_PIN") || "",
            country: "India",
        };

        // ── Determine payment mode ──
        // Supported: "COD", "Prepaid", "Pickup" (reverse), "REPL" (exchange)
        const methodUpper = (payment_method || "prepaid").toUpperCase();
        let paymentMode: string;
        if (methodUpper === "COD") paymentMode = "COD";
        else if (methodUpper === "PICKUP") paymentMode = "Pickup";
        else if (methodUpper === "REPL") paymentMode = "REPL";
        else paymentMode = "Prepaid";

        const isReverse = paymentMode === "Pickup";
        const isREPL = paymentMode === "REPL";

        // Only collect cash if the stored order actually is a COD order. The
        // request asking for COD is not enough — that would let a prepaid order
        // be charged a second time on the doorstep.
        const orderIsCod = String(order.payment_method || "").toLowerCase() === "cod";
        if (paymentMode === "COD" && !orderIsCod) {
            return new Response(
                JSON.stringify({
                    error: "Refusing to create a COD shipment for an order that is not COD",
                }),
                {
                    status: 409,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }
        const isCOD = paymentMode === "COD" && orderIsCod;

        // Authoritative amounts, read from the order rather than the caller.
        const orderTotal = Number(order.total_amount_inr || 0);
        const codAmount = isCOD ? orderTotal : 0;
        // Reverse pickups carry no declared value; everything else declares the
        // order total for insurance and customs paperwork.
        const declaredValue = isReverse ? 0 : orderTotal;

        // For Pickup/REPL, validate warehouse address is configured
        if ((isReverse || isREPL) && !WAREHOUSE.pin) {
            return new Response(
                JSON.stringify({
                    error: "Warehouse address not configured. Set it in Admin Settings → Replacements, or set DELHIVERY_WAREHOUSE_* secrets.",
                }),
                {
                    status: 500,
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

        // ── Step 2: Build shipment payload ──
        const addr = shipping_address;

        // Return address fields (warehouse):
        // - Pickup mode: return_add = warehouse (where picked-up product goes)
        // - REPL mode: return_add = warehouse (final delivery for exchange shipment)
        // - Forward mode: left empty (Delhivery uses registered return address)
        const returnAddr = (isReverse || isREPL)
            ? {
                return_name: WAREHOUSE.name,
                return_phone: WAREHOUSE.phone,
                return_add: WAREHOUSE.address,
                return_city: WAREHOUSE.city,
                return_state: WAREHOUSE.state,
                return_pin: WAREHOUSE.pin,
                return_country: WAREHOUSE.country,
            }
            : {
                return_name: "",
                return_phone: "",
                return_add: "",
                return_city: "",
                return_state: "",
                return_pin: "",
                return_country: "",
            };

        // Order ID must be unique per shipment — append suffix for reverse/replacement
        let shipmentOrderId = order_id;
        if (isReverse) shipmentOrderId = `${order_id}-RVP`;
        else if (isREPL) shipmentOrderId = `${order_id}-REPL`;
        else if (skip_order_update) shipmentOrderId = `${order_id}-REPL-FWD`;

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
                    order: shipmentOrderId,
                    payment_mode: paymentMode,
                    ...returnAddr,
                    products_desc: (items || [])
                        .map((i: { name: string }) => i.name)
                        .join(", "),
                    hsn_code: "",
                    cod_amount: String(codAmount),
                    order_date: new Date().toISOString(),
                    total_amount: String(declaredValue),
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
                    weight: String(weight || 500),
                    seller_gst_tin: "",
                    shipping_mode: "Surface",
                    address_type: "home",
                },
            ],
            pickup_location: {
                name: PICKUP_NAME,
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

        if (!success) {
            // Delhivery may return errors in various fields — collect them all
            const remarksArr = Array.isArray(pkg.remarks) ? pkg.remarks : (pkg.remarks ? [pkg.remarks] : []);
            const rmk = createData.rmk || "";
            const pkgStatus = pkg.status && pkg.status !== "Success" ? pkg.status : "";
            const topError = createData.error || createData.message || "";

            // Build descriptive error from all available info
            const errorParts = [...remarksArr, rmk, pkgStatus, topError]
                .map(s => String(s).trim())
                .filter(Boolean);
            const errorDetail = errorParts.length > 0 ? errorParts.join(" — ") : JSON.stringify(createData);

            console.error("Delhivery shipment rejected:", errorDetail, createData);
            return new Response(
                JSON.stringify({
                    error: `Delhivery rejected shipment: ${errorDetail}`,
                    details: createData,
                }),
                {
                    status: 422,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Step 3: Update the order in Supabase ──
        // Skip for replacement/reverse shipments (skip_order_update=true) to
        // preserve the original order's waybill, tracking URL, and status.
        const trackingUrl = `https://www.delhivery.com/track/package/${waybill}`;

        if (!skip_order_update) {
            // Only advance an order that has not moved past dispatch. The old
            // code set "processing" unconditionally, so re-running it on a
            // delivered order walked its status backwards.
            const advanceable = ["placed", "confirmed"];
            const patch: Record<string, string> = {
                delhivery_waybill: waybill,
                courier_name: "Delhivery",
                tracking_url: trackingUrl,
            };
            if (advanceable.includes(String(order.status))) {
                patch.status = "processing";
            }

            const { error: dbError } = await adminClient
                .from("orders")
                .update(patch)
                .eq("id", order_id);

            if (dbError) {
                // Delhivery has already issued (and billed) this waybill. Losing
                // it here means nobody can track or reconcile the shipment, so
                // fail loudly and hand the waybill back for manual recovery
                // rather than reporting a clean success.
                console.error("DB update error after waybill was issued:", dbError, "waybill:", waybill);
                return new Response(
                    JSON.stringify({
                        error:
                            "Shipment was created at Delhivery but could not be saved to the order. " +
                            "Record this waybill against the order manually.",
                        waybill,
                        tracking_url: trackingUrl,
                        order_id,
                        details: dbError.message,
                    }),
                    {
                        status: 500,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                waybill,
                tracking_url: trackingUrl,
                payment_mode: paymentMode,
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
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
