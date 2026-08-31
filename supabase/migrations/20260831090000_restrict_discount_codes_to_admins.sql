-- DEFERRED — apply together with the web release that switches Checkout over to
-- the validate_coupon() RPC. Applying this before that release ships will break
-- coupon entry on the live site, because the current Checkout page reads the
-- whole discount_codes array from app_settings and validates it in the browser.
--
-- Everything needed to make this safe already exists in
-- 20260830200000_security_and_order_integrity.sql:
--   * validate_coupon(code)            — previews one code for the signed-in user
--   * resolve_coupon_percentage(...)   — re-derives the discount at order time,
--                                        including the emails / newUsersOnly
--                                        restrictions that used to be enforced
--                                        only in the browser.
--
-- Why it matters: app_settings has exactly one permissive SELECT policy, and its
-- predicate lets ANY signed-in user read the sensitive keys. Every coupon code —
-- including codes targeted at specific email addresses — is therefore one signup
-- away from being harvested wholesale.
--
-- app_settings must keep exactly ONE permissive SELECT policy: permissive
-- policies OR together, so adding a second one silently defeats this filter.

drop policy if exists "Public can read non-sensitive app_settings" on public.app_settings;

create policy "Public can read non-sensitive app_settings" on public.app_settings
  for select
  using (
    key <> all (array[
      'discount_codes',
      'warehouse_address',
      'delhivery_client_name',
      'delhivery_pickup_name'
    ])
    or (select public.is_admin())
  );
