-- Order Status Push Notification Webhook Trigger
-- Uses pg_net to call the send-order-notification Edge Function
-- when order status changes.

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  edge_function_url TEXT;
BEGIN
  -- Only fire when status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'orders',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb,
      'old_record', row_to_json(OLD)::jsonb
    );

    edge_function_url := 'https://yghqsrcmqvcwazksrxlk.supabase.co/functions/v1/send-order-notification';

    -- Async HTTP call via pg_net (non-blocking)
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_status_push_notification ON orders;
CREATE TRIGGER trg_order_status_push_notification
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();
