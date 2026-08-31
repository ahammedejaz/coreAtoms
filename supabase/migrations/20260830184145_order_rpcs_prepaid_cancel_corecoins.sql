-- Part 2 of the 2026-08-30 audit fixes: prepaid order placement, cancellation,
-- and the CoreCoins bookkeeping the replacement clawback depends on.
-- Runs after 20260830200000_security_and_order_integrity.sql, which defines
-- public.resolve_coupon_percentage().

-- ===========================================================================
-- 1. place_order_prepaid — variant stock, GST base, coin cap, idempotency,
--    and a real amount check
-- ===========================================================================
-- The signature changes (adds p_amount_paid_paise), so the old function must be
-- dropped rather than replaced — otherwise it survives as a callable overload.
drop function if exists public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text);

create function public.place_order_prepaid(
    p_user_id uuid, p_address jsonb, p_items jsonb,
    p_payment_method text default 'prepaid',
    p_razorpay_payment_id text default null,
    p_razorpay_order_id text default null,
    p_coins_used integer default 0, p_shipping numeric default 0,
    p_gst numeric default 0, p_discount numeric default 0,
    p_coupon_code text default null,
    p_amount_paid_paise bigint default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_order_id       UUID;
    v_existing       UUID;
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
    -- This guard is a no-op for the service_role caller (auth.uid() is NULL).
    -- EXECUTE is granted to service_role ONLY, and that grant is what actually
    -- protects this function — do not widen it.
    IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot place order for another user';
    END IF;

    -- Idempotency: a retried verification must not create a second order,
    -- decrement stock twice, or debit CoreCoins twice.
    IF p_razorpay_payment_id IS NOT NULL AND p_razorpay_payment_id <> '' THEN
        SELECT id INTO v_existing FROM orders
         WHERE razorpay_payment_id = p_razorpay_payment_id LIMIT 1;
        IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
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

    -- Resolved before the order row exists so `newUsersOnly` sees the
    -- customer's true order history.
    v_coupon_pct := public.resolve_coupon_percentage(p_coupon_code, p_user_id);

    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        razorpay_payment_id, razorpay_order_id,
        total_amount_inr, total_amount, total_inr, subtotal, shipping,
        shipping_amount, gst_amount, total_items, coins_used,
        discount_amount, coupon_code
    ) VALUES (
        p_user_id, 'placed', p_address, p_payment_method,
        p_razorpay_payment_id, p_razorpay_order_id,
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

    -- The Razorpay signature only proves the payment belongs to that Razorpay
    -- order — it says nothing about how much was paid. verify-razorpay-payment
    -- reads the captured amount from Razorpay's own API and passes it here,
    -- where it is compared against the total computed from server-side prices.
    -- One rupee of tolerance absorbs rounding.
    IF p_amount_paid_paise IS NOT NULL
       AND (v_total * 100) > (p_amount_paid_paise + 100) THEN
        RAISE EXCEPTION 'Payment amount mismatch: order total % exceeds the amount paid', v_total;
    END IF;

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

-- ===========================================================================
-- 2. cancel_order — restore stock and refund redeemed CoreCoins
-- ===========================================================================
create or replace function public.cancel_order(p_order_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_item       RECORD;
    v_coins_used INT := 0;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- The status predicate makes this idempotent: a second call matches no row,
    -- so stock cannot be restored twice.
    UPDATE orders
       SET status = 'cancelled', updated_at = now()
     WHERE id = p_order_id
       AND user_id = auth.uid()
       AND status IN ('placed', 'processing')
    RETURNING coins_used INTO v_coins_used;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order cannot be cancelled (not found, not yours, or already shipped)';
    END IF;

    -- Previously a cancellation silently destroyed inventory: stock was
    -- decremented at placement and never returned.
    FOR v_item IN
        SELECT product_id, variant_id, qty FROM order_items WHERE order_id = p_order_id
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            UPDATE product_variants SET stock_qty = stock_qty + v_item.qty
             WHERE id = v_item.variant_id;
        ELSIF v_item.product_id IS NOT NULL THEN
            UPDATE products SET stock_qty = stock_qty + v_item.qty
             WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    -- ...and burned any CoreCoins the customer had redeemed against it.
    IF COALESCE(v_coins_used, 0) > 0 THEN
        INSERT INTO corecoins_wallet (user_id, balance)
             VALUES (p_user_id, v_coins_used)
        ON CONFLICT (user_id) DO UPDATE
           SET balance = corecoins_wallet.balance + v_coins_used,
               updated_at = now();
    END IF;
END;
$function$;

-- ===========================================================================
-- 3. CoreCoins — record coins_credited_amount
-- ===========================================================================
-- handle_replacement_coins() gates every clawback and re-credit on
-- orders.coins_credited_amount, but nothing ever wrote that column, so it was
-- permanently 0 and the entire replacement clawback was dead code.
create or replace function public.credit_corecoins()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
  v_cc_enabled    BOOLEAN;
  v_rep_enabled   BOOLEAN;
  v_window_days   INT;
  v_window_mins   INT;
  v_config        JSONB;
  v_earn_rate     NUMERIC;
  v_earn_per      NUMERIC;
  v_coin_value    NUMERIC;
  v_net_paid      NUMERIC;
  v_coins         INTEGER;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.coins_credited, false) THEN RETURN NEW; END IF;

  SELECT (value->>'enabled')::boolean INTO v_cc_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_cc_enabled, false) THEN RETURN NEW; END IF;

  SELECT (value->>'enabled')::boolean,
         COALESCE((value->>'window_days')::int, 1),
         COALESCE((value->>'window_minutes')::int, 0)
    INTO v_rep_enabled, v_window_days, v_window_mins
    FROM app_settings WHERE key = 'replacements_enabled';

  SELECT value INTO v_config FROM app_settings WHERE key = 'corecoins_config';
  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  2);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);
  IF v_earn_per <= 0 THEN RETURN NEW; END IF;

  v_net_paid := COALESCE(NEW.total_amount_inr, 0) + COALESCE(NEW.coins_used, 0) * v_coin_value;
  v_coins    := FLOOR((v_net_paid / v_earn_per) * v_earn_rate)::integer;

  IF v_coins <= 0 THEN RETURN NEW; END IF;

  -- Recorded in both branches so a replacement filed during the holding window
  -- knows what is owed.
  NEW.coins_credited_amount := v_coins;

  IF COALESCE(v_rep_enabled, false) AND (v_window_days > 0 OR v_window_mins > 0) THEN
    NEW.coins_credit_after := COALESCE(NEW.delivered_at, now()) +
          CASE WHEN v_window_mins > 0 THEN (v_window_mins || ' minutes')::interval
               ELSE (v_window_days || ' days')::interval END;
    NEW.coins_credited := false;
  ELSE
    INSERT INTO corecoins_wallet (user_id, balance)
      VALUES (NEW.user_id, v_coins)
      ON CONFLICT (user_id) DO UPDATE
        SET balance = corecoins_wallet.balance + v_coins, updated_at = now();
    NEW.coins_credited := true;
  END IF;

  RETURN NEW;
