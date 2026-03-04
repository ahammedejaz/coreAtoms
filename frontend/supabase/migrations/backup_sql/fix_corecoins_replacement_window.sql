-- ============================================================
--  CoreCoins — Replacement Window Fix
--
--  Logic:
--    - If replacements DISABLED → credit coins immediately on delivery
--    - If replacements ENABLED  → defer credit until 1 day after delivery
--      (uses a pg_cron daily job to pick up deferred credits)
--
--  Steps:
--    1. Add coins_credited column to orders
--    2. Update trigger (immediate credit only when replacements off)
--    3. Create helper function for deferred crediting
--    4. Schedule pg_cron job (runs daily at 02:00 IST)
--
--  PREREQUISITE: Enable pg_cron extension in Supabase Dashboard
--    → Database → Extensions → search "pg_cron" → Enable
-- ============================================================


-- 1. Track whether coins have been credited for each order
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coins_credited BOOLEAN NOT NULL DEFAULT false;


-- 2. Updated on-delivery trigger
--    Credits immediately ONLY when replacements are disabled.
--    When replacements are enabled, leaves coins_credited = false
--    for the cron job to handle after 1 day.
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled          BOOLEAN;
  v_replacements_on  BOOLEAN;
  v_config           JSONB;
  v_earn_rate        NUMERIC;
  v_earn_per         NUMERIC;
  v_coin_value       NUMERIC;
  v_net_paid         NUMERIC;
  v_coins            INTEGER;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- CoreCoins enabled?
  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Replacements enabled? If yes, defer to cron — do nothing now.
  SELECT (value->>'enabled')::boolean INTO v_replacements_on
    FROM app_settings WHERE key = 'replacements_enabled';
  IF COALESCE(v_replacements_on, false) THEN
    -- Coins will be credited by the daily cron after 1-day window
    RETURN NEW;
  END IF;

  -- Replacements disabled → credit immediately
  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  -- Net cash paid (excludes the portion paid with coins)
  v_net_paid := COALESCE(NEW.total_amount_inr, 0)
              - (COALESCE(NEW.coins_used, 0) * v_coin_value);

  IF v_net_paid <= 0 THEN RETURN NEW; END IF;

  v_coins := FLOOR(v_net_paid / v_earn_per) * v_earn_rate;
  IF v_coins <= 0 THEN RETURN NEW; END IF;

  INSERT INTO corecoins_wallet (user_id, balance, updated_at)
    VALUES (NEW.user_id, v_coins, now())
    ON CONFLICT (user_id)
    DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                  updated_at = now();

  -- Mark as credited so the cron doesn't double-credit
  NEW.coins_credited := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reattach trigger
DROP TRIGGER IF EXISTS trg_credit_corecoins ON orders;
CREATE TRIGGER trg_credit_corecoins
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_corecoins();


-- 3. Deferred crediting function — called by cron
--    Credits coins for delivered orders where:
--      • coins_credited = false
--      • delivered_at is at least 1 day ago (replacement window closed)
--      • no pending/approved replacement request exists
CREATE OR REPLACE FUNCTION public.credit_corecoins_after_window()
RETURNS void AS $$
DECLARE
  v_enabled    BOOLEAN;
  v_config     JSONB;
  v_earn_rate  NUMERIC;
  v_earn_per   NUMERIC;
  v_coin_value NUMERIC;
  v_net_paid   NUMERIC;
  v_coins      INTEGER;
  v_order      RECORD;
BEGIN
  -- CoreCoins enabled?
  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN RETURN; END IF;

  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  FOR v_order IN
    SELECT o.id, o.user_id, o.total_amount_inr, o.coins_used
      FROM orders o
      WHERE o.status = 'delivered'
        AND o.coins_credited = false
        AND o.user_id IS NOT NULL
        -- 1-day replacement window has passed
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at < now() - interval '1 day'
        -- No active replacement for this order
        AND NOT EXISTS (
          SELECT 1 FROM replacements r
            WHERE r.order_id = o.id
              AND r.status NOT IN ('rejected')
        )
  LOOP
    v_net_paid := COALESCE(v_order.total_amount_inr, 0)
                - (COALESCE(v_order.coins_used, 0) * v_coin_value);

    IF v_net_paid <= 0 THEN CONTINUE; END IF;

    v_coins := FLOOR(v_net_paid / v_earn_per) * v_earn_rate;
    IF v_coins <= 0 THEN CONTINUE; END IF;

    INSERT INTO corecoins_wallet (user_id, balance, updated_at)
      VALUES (v_order.user_id, v_coins, now())
      ON CONFLICT (user_id)
      DO UPDATE SET balance    = corecoins_wallet.balance + v_coins,
                    updated_at = now();

    UPDATE orders SET coins_credited = true WHERE id = v_order.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Schedule the cron job — run this SEPARATELY after enabling pg_cron:
--    Dashboard → Database → Extensions → search "pg_cron" → Enable
--    Then run in SQL Editor:
--
-- SELECT cron.schedule(
--   'credit-corecoins-after-window',
--   '0 2 * * *',
--   $$SELECT public.credit_corecoins_after_window();$$
-- );

