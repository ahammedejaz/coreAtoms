-- ============================================================
--  Fix Order Total — include Shipping + GST in total_amount_inr
--
--  Root cause: place_order_cod and place_order_prepaid were saving
--  total_amount_inr = items_subtotal only, ignoring shipping & GST.
--
--  This migration:
--    1. Adds shipping_amount and gst_amount columns to orders
--    2. Rebuilds both RPCs to accept p_shipping + p_gst parameters
--       and store the correct full total
-- ============================================================

-- 1. Add breakdown columns (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount      NUMERIC(10,2) NOT NULL DEFAULT 0;


-- 2. Rebuild place_order_cod
DROP FUNCTION IF EXISTS public.place_order_cod(UUID, JSONB, JSONB, INT);

CREATE OR REPLACE FUNCTION public.place_order_cod(
    p_user_id    UUID,
    p_address    JSONB,
    p_items      JSONB,
    p_coins_used INT     DEFAULT 0,
    p_shipping   NUMERIC DEFAULT 0,
    p_gst        NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id   UUID;
    v_item       JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_qty        INT;
    v_unit_price NUMERIC;
    v_stock      INT;
    v_subtotal   NUMERIC := 0;
    v_count      INT := 0;
    v_coin_value NUMERIC;
    v_coin_disc  NUMERIC;
    v_total      NUMERIC;
BEGIN
    -- Deduct CoreCoins if used
    IF p_coins_used > 0 THEN
        UPDATE corecoins_wallet
          SET balance    = balance - p_coins_used,
              updated_at = now()
          WHERE user_id = p_user_id
            AND balance >= p_coins_used;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient CoreCoins balance';
        END IF;
    END IF;

    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used
    ) VALUES (
        p_user_id, 'placed', p_address, 'cod',
        0, 0, 0, COALESCE(p_shipping, 0), COALESCE(p_gst, 0),
        0, p_coins_used
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name', v_qty, v_unit_price,
            v_unit_price * v_qty, v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- Coin discount in INR
    SELECT COALESCE((value->>'coin_value_inr')::numeric, 1) INTO v_coin_value
      FROM app_settings WHERE key = 'corecoins_config';
    v_coin_disc := COALESCE(p_coins_used, 0) * COALESCE(v_coin_value, 1);

    -- Full total: items + shipping + gst - coin discount
    v_total := GREATEST(0, v_subtotal + COALESCE(p_shipping, 0) + COALESCE(p_gst, 0) - v_coin_disc);

    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_total,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- 3. Rebuild place_order_prepaid
DROP FUNCTION IF EXISTS public.place_order_prepaid(UUID, JSONB, JSONB, TEXT, TEXT, TEXT, INT);

CREATE OR REPLACE FUNCTION public.place_order_prepaid(
    p_user_id             UUID,
    p_address             JSONB,
    p_items               JSONB,
    p_payment_method      TEXT    DEFAULT 'prepaid',
    p_razorpay_payment_id TEXT    DEFAULT NULL,
    p_razorpay_order_id   TEXT    DEFAULT NULL,
    p_coins_used          INT     DEFAULT 0,
    p_shipping            NUMERIC DEFAULT 0,
    p_gst                 NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id   UUID;
    v_item       JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_qty        INT;
    v_unit_price NUMERIC;
    v_stock      INT;
    v_subtotal   NUMERIC := 0;
    v_count      INT := 0;
    v_coin_value NUMERIC;
    v_coin_disc  NUMERIC;
    v_total      NUMERIC;
BEGIN
    -- Deduct CoreCoins if used
    IF p_coins_used > 0 THEN
        UPDATE corecoins_wallet
          SET balance    = balance - p_coins_used,
              updated_at = now()
          WHERE user_id = p_user_id
            AND balance >= p_coins_used;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient CoreCoins balance';
        END IF;
    END IF;

    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        razorpay_payment_id, razorpay_order_id,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used
    ) VALUES (
        p_user_id, 'placed', p_address, p_payment_method,
        p_razorpay_payment_id, p_razorpay_order_id,
        0, 0, 0, COALESCE(p_shipping, 0), COALESCE(p_gst, 0),
        0, p_coins_used
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name', v_qty, v_unit_price,
            v_unit_price * v_qty, v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- Coin discount in INR
    SELECT COALESCE((value->>'coin_value_inr')::numeric, 1) INTO v_coin_value
      FROM app_settings WHERE key = 'corecoins_config';
    v_coin_disc := COALESCE(p_coins_used, 0) * COALESCE(v_coin_value, 1);

    -- Full total: items + shipping + gst - coin discount
    v_total := GREATEST(0, v_subtotal + COALESCE(p_shipping, 0) + COALESCE(p_gst, 0) - v_coin_disc);

    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_total,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
