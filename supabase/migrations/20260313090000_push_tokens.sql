-- ============================================================
-- Push Notification Tokens — Migration Script
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

-- 2. Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Users can only manage their own tokens
CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Service role (Edge Functions) can read all tokens
-- This is needed for the send-order-notification function
CREATE POLICY "Service role reads all tokens"
  ON push_tokens FOR SELECT
  USING (auth.role() = 'service_role');

-- 5. Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON push_tokens(user_id);

-- 6. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_timestamp();

-- ============================================================
-- After running this SQL, set up the Database Webhook:
--
-- 1. Go to Supabase Dashboard → Database → Webhooks
-- 2. Create new webhook:
--    - Name: order-status-push-notification
--    - Table: orders
--    - Events: UPDATE
--    - Type: Supabase Edge Function
--    - Function: send-order-notification
--    - HTTP Headers: (none needed, uses service role automatically)
-- ============================================================
