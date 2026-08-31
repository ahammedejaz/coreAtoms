-- Security and order-integrity hardening (audit of 2026-08-30).
--
-- Everything in this file is safe to apply ahead of the matching web release:
-- no change here can make a server-computed total HIGHER than what the current
-- production client charges, so no in-flight payment can be rejected by it.
-- The two changes that DO require the web release ship separately in
-- 20260830201000_restrict_discount_codes.sql.

-- ===========================================================================
-- 1. RLS — privilege escalation, PII exposure, and policy drift
-- ===========================================================================

-- 1a. Any signed-in customer could set their own profiles.role to 'admin'.
-- `update_own_profile` had no WITH CHECK, so for UPDATE Postgres fell back to
-- its USING expression (id = auth.uid()) — which the row still satisfies after
-- the role is changed. Permissive policies OR together, so this silently
-- defeated the role-guarded policy sitting next to it. is_admin() then unlocks
-- the whole admin surface.
drop policy if exists "update_own_profile" on public.profiles;
drop policy if exists "read_own_profile" on public.profiles;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (coalesce(role, 'customer') = 'customer' or (select public.is_admin()))
  );

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_admin_all" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "insert_own_profile" on public.profiles;
create policy "insert_own_profile" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and coalesce(role, 'customer') = 'customer');

-- 1b. wa_notifications holds customer names and phone numbers. Both policies
-- were named "Admins can ..." but used USING (true) / WITH CHECK (true), so
-- every signed-in customer could read and write the notification log.
drop policy if exists "Admins can read wa_notifications" on public.wa_notifications;
create policy "Admins can read wa_notifications" on public.wa_notifications
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Admins can insert wa_notifications" on public.wa_notifications;
create policy "Admins can insert wa_notifications" on public.wa_notifications
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "Admins can update wa_notifications" on public.wa_notifications;
create policy "Admins can update wa_notifications" on public.wa_notifications
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- The admin UI upserts on (order_id, status); without this constraint every
-- "mark WhatsApp sent" fails with 42P10 and silently reverts in the UI.
create unique index if not exists wa_notifications_order_status_key
  on public.wa_notifications (order_id, status);

-- 1c. products_select_all USING(true) exposed unpublished/draft products to
-- any signed-in user. The public policy already covers the storefront.
drop policy if exists "products_select_all" on public.products;
drop policy if exists "products_read_all" on public.products;
drop policy if exists "products_write_admin" on public.products;
drop policy if exists "products_update_admin" on public.products;
drop policy if exists "products_delete_admin" on public.products;

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products" on public.products
  for select using (is_active = true or (select public.is_admin()));

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 1d. store_settings had a blanket read for every signed-in user — the same
-- hole that was closed on app_settings. It holds one row of store config.
drop policy if exists "settings_read_authenticated" on public.store_settings;
drop policy if exists "Public can read store_settings" on public.store_settings;
create policy "settings_read_admin" on public.store_settings
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "settings_admin_update" on public.store_settings;
create policy "settings_admin_update" on public.store_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 1e. Collapse three generations of duplicate permissive policies on the order
-- tables and addresses, and wrap auth.uid()/is_admin() in a scalar subquery so
-- they are evaluated once per statement instead of once per row.
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_select_admin" on public.orders;
drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_update_admin_only" on public.orders;

drop policy if exists "orders_create_own" on public.orders;
create policy "orders_create_own" on public.orders
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "orders_read_own_or_admin" on public.orders;
create policy "orders_read_own_or_admin" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "order_items_select_admin" on public.order_items;
drop policy if exists "order_items_select_own" on public.order_items;

drop policy if exists "order_items_read_own_or_admin" on public.order_items;
create policy "order_items_read_own_or_admin" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = (select auth.uid()) or (select public.is_admin()))
  ));

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own" on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  ));

drop policy if exists "order_items_update_admin_only" on public.order_items;
create policy "order_items_update_admin_only" on public.order_items
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "order_items_delete_admin_only" on public.order_items;
create policy "order_items_delete_admin_only" on public.order_items
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "addresses_read_own" on public.addresses;
drop policy if exists "addresses_select_own" on public.addresses;
drop policy if exists "addresses_insert_own" on public.addresses;
drop policy if exists "addresses_write_own" on public.addresses;
drop policy if exists "addresses_update_own" on public.addresses;
drop policy if exists "addresses_delete_own" on public.addresses;

