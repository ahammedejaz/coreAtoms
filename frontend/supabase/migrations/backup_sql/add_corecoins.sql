-- ============================================================
--  CoreCoins Loyalty Program — FINAL Fixed Migration
--  Based on ACTUAL live DB column inspection.
--
--  orders table columns used:
--    shipping_address (JSONB)  — stores address as-is
--    total_amount_inr          — final total
--    subtotal, shipping        — breakdown
--    total_items               — item count
--  order_items columns:
--    product_name, qty, unit_price_inr, image_url, product_id, variant_id
-- ============================================================


-- ============================================================
--  1. corecoins_wallet — one row per user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.corecoins_wallet (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance     INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT  corecoins_wallet_user_unique UNIQUE (user_id),
    CONSTRAINT  corecoins_balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_corecoins_wallet_user ON public.corecoins_wallet(user_id);

ALTER TABLE public.corecoins_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet"  ON public.corecoins_wallet;
DROP POLICY IF EXISTS "Admin can view all wallets" ON public.corecoins_wallet;

CREATE POLICY "Users can view own wallet"
  ON public.corecoins_wallet FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all wallets"
  ON public.corecoins_wallet FOR SELECT
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_corecoins_wallet_updated_at ON public.corecoins_wallet;
CREATE TRIGGER trg_corecoins_wallet_updated_at
  BEFORE UPDATE ON public.corecoins_wallet
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
--  2. Seed app_settings for CoreCoins
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
    ('corecoins_enabled', '{"enabled": false}'::jsonb),
    ('corecoins_config', '{"earn_rate": 1, "earn_per_rupees": 100, "min_redeem": 100, "coin_value_inr": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
--  3. Trigger: auto-credit CoreCoins when order is delivered
--     Uses total_amount_inr — the real orders column
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_config    JSONB;
  v_earn_rate NUMERIC;
  v_earn_per  NUMERIC;
  v_coins     INTEGER;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate := COALESCE((v_config->>'earn_rate')::numeric, 1);
  v_earn_per  := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);

  v_coins := FLOOR(COALESCE(NEW.total_amount_inr, 0) / v_earn_per) * v_earn_rate;

  IF v_coins <= 0 THEN RETURN NEW; END IF;

  INSERT INTO corecoins_wallet (user_id, balance, updated_at)
    VALUES (NEW.user_id, v_coins, now())
    ON CONFLICT (user_id)
    DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                  updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_corecoins ON orders;
CREATE TRIGGER trg_credit_corecoins
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_corecoins();


-- ============================================================
--  4. Updated place_order_cod — with CoreCoins deduction
--     CORRECT column names from live DB inspection
-- ============================================================
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
    -- Deduct CoreCoins atomically (rolls back if anything below fails)
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

    -- Create order — shipping_address is stored as JSONB blob
    INSERT INTO orders (
        user_id,
        status,
        shipping_address,
        payment_method,
        total_amount_inr,
        subtotal,
        shipping,
        total_items
    ) VALUES (
        p_user_id,
        'placed',
        p_address,
        'cod',
        0, 0, 0, 0
    ) RETURNING id INTO v_order_id;

    -- Insert line items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL  THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty  THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name',
            v_qty,
            v_unit_price,
            v_unit_price * v_qty,
            v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- Update order totals
    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_subtotal,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- ============================================================
--  5. Updated place_order_prepaid — with CoreCoins deduction
--     CORRECT column names from live DB inspection
-- ============================================================
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
    -- Deduct CoreCoins atomically
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

    -- Create order — shipping_address is stored as JSONB blob
    INSERT INTO orders (
        user_id,
        status,
        shipping_address,
        payment_method,
        razorpay_payment_id,
        razorpay_order_id,
        total_amount_inr,
        subtotal,
        shipping,
        total_items
    ) VALUES (
        p_user_id,
        'placed',
        p_address,
        p_payment_method,
        p_razorpay_payment_id,
        p_razorpay_order_id,
        0, 0, 0, 0
    ) RETURNING id INTO v_order_id;

    -- Insert line items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL  THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty  THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name',
            v_qty,
            v_unit_price,
            v_unit_price * v_qty,
            v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- Update order totals
    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = v_subtotal,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;
