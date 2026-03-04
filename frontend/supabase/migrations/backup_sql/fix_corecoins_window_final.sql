-- ============================================================
--  CoreCoins — Configurable Replacement Window (Final Fix)
--  No pg_cron needed. Uses lazy-evaluation RPC called from frontend.
--
--  Logic:
--    - replacements DISABLED  → credit coins immediately on delivery
--    - replacements ENABLED   → set coins_credit_after = delivered_at + window_days
--                               frontend calls process_pending_corecoins() on load
--                               which credits any due coins for that user
-- ============================================================

-- 1. Add coins_credit_after column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coins_credit_after TIMESTAMPTZ;

-- 2. Seed window_days into replacements_enabled setting (default 1 day)
UPDATE public.app_settings
  SET value = value || '{"window_days": 1}'::jsonb
  WHERE key = 'replacements_enabled'
    AND NOT (value ? 'window_days');




-- 3. Updated on-delivery trigger
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_cc_enabled    BOOLEAN;
  v_rep_enabled   BOOLEAN;
  v_window_days   INT;
  v_config        JSONB;
  v_earn_rate     NUMERIC;
  v_earn_per      NUMERIC;
  v_coin_value    NUMERIC;
  v_net_paid      NUMERIC;
  v_coins         INTEGER;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Skip if already credited
  IF COALESCE(NEW.coins_credited, false) THEN
    RETURN NEW;
  END IF;

  -- CoreCoins enabled?
  SELECT (value->>'enabled')::boolean INTO v_cc_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_cc_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Replacements enabled?
  SELECT (value->>'enabled')::boolean, COALESCE((value->>'window_days')::int, 1)
    INTO v_rep_enabled, v_window_days
    FROM app_settings WHERE key = 'replacements_enabled';

  IF COALESCE(v_rep_enabled, false) THEN
    -- Defer: set a future timestamp, frontend RPC will credit after window
    NEW.coins_credit_after := now() + (v_window_days::text || ' days')::interval;
    RETURN NEW;
  END IF;

  -- Replacements disabled → credit immediately
  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric, 1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  v_net_paid := COALESCE(NEW.total_amount_inr, 0)
              - (COALESCE(NEW.coins_used, 0) * v_coin_value);

  IF v_net_paid <= 0 THEN RETURN NEW; END IF;

  -- Pro-rated formula: every rupee counts (floor(net_paid * earn_rate / earn_per))
  v_coins := FLOOR(v_net_paid * v_earn_rate / v_earn_per);
  IF v_coins <= 0 THEN RETURN NEW; END IF;

  INSERT INTO corecoins_wallet (user_id, balance, updated_at)
    VALUES (NEW.user_id, v_coins, now())
    ON CONFLICT (user_id)
    DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                  updated_at = now();

  NEW.coins_credited_amount := v_coins;
  NEW.coins_credited        := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_corecoins ON orders;
CREATE TRIGGER trg_credit_corecoins
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_corecoins();


-- 4. RPC: called by MyOrders.jsx on load — credits any pending coins
--    for orders where the replacement window has now closed
CREATE OR REPLACE FUNCTION public.process_pending_corecoins(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_cc_enabled BOOLEAN;
  v_config     JSONB;
  v_earn_rate  NUMERIC;
  v_earn_per   NUMERIC;
  v_coin_value NUMERIC;
  v_net_paid   NUMERIC;
  v_coins      INTEGER;
  v_order      RECORD;
BEGIN
  SELECT (value->>'enabled')::boolean INTO v_cc_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_cc_enabled, false) THEN RETURN; END IF;

  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric, 1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  FOR v_order IN
    SELECT id, user_id, total_amount_inr, coins_used
      FROM orders
      WHERE user_id         = p_user_id
        AND status          = 'delivered'
        AND coins_credited  = false
        AND coins_credit_after IS NOT NULL
        AND coins_credit_after < now()
        -- No active (non-rejected) replacement
        AND NOT EXISTS (
          SELECT 1 FROM replacements r
            WHERE r.order_id = orders.id
              AND r.status NOT IN ('rejected')
        )
  LOOP
    v_net_paid := COALESCE(v_order.total_amount_inr, 0)
                - (COALESCE(v_order.coins_used, 0) * v_coin_value);

    IF v_net_paid <= 0 THEN CONTINUE; END IF;

    -- Pro-rated formula
    v_coins := FLOOR(v_net_paid * v_earn_rate / v_earn_per);
    IF v_coins <= 0 THEN CONTINUE; END IF;

    INSERT INTO corecoins_wallet (user_id, balance, updated_at)
      VALUES (v_order.user_id, v_coins, now())
      ON CONFLICT (user_id)
      DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                    updated_at = now();

    UPDATE orders
      SET coins_credited        = true,
          coins_credited_amount = v_coins
      WHERE id = v_order.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