drop policy if exists "Users manage own addresses" on public.addresses;
create policy "Users manage own addresses" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "addresses_select_admin" on public.addresses;
create policy "addresses_select_admin" on public.addresses
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Users can manage own addresses" on public.user_addresses;
create policy "Users can manage own addresses" on public.user_addresses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Admins can view all addresses" on public.user_addresses;
create policy "Admins can view all addresses" on public.user_addresses
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Users can view own wallet" on public.corecoins_wallet;
drop policy if exists "Admin can view all wallets" on public.corecoins_wallet;
create policy "Users can view own wallet" on public.corecoins_wallet
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- service_role bypasses RLS; the explicit policy only added a second
-- permissive SELECT policy to evaluate on every row.
drop policy if exists "Service role reads all tokens" on public.push_tokens;
drop policy if exists "Users manage own push tokens" on public.push_tokens;
create policy "Users manage own push tokens" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users can view own replacements" on public.replacements;
drop policy if exists "Admins can view all replacements" on public.replacements;
create policy "Users can view own replacements" on public.replacements
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users can create replacements" on public.replacements;
create policy "Users can create replacements" on public.replacements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    -- a replacement may only be filed against your own delivered order
    and exists (
      select 1 from public.orders o
      where o.id = replacements.order_id
        and o.user_id = (select auth.uid())
        and o.status = 'delivered'
    )
  );

drop policy if exists "Admins can update replacements" on public.replacements;
create policy "Admins can update replacements" on public.replacements
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Admin ALL policies double as a second permissive SELECT policy on every
-- public read path; split them into write-only commands.
drop policy if exists "Admins can manage product images" on public.product_images;
create policy "Admins insert product images" on public.product_images
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update product images" on public.product_images
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete product images" on public.product_images
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Admins manage variants" on public.product_variants;
create policy "Admins insert variants" on public.product_variants
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update variants" on public.product_variants
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete variants" on public.product_variants
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Public read active variants" on public.product_variants;
create policy "Public read active variants" on public.product_variants
  for select using (is_active = true or (select public.is_admin()));

drop policy if exists "Admins can write app_settings" on public.app_settings;
create policy "Admins insert app_settings" on public.app_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update app_settings" on public.app_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete app_settings" on public.app_settings
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Users can delete own reviews" on public.product_reviews;
create policy "Users can delete own reviews" on public.product_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Admins can delete any review" on public.product_reviews;
create policy "Admins can delete any review" on public.product_reviews
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Verified buyers can review" on public.product_reviews;
create policy "Verified buyers can review" on public.product_reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.user_id = (select auth.uid())
        and o.status = 'delivered'
        and oi.product_id = product_reviews.product_id
    )
  );

-- ===========================================================================
-- 2. Indexes for unindexed foreign keys on hot paths
-- ===========================================================================
create index if not exists idx_order_items_order_id      on public.order_items (order_id);
create index if not exists idx_order_items_product_id    on public.order_items (product_id);
create index if not exists idx_order_items_variant_id    on public.order_items (variant_id);
create index if not exists idx_orders_user_created       on public.orders (user_id, created_at desc);
create index if not exists idx_orders_address_id         on public.orders (address_id);
create index if not exists idx_product_images_product_id on public.product_images (product_id);
create index if not exists idx_product_reviews_user_id   on public.product_reviews (user_id);
create index if not exists idx_product_reviews_order_id  on public.product_reviews (order_id);
create index if not exists idx_replacements_user_id      on public.replacements (user_id);
create index if not exists idx_addresses_user_id         on public.addresses (user_id);

-- Backstop for prepaid idempotency (verified: zero duplicates today).
create unique index if not exists orders_razorpay_payment_id_key
  on public.orders (razorpay_payment_id) where razorpay_payment_id is not null;

