// supabase/functions/_shared/cors.ts
//
// Shared CORS utility for all Edge Functions.
// Allows requests from:
//   - https://coreatoms.in / https://www.coreatoms.in (production)
//   - https://core-atoms.vercel.app (Vercel main deployment)
//   - https://core-atoms*.vercel.app (this project's preview/branch deployments)
//   - http://localhost:* (local development)

const ALLOWED_ORIGINS = [
    "https://coreatoms.in",
    "https://www.coreatoms.in",
    "https://core-atoms.vercel.app",
];

/**
 * Checks if the given origin is allowed.
 *
 * The preview pattern is scoped to this project's own deployments. It used to
 * match any `*.vercel.app` host, which allowlisted every Vercel project on the
 * internet — including one an attacker had just deployed.
 */
function isAllowedOrigin(origin: string): boolean {
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (/^https:\/\/core-atoms[\w-]*\.vercel\.app$/.test(origin)) return true;
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
        "Access-Control-Max-Age": "86400",
        // The Allow-Origin value is reflected per request, so any shared cache
        // must key on Origin or it can hand one site's header to another.
        Vary: "Origin",
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
