-- ============================================================
--  CoreCoins — No-Cron Replacement Window Fix
--
--  Strategy (no pg_cron needed):
--    1. Credit coins immediately on delivery (always)
--    2. If customer files a replacement → deduct coins automatically
--    3. If replacement is rejected → re-credit coins automatically
--    4. If replacement is resolved/completed → coins stay deducted
--
--  This is real-time and requires no scheduled jobs.
-- ============================================================


-- 1. Add coins_credited_amount to track how much was credited per order
--    (so we know exactly how much to deduct/re-credit if replacement filed)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coins_credited_amount INTEGER NOT NULL DEFAULT 0;


-- 2. Restore immediate crediting trigger (credits on delivery, always)
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled    BOOLEAN;
  v_config     JSONB;
  v_earn_rate  NUMERIC;
  v_earn_per   NUMERIC;
  v_coin_value NUMERIC;
  v_net_paid   NUMERIC;
  v_coins      INTEGER;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Skip if already credited (idempotent)
  IF COALESCE(NEW.coins_credited, false) THEN
    RETURN NEW;
  END IF;

  -- CoreCoins enabled?
  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_config
    FROM app_settings WHERE key = 'corecoins_config';

  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  1);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  -- Net cash paid (exclude portion paid with coins)
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

  -- Track credited amount and mark order as credited
  NEW.coins_credited_amount := v_coins;
  NEW.coins_credited        := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_corecoins ON orders;
CREATE TRIGGER trg_credit_corecoins
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_corecoins();


-- 3. Trigger: when a replacement is FILED → deduct coins from wallet
--    (replacement window in effect — coins are held back)
CREATE OR REPLACE FUNCTION public.handle_replacement_coins()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled       BOOLEAN;
  v_order         RECORD;
BEGIN
  -- CoreCoins enabled?
  SELECT (value->>'enabled')::boolean INTO v_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_enabled, false) THEN RETURN NEW; END IF;

  -- Get the order
  SELECT user_id, coins_credited, coins_credited_amount
    INTO v_order
    FROM orders WHERE id = NEW.order_id;

  -- On INSERT (replacement filed): deduct coins if they were credited
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(v_order.coins_credited, false) AND v_order.coins_credited_amount > 0 THEN
      UPDATE corecoins_wallet
        SET balance    = GREATEST(0, balance - v_order.coins_credited_amount),
            updated_at = now()
        WHERE user_id = v_order.user_id;

      -- Mark order so we know coins were clawed back
      UPDATE orders SET coins_credited = false WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE (status changed): re-credit if replacement was REJECTED
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    IF NOT COALESCE(v_order.coins_credited, false) AND v_order.coins_credited_amount > 0 THEN
      INSERT INTO corecoins_wallet (user_id, balance, updated_at)
        VALUES (v_order.user_id, v_order.coins_credited_amount, now())
        ON CONFLICT (user_id)
        DO UPDATE SET balance    = corecoins_wallet.balance + v_order.coins_credited_amount,
                      updated_at = now();

      UPDATE orders SET coins_credited = true WHERE id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_replacement_coins_insert ON public.replacements;
CREATE TRIGGER trg_replacement_coins_insert
  AFTER INSERT ON public.replacements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_replacement_coins();

DROP TRIGGER IF EXISTS trg_replacement_coins_update ON public.replacements;
CREATE TRIGGER trg_replacement_coins_update
  AFTER UPDATE ON public.replacements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_replacement_coins();