-- ===========================================================================
-- 3. Coupon resolution — moved server-side
-- ===========================================================================
-- The admin UI writes `emails` (a whitelist) and `newUsersOnly` onto each code,
-- but only the browser enforced them: the order RPCs re-derived nothing beyond
-- code/active/dates, so any signed-in user could redeem a targeted coupon by
-- calling the RPC directly. One helper is now the single source of truth for
-- both the checkout preview and order placement.
create or replace function public.resolve_coupon_percentage(p_code text, p_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_codes  jsonb;
  v_coupon jsonb;
  v_emails jsonb;
  v_email  text;
begin
  if p_code is null or btrim(p_code) = '' or p_user_id is null then
    return 0;
  end if;

  select value into v_codes from app_settings where key = 'discount_codes';

  select elem into v_coupon
    from jsonb_array_elements(coalesce(v_codes, '[]'::jsonb)) as elem
   where upper(elem->>'code') = upper(btrim(p_code))
     and coalesce((elem->>'active')::boolean, false) = true
   limit 1;

  if v_coupon is null then return 0; end if;

  if v_coupon->>'startsAt' is not null
     and (v_coupon->>'startsAt')::timestamptz > now() then return 0; end if;
  if v_coupon->>'endsAt' is not null
     and (v_coupon->>'endsAt')::timestamptz < now() then return 0; end if;

  v_emails := v_coupon->'emails';
  if v_emails is not null
     and jsonb_typeof(v_emails) = 'array'
     and jsonb_array_length(v_emails) > 0 then
    select lower(email) into v_email from auth.users where id = p_user_id;
    if v_email is null then return 0; end if;
    if not exists (
      select 1 from jsonb_array_elements_text(v_emails) as e
      where lower(btrim(e)) = v_email
    ) then
      return 0;
    end if;
  end if;

  if coalesce((v_coupon->>'newUsersOnly')::boolean, false) then
    if exists (select 1 from orders where user_id = p_user_id) then return 0; end if;
  end if;

  return greatest(0, least(100, coalesce((v_coupon->>'percentage')::numeric, 0)));
end;
$function$;

-- Lets checkout preview one specific code without being able to read the whole
-- discount_codes array (which is being locked to admins in the next migration).
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_pct numeric;
begin
  if v_uid is null then
    return jsonb_build_object('valid', false, 'percentage', 0,
      'message', 'Please sign in to use a coupon.');
  end if;
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'percentage', 0,
      'message', 'Enter a coupon code.');
  end if;

  v_pct := public.resolve_coupon_percentage(p_code, v_uid);

  if v_pct <= 0 then
    return jsonb_build_object('valid', false, 'percentage', 0,
      'message', 'This code is not valid for your account.');
  end if;

  return jsonb_build_object('valid', true, 'percentage', v_pct,
    'message', 'Coupon applied.');
end;
$function$;

