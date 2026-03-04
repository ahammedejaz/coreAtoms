// supabase/functions/delhivery-track/index.ts
//
// Fetches tracking details for a shipment from Delhivery.
// Called from the frontend when a customer clicks "Track Order".
//
// Secrets required (set via Supabase Dashboard → Edge Functions → Secrets):
//   DELHIVERY_API_TOKEN   — Your Delhivery API token
//   DELHIVERY_BASE_URL    — https://staging-express.delhivery.com (staging)
//                           https://track.delhivery.com (production)
//
// Query params: ?waybill=<WAYBILL_NUMBER>
// Response: { tracking data from Delhivery }

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest(req);
    }
    const corsHeaders = getCorsHeaders(req);

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

        // Extract waybill from POST body or query params
        const url = new URL(req.url);
        let waybill = url.searchParams.get("waybill");

        // supabase.functions.invoke() sends POST with JSON body
        if (!waybill && req.method === "POST") {
            try {
                const body = await req.json();
                waybill = body?.waybill || null;
            } catch (_) { }
        }

        if (!waybill) {
            return new Response(
                JSON.stringify({ error: "waybill query parameter is required" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Fetch tracking from Delhivery
        const trackRes = await fetch(
            `${DELHIVERY_BASE}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}&token=${DELHIVERY_TOKEN}`,
            {
                headers: {
                    Accept: "application/json",
                },
            }
        );

        if (!trackRes.ok) {
            const errText = await trackRes.text();
            console.error("Delhivery tracking error:", errText);
            return new Response(
                JSON.stringify({ error: `Tracking fetch failed: ${errText}` }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const trackData = await trackRes.json();

        // Delhivery returns: { ShipmentData: [{ Shipment: { ... } }] }
        const shipment = trackData?.ShipmentData?.[0]?.Shipment;

        if (!shipment) {
            return new Response(
                JSON.stringify({
                    error: "No tracking data found for this waybill",
                    raw: trackData,
                }),
                {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Normalize the tracking scans into a clean timeline
        const scans = (shipment.Scans || []).map(
            (scan: {
                ScanDetail: {
                    ScanDateTime: string;
                    Scan: string;
                    ScannedLocation: string;
                    Instructions: string;
                    StatusDateTime: string;
                    ScanType: string;
                    StatusCode: string;
                };
            }) => ({
                timestamp: scan.ScanDetail?.ScanDateTime || scan.ScanDetail?.StatusDateTime,
                status: scan.ScanDetail?.Scan || scan.ScanDetail?.ScanType || "",
                location: scan.ScanDetail?.ScannedLocation || "",
                instructions: scan.ScanDetail?.Instructions || "",
                status_code: scan.ScanDetail?.StatusCode || "",
            })
        );

        // Build a normalized response
        const result = {
            waybill: shipment.AWB || waybill,
            status: shipment.Status?.Status || "Unknown",
            status_code: shipment.Status?.StatusCode || "",
            status_location: shipment.Status?.StatusLocation || "",
            status_datetime: shipment.Status?.StatusDateTime || "",
            expected_delivery: shipment.ExpectedDeliveryDate || null,
            origin: shipment.Origin || "",
            destination: shipment.Destination || "",
            pickup_date: shipment.PickUpDate || null,
            courier_name: "Delhivery",
            scans: scans.reverse(), // oldest first
            raw_status: shipment.Status,
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
