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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

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
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!DELHIVERY_TOKEN) {
            return new Response(
                JSON.stringify({ error: "Delhivery token not configured" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(
                JSON.stringify({ error: "Server not configured" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // ── Caller identity ────────────────────────────────────────────────
        // This endpoint used to be completely unauthenticated: anyone could POST
        // any waybill and read that customer's origin, destination and full
        // scan history.
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: userData, error: userErr } = await supabase.auth.getUser(
            authHeader.slice("Bearer ".length)
        );
        if (userErr || !userData?.user?.id) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }
        const userId = userData.user.id;

        const limited = await checkRateLimit(req, corsHeaders, {
            endpoint: "delhivery-track",
            maxRequests: 30,
            windowSeconds: 60,
            identifier: userId || getClientIp(req),
        });
        if (limited) return limited;

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

        // ── Ownership ──────────────────────────────────────────────────────
        // Admins may track anything; everyone else only their own shipments,
        // whether that waybill belongs to an order or to a replacement.
        const { data: profile } = await supabase
            .from("profiles").select("role").eq("id", userId).maybeSingle();

        if (profile?.role !== "admin") {
            const [orderMatch, replacementMatch] = await Promise.all([
                supabase.from("orders").select("id")
                    .eq("user_id", userId).eq("delhivery_waybill", waybill).limit(1),
                supabase.from("replacements").select("id")
                    .eq("user_id", userId)
                    .or(`replacement_waybill.eq.${waybill},reverse_waybill.eq.${waybill}`)
                    .limit(1),
            ]);
            const owns =
                (orderMatch.data?.length ?? 0) > 0 ||
                (replacementMatch.data?.length ?? 0) > 0;
            if (!owns) {
                return new Response(
                    JSON.stringify({ error: "Shipment not found" }),
                    {
                        status: 404,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }
        }

        // Fetch tracking from Delhivery. The token goes in a header, not the
        // query string, so it does not land in proxy/CDN access logs.
        const trackRes = await fetch(
            `${DELHIVERY_BASE}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`,
            {
                headers: {
                    Accept: "application/json",
                    Authorization: `Token ${DELHIVERY_TOKEN}`,
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