-- ===========================================================================
-- 4. place_order_cod — variant stock, GST base, coin cap
-- ===========================================================================
create or replace function public.place_order_cod(
    p_user_id uuid, p_address jsonb, p_items jsonb,
    p_coins_used integer default 0, p_shipping numeric default 0,
    p_gst numeric default 0, p_discount numeric default 0,
    p_coupon_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_order_id       UUID;
    v_item           JSONB;
    v_product_id     UUID;
    v_variant_id     UUID;
    v_qty            INT;
    v_unit_price     NUMERIC;
    v_stock          INT;
    v_subtotal       NUMERIC := 0;
    v_count          INT := 0;
    v_coin_value     NUMERIC;
    v_coin_disc      NUMERIC := 0;
    v_coins_eff      INT := 0;
    v_total          NUMERIC;
    v_flat_shipping  NUMERIC := 0;
    v_free_ship_min  NUMERIC := 0;
    v_gst_pct        NUMERIC := 0;
    v_gst_amount     NUMERIC := 0;
    v_shipping_final NUMERIC := 0;
    v_coupon_pct     NUMERIC := 0;
    v_discount       NUMERIC := 0;
    v_taxable        NUMERIC := 0;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot place order for another user';
    END IF;
    IF p_coins_used < 0 THEN RAISE EXCEPTION 'Invalid coins_used value'; END IF;
    IF p_shipping < 0 OR p_shipping > 2000 THEN
        RAISE EXCEPTION 'Shipping amount out of valid range (0-2000)';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No items supplied';
    END IF;
    IF jsonb_array_length(p_items) > 100 THEN
        RAISE EXCEPTION 'Too many line items';
    END IF;

    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_flat_shipping FROM app_settings WHERE key = 'shipping_amount';
    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_free_ship_min FROM app_settings WHERE key = 'free_shipping_min';
    SELECT COALESCE((value->>'percentage')::numeric, 0)
      INTO v_gst_pct FROM app_settings WHERE key = 'gst_percentage';

    -- Resolved before the order row exists so that `newUsersOnly` sees the
    -- customer's true order history.
    v_coupon_pct := public.resolve_coupon_percentage(p_coupon_code, p_user_id);

    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        total_amount_inr, total_amount, total_inr, subtotal, shipping,
        shipping_amount, gst_amount, total_items, coins_used,
        discount_amount, coupon_code
    ) VALUES (
        p_user_id, 'placed', p_address, 'cod',
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN v_coupon_pct > 0 THEN p_coupon_code ELSE NULL END
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL
                              AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty := (v_item->>'qty')::INT;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
        END IF;

        IF v_variant_id IS NOT NULL THEN
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM product_variants
             WHERE id = v_variant_id AND product_id = v_product_id
             FOR UPDATE;
            IF v_unit_price IS NULL THEN
                RAISE EXCEPTION 'Product or variant % not found', v_product_id;
            END IF;
            IF v_stock < v_qty THEN
                RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
            END IF;
            -- Previously this decremented products.stock_qty even for variant
            -- purchases, so variant stock never depleted (unlimited oversell)
            -- and the row actually mutated was never locked.
            UPDATE product_variants SET stock_qty = stock_qty - v_qty
             WHERE id = v_variant_id;
        ELSE
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM products WHERE id = v_product_id FOR UPDATE;
            IF v_unit_price IS NULL THEN
                RAISE EXCEPTION 'Product or variant % not found', v_product_id;
            END IF;
            IF v_stock < v_qty THEN
                RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
            END IF;
            UPDATE products SET stock_qty = stock_qty - v_qty
             WHERE id = v_product_id;
        END IF;

        INSERT INTO order_items (order_id, product_id, variant_id, product_name,
                                 qty, unit_price_inr, line_total_inr, image_url)
        VALUES (v_order_id, v_product_id, v_variant_id, v_item->>'product_name',
                v_qty, v_unit_price, v_unit_price * v_qty, v_item->>'image_url');

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    IF v_flat_shipping > 0 THEN v_shipping_final := v_flat_shipping;
    ELSE v_shipping_final := GREATEST(0, p_shipping); END IF;
    IF v_free_ship_min > 0 AND v_subtotal >= v_free_ship_min THEN
        v_shipping_final := 0;
    END IF;

    -- GST is levied on the discounted taxable value, not the gross subtotal.
    v_discount   := CASE WHEN v_coupon_pct > 0
                         THEN ROUND(v_subtotal * v_coupon_pct / 100) ELSE 0 END;
    v_taxable    := GREATEST(0, v_subtotal - v_discount);
    v_gst_amount := CASE WHEN v_gst_pct > 0
                         THEN ROUND(v_taxable * v_gst_pct / 100) ELSE 0 END;

    SELECT COALESCE((value->>'coin_value_inr')::numeric, 1) INTO v_coin_value
      FROM app_settings WHERE key = 'corecoins_config';
    v_coin_value := COALESCE(v_coin_value, 1);

    -- Cap redemption at the payable amount so surplus coins are not burned.
    IF p_coins_used > 0 AND v_coin_value > 0 THEN
        v_coins_eff := LEAST(
            p_coins_used,
            FLOOR((v_taxable + v_shipping_final + v_gst_amount) / v_coin_value)::int
        );
        IF v_coins_eff > 0 THEN
            UPDATE corecoins_wallet
               SET balance = balance - v_coins_eff, updated_at = now()
             WHERE user_id = p_user_id AND balance >= v_coins_eff;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insufficient CoreCoins balance';
            END IF;
        END IF;
    END IF;
    v_coin_disc := v_coins_eff * v_coin_value;

    v_total := GREATEST(0, v_taxable + v_shipping_final + v_gst_amount - v_coin_disc);

    UPDATE orders
       SET subtotal = v_subtotal, shipping_amount = v_shipping_final,
           shipping = v_shipping_final, gst_amount = v_gst_amount,
           discount_amount = v_discount, total_amount_inr = v_total,
           total_amount = v_total, total_inr = v_total,
           total_items = v_count, coins_used = v_coins_eff
     WHERE id = v_order_id;

    RETURN v_order_id;
END;
$function$;
