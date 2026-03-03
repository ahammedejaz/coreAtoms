// supabase/functions/_shared/cors.ts
//
// Shared CORS utility for all Edge Functions.
// Allows requests from:
//   - https://coreatoms.in / https://www.coreatoms.in (production)
//   - https://core-atoms.vercel.app (Vercel main deployment)
//   - https://*.vercel.app (Vercel preview/branch deployments)
//   - http://localhost:* (local development)

const ALLOWED_ORIGINS = [
    "https://coreatoms.in",
    "https://www.coreatoms.in",
    "https://core-atoms.vercel.app",
];

/**
 * Checks if the given origin is allowed.
 * Matches exact production domains, any *.vercel.app subdomain, and localhost.
 */
function isAllowedOrigin(origin: string): boolean {
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return true;
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
    return false;
}

/**
 * Returns CORS headers for the given request.
 * If the request Origin is allowed, reflects it back; otherwise returns no Allow-Origin.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") || "";
    const headers: Record<string, string> = {
        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (isAllowedOrigin(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
}

/**
 * Returns a 200 OK preflight response with proper CORS headers.
 */
export function handleCorsPreflightRequest(req: Request): Response {
    return new Response("ok", { headers: getCorsHeaders(req) });
}
