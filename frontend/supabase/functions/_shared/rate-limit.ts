// supabase/functions/_shared/rate-limit.ts
//
// Lightweight database-backed rate limiter for Edge Functions.
// Uses the `rate_limits` table to track request counts per identifier
// (user ID or IP) per endpoint within a sliding time window.
//
// Usage:
//   const limited = await checkRateLimit(req, corsHeaders, {
//     endpoint: "create-razorpay-order",
//     maxRequests: 5,
//     windowSeconds: 60,
//     identifier: userId || clientIp,
//   });
//   if (limited) return limited; // 429 response already built

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitConfig {
    endpoint: string;
    maxRequests: number;
    windowSeconds: number;
    identifier: string;
}

/**
 * Extracts the client IP from request headers.
 * Supabase Edge Functions set x-forwarded-for; falls back to
 * x-real-ip or a generic default.
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Checks whether the caller has exceeded the rate limit.
 *
 * @returns A 429 Response if over limit, or `null` if the request is allowed.
 */
export async function checkRateLimit(
    req: Request,
    corsHeaders: Record<string, string>,
    config: RateLimitConfig
): Promise<Response | null> {
    const { endpoint, maxRequests, windowSeconds, identifier } = config;

    if (!identifier || identifier === "unknown") {
        // Can't rate-limit without an identifier — allow through
        return null;
    }

    try {
        const sbUrl = Deno.env.get("SUPABASE_URL")!;
        const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(sbUrl, sbKey);

        const windowStart = new Date(
            Date.now() - windowSeconds * 1000
        ).toISOString();

        // Count recent requests within the window
        const { count, error: countErr } = await sb
            .from("rate_limits")
            .select("*", { count: "exact", head: true })
            .eq("identifier", identifier)
            .eq("endpoint", endpoint)
            .gte("created_at", windowStart);

        if (countErr) {
            console.warn("Rate limit check failed:", countErr.message);
            return null; // fail open — don't block on DB errors
        }

        if ((count ?? 0) >= maxRequests) {
            const retryAfter = String(windowSeconds);
            return new Response(
                JSON.stringify({
                    error: "Too many requests. Please try again later.",
                    retry_after: windowSeconds,
                }),
                {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                        "Retry-After": retryAfter,
                    },
                }
            );
        }

        // Record this request (fire-and-forget — don't block on insert)
        sb.from("rate_limits")
            .insert({ identifier, endpoint })
            .then(({ error }) => {
                if (error) console.warn("Rate limit insert failed:", error.message);
            });

        return null; // allowed
    } catch (err) {
        console.warn("Rate limit error:", err);
        return null; // fail open
    }
}
