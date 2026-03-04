-- ============================================================
--  CoreCoins Loop Fix
--  Prevents users from earning coins on orders paid with coins.
--
--  How: stores coins_used on the order, trigger credits coins
--  only on net cash paid = total_amount_inr - coin_discount_value
-- ============================================================

-- 1. Add coins_used column to orders (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coins_used INTEGER NOT NULL DEFAULT 0;

-- 2. Update trigger: credit coins on NET cash paid only
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled     BOOLEAN;
  v_config      JSONB;
  v_earn_rate   NUMERIC;
  v_earn_per    NUMERIC;
  v_coin_value  NUMERIC;
  v_net_paid    NUMERIC;
  v_coins       INTEGER;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Check if CoreCoins is enabled
  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Get config
  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  -- Net cash paid = total_amount_inr minus the monetary value of coins redeemed
  -- This prevents earning coins on the portion paid with coins
  v_net_paid := COALESCE(NEW.total_amount_inr, 0)
              - (COALESCE(NEW.coins_used, 0) * v_coin_value);

  -- Only credit on positive cash paid
  IF v_net_paid <= 0 THEN RETURN NEW; END IF;

  v_coins := FLOOR(v_net_paid / v_earn_per) * v_earn_rate;

  IF v_coins <= 0 THEN RETURN NEW; END IF;

  -- Upsert wallet
  INSERT INTO corecoins_wallet (user_id, balance, updated_at)
    VALUES (NEW.user_id, v_coins, now())
    ON CONFLICT (user_id)
    DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                  updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reattach trigger (function is replaced in-place, trigger already exists)
DROP TRIGGER IF EXISTS trg_credit_corecoins ON orders;
CREATE TRIGGER trg_credit_corecoins
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_corecoins();


-- 3. Update place_order_cod to store coins_used on the order
CREATE OR REPLACE FUNCTION place_order_cod(
    p_user_id    UUID,
    p_address    JSONB,
    p_items      JSONB,
    p_coins_used INT DEFAULT 0
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
BEGIN
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
        total_amount_inr, subtotal, shipping, total_items, coins_used
    ) VALUES (
        p_user_id, 'placed', p_address, 'cod',
        0, 0, 0, 0, p_coins_used
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

    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_subtotal,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- 4. Update place_order_prepaid to store coins_used on the order
CREATE OR REPLACE FUNCTION place_order_prepaid(
    p_user_id             UUID,
    p_address             JSONB,
    p_items               JSONB,
    p_payment_method      TEXT DEFAULT 'prepaid',
    p_razorpay_payment_id TEXT DEFAULT NULL,
    p_razorpay_order_id   TEXT DEFAULT NULL,
    p_coins_used          INT  DEFAULT 0
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
BEGIN
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
        total_amount_inr, subtotal, shipping, total_items, coins_used
    ) VALUES (
        p_user_id, 'placed', p_address, p_payment_method,
        p_razorpay_payment_id, p_razorpay_order_id,
        0, 0, 0, 0, p_coins_used
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

    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_subtotal,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;
