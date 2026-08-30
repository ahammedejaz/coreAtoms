-- ============================================================================
-- Security hardening — 30 Aug 2026
--
-- Fixes three issues found by auditing the live database:
--
-- 1. Order-placement RPCs were executable by `anon`. They are SECURITY DEFINER
--    and take p_user_id as an argument, and their guards compare it against
--    auth.uid(), which is NULL for an anonymous caller — so the guard never
--    fired and anyone holding the public anon key could place orders as any
--    user (including "prepaid" orders with a forged razorpay_payment_id).
--
-- 2. Two stale pre-coupon overloads (place_order_cod/7 args,
--    place_order_prepaid/10 args) were still deployed with no auth check at
--    all. Every caller passes p_coupon_code, so nothing resolves to them.
--
-- 3. app_settings had three redundant `USING (true)` SELECT policies that
--    overrode the policy written to hide discount_codes and warehouse_address
--    from anonymous visitors — every coupon code was publicly readable.
--
-- Also sets a fixed search_path on all SECURITY DEFINER functions.
-- ============================================================================

-- ─── 1. Drop the stale, unguarded RPC overloads ─────────────────────────────
DROP FUNCTION IF EXISTS public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric);

DROP FUNCTION IF EXISTS public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric);

-- ─── 2. Least-privilege EXECUTE grants ──────────────────────────────────────
-- Customer-facing RPCs: signed-in users only. Their internal
-- `p_user_id <> auth.uid()` guard is only meaningful for a caller that has a
-- uid, so `anon` must not reach them at all.
REVOKE EXECUTE ON FUNCTION public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text)
    TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_order(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_pending_corecoins(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_pending_corecoins(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_failed_order(
    uuid, jsonb, jsonb, text, numeric, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_failed_order(
    uuid, jsonb, jsonb, text, numeric, numeric) TO authenticated, service_role;

-- Prepaid orders are created only by the verify-razorpay-payment Edge Function
-- using the service-role key — no client calls this directly.
REVOKE EXECUTE ON FUNCTION public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text)
    TO service_role;

-- Trigger functions are invoked by the trigger, not over REST. Postgres checks
-- EXECUTE on a trigger function when the trigger is created, not per statement,
-- so revoking here does not affect the triggers.
REVOKE EXECUTE ON FUNCTION public.credit_corecoins()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_replacement_coins()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_push_token_timestamp() FROM PUBLIC, anon, authenticated;

-- Maintenance helper — service role only. Leaving it open let anyone clear the
-- rate-limit table and so defeat Edge Function rate limiting.
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;

-- NOTE: public.is_admin() deliberately keeps its grants — RLS policies across
-- the schema call it, and policy expressions are evaluated with the privileges
-- of the querying role. Revoking it would break admin reads for every table.

-- ─── 3. app_settings — one SELECT policy, not four ──────────────────────────
DROP POLICY IF EXISTS "Anyone can read app settings"             ON public.app_settings;
DROP POLICY IF EXISTS "Public can read app_settings"             ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_read"                        ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_update"                ON public.app_settings;
DROP POLICY IF EXISTS "Public can read non-sensitive app_settings" ON public.app_settings;

-- Anonymous visitors get everything except coupon codes, the warehouse address
-- and the Delhivery account identifiers. `(select auth.uid())` is evaluated
-- once per statement instead of once per row.
CREATE POLICY "Public can read non-sensitive app_settings"
    ON public.app_settings FOR SELECT
    USING (
        key <> ALL (ARRAY[
            'discount_codes',
            'warehouse_address',
            'delhivery_client_name',
            'delhivery_pickup_name'
        ])
        OR (select auth.uid()) IS NOT NULL
    );

-- "Admins can write app_settings" (FOR ALL) is kept and covers admin writes.

-- ─── 4. Pin search_path on SECURITY DEFINER / trigger functions ─────────────
ALTER FUNCTION public.place_order_cod(uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.place_order_prepaid(uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_order(uuid, uuid)                       SET search_path = public, pg_temp;
ALTER FUNCTION public.process_pending_corecoins(uuid)                SET search_path = public, pg_temp;
ALTER FUNCTION public.log_failed_order(uuid, jsonb, jsonb, text, numeric, numeric)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.credit_corecoins()                             SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                              SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_replacement_coins()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_order_status_change()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_rate_limits()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()                                     SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                               SET search_path = public, pg_temp;
ALTER FUNCTION public.update_push_token_timestamp()                  SET search_path = public, pg_temp;
