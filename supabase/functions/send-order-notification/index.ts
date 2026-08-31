/**
 * send-order-notification — Supabase Edge Function
 *
 * Called by the `trg_order_status_push_notification` trigger on `orders` (via
 * pg_net) when `orders.status` changes. Looks up the user's Expo push tokens
 * and sends a notification.
 *
 * AUTHENTICATION
 * --------------
 * This function has `verify_jwt: false` at the gateway so the database trigger
 * can reach it, which means anyone on the internet can POST to it. Two checks
 * stand between that and a customer's lock screen:
 *
 *   1. `x-notify-secret` must match the `order_notify_secret` Vault secret. The
 *      comparison happens inside Postgres via `verify_notify_secret`, so the
 *      secret is never held in this function's memory or its environment.
 *   2. The order is re-read from the database and the stored owner and status
 *      are used. The request body supplies identifiers, never content — a
 *      replayed body can at most re-send a notification that already matches
 *      reality, addressed to the real owner.
 *
 * The previous version passed `current_setting('supabase.service_role_key')` as
 * a bearer token. That GUC is not set on Supabase, so the header was literally
 * null and the endpoint was open.
 *
 * Deploy: supabase functions deploy send-order-notification
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Status → notification content mapping
const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed: {
    title: 'Order Confirmed ✅',
    body: 'Your order has been confirmed and is being prepared.',
  },
  processing: {
    title: 'Order Processing ⚙️',
    body: 'Your order is being processed.',
  },
  shipped: {
    title: 'Order Shipped 🚚',
    body: 'Your order is on its way!',
  },
  out_for_delivery: {
    title: 'Out for Delivery 📦',
    body: 'Your order is out for delivery. Stay tuned!',
  },
  delivered: {
    title: 'Order Delivered 🎉',
    body: 'Your order has been delivered. Enjoy!',
  },
  cancelled: {
    title: 'Order Cancelled ❌',
    body: 'Your order has been cancelled.',
  },
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials are not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Prove the caller is the database trigger ──
    const presented = req.headers.get('x-notify-secret') || '';
    const { data: secretOk, error: secretErr } = await supabase.rpc(
      'verify_notify_secret',
      { p_secret: presented },
    );
    if (secretErr) {
      console.error('Secret verification failed:', secretErr.message);
      return json({ error: 'Unauthorized' }, 401);
    }
    if (secretOk !== true) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Read the identifiers off the payload ──
    let payload: { record?: { id?: string; status?: string } };
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const orderId = payload?.record?.id;
    const claimedStatus = payload?.record?.status;
    if (!orderId || !claimedStatus) {
      return json({ message: 'No record data' }, 200);
    }

    // ── 3. Trust the database, not the body ──
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id,user_id,status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return json({ message: 'Order not found', error: orderErr?.message }, 200);
    }

    if (order.status !== claimedStatus) {
      return json({ message: 'Payload status does not match stored order status' }, 200);
    }

    const msgConfig = STATUS_MESSAGES[order.status];
    if (!msgConfig) {
      return json({ message: `No notification for status: ${order.status}` }, 200);
    }

    const shortId = String(order.id).slice(0, 8).toUpperCase();

    // ── 4. Send ──
    const { data: tokens, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', order.user_id);

    if (tokenErr) {
      console.error('Push token lookup failed:', tokenErr.message);
      return json({ message: 'Could not read push tokens' }, 200);
    }
    if (!tokens?.length) {
      return json({ message: 'No push tokens found' }, 200);
    }

    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: msgConfig.title,
      body: `${msgConfig.body} (Order #${shortId})`,
      data: {
        screen: 'OrdersTab',
        orderId: order.id,
        status: order.status,
      },
      channelId: 'orders', // Android channel
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    return json(
      {
        message: `Sent ${messages.length} notification(s) for status: ${order.status}`,
        result: pushResult,
      },
      200,
    );
  } catch (err) {
    console.error('Push notification error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