END;
$function$;

-- Only fire the trigger when the status actually changes; it was reading three
-- app_settings rows on every single order UPDATE.
drop trigger if exists trg_credit_corecoins on public.orders;
create trigger trg_credit_corecoins
  before update on public.orders
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.credit_corecoins();

create or replace function public.process_pending_corecoins(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_order      RECORD;
    v_config     JSONB;
    v_earn_rate  NUMERIC;
    v_earn_per   NUMERIC;
    v_coin_value NUMERIC;
    v_net_paid   NUMERIC;
    v_coins      INTEGER;
    v_total      INTEGER := 0;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT value INTO v_config FROM app_settings WHERE key = 'corecoins_config';
    v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  2);
    v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
    v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);
    IF v_earn_per <= 0 THEN RETURN 0; END IF;

    FOR v_order IN
        SELECT * FROM orders
        WHERE user_id = p_user_id
          AND status = 'delivered'
          AND coins_credited = false
          AND coins_credit_after IS NOT NULL
          AND coins_credit_after <= now()
        FOR UPDATE SKIP LOCKED
    LOOP
        v_net_paid := COALESCE(v_order.total_amount_inr, 0) +
                      COALESCE(v_order.coins_used, 0) * v_coin_value;
        v_coins    := FLOOR((v_net_paid / v_earn_per) * v_earn_rate)::integer;

        IF v_coins > 0 THEN
            INSERT INTO corecoins_wallet (user_id, balance)
              VALUES (v_order.user_id, v_coins)
              ON CONFLICT (user_id) DO UPDATE
                SET balance = corecoins_wallet.balance + v_coins, updated_at = now();
        END IF;

        UPDATE orders
           SET coins_credited = true,
               coins_credited_amount = GREATEST(v_coins, 0)
         WHERE id = v_order.id;
        v_total := v_total + 1;
    END LOOP;

    RETURN v_total;
END;
$function$;

-- ===========================================================================
-- 4. Grants — unchanged model, restated because functions were recreated
-- ===========================================================================
-- Never grant the order RPCs to anon: their guards compare p_user_id against
-- auth.uid(), which is NULL for an anonymous caller, so the comparison yields
-- NULL rather than TRUE and the guard never fires.
revoke all on function public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text, bigint)
  from public, anon, authenticated;
grant execute on function public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text, bigint)
  to service_role;

revoke all on function public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text) to authenticated, service_role;

revoke all on function public.cancel_order(uuid, uuid) from public, anon;
grant execute on function public.cancel_order(uuid, uuid) to authenticated, service_role;

revoke all on function public.process_pending_corecoins(uuid) from public, anon;
grant execute on function public.process_pending_corecoins(uuid) to authenticated, service_role;

-- Internal helper: reachable only through the SECURITY DEFINER functions above.
revoke all on function public.resolve_coupon_percentage(text, uuid)
  from public, anon, authenticated;

revoke all on function public.validate_coupon(text) from public, anon;
grant execute on function public.validate_coupon(text) to authenticated, service_role;
