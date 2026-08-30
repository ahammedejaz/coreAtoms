/**
 * send-order-notification — Supabase Edge Function
 *
 * Called by a Database Webhook when `orders.status` changes.
 * Looks up the user's Expo push tokens from `push_tokens` table
 * and sends a push notification via Expo Push API.
 *
 * Deploy: supabase functions deploy send-order-notification
 *
 * Database Webhook config in Supabase Dashboard:
 *   Table: orders | Events: UPDATE | Target: this function
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Status → notification content mapping
const STATUS_MESSAGES: Record<string, { title: string; body: string; emoji: string }> = {
  confirmed: {
    title: 'Order Confirmed ✅',
    body: 'Your order has been confirmed and is being prepared.',
    emoji: '✅',
  },
  processing: {
    title: 'Order Processing ⚙️',
    body: 'Your order is being processed.',
    emoji: '⚙️',
  },
  shipped: {
    title: 'Order Shipped 🚚',
    body: 'Your order is on its way!',
    emoji: '🚚',
  },
  out_for_delivery: {
    title: 'Out for Delivery 📦',
    body: 'Your order is out for delivery. Stay tuned!',
    emoji: '📦',
  },
  delivered: {
    title: 'Order Delivered 🎉',
    body: 'Your order has been delivered. Enjoy!',
    emoji: '🎉',
  },
  cancelled: {
    title: 'Order Cancelled ❌',
    body: 'Your order has been cancelled.',
    emoji: '❌',
  },
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Webhook payload structure: { type, table, schema, record, old_record }
    const { record, old_record } = payload;

    if (!record || !old_record) {
      return new Response(JSON.stringify({ message: 'No record data' }), { status: 200 });
    }

    // Only send when status actually changed
    if (record.status === old_record.status) {
      return new Response(JSON.stringify({ message: 'Status unchanged' }), { status: 200 });
    }

    const newStatus = record.status;
    const userId = record.user_id;
    const orderId = String(record.id).slice(0, 8).toUpperCase();

    // Check if we have a message for this status
    const msgConfig = STATUS_MESSAGES[newStatus];
    if (!msgConfig) {
      return new Response(JSON.stringify({ message: `No notification for status: ${newStatus}` }), { status: 200 });
    }

    // Init Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's push tokens
    const { data: tokens, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId);

    if (tokenErr || !tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found', error: tokenErr?.message }),
        { status: 200 }
      );
    }

    // Build Expo push messages
    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: msgConfig.title,
      body: `${msgConfig.body} (Order #${orderId})`,
      data: {
        screen: 'OrdersTab',
        orderId: record.id,
        status: newStatus,
      },
      channelId: 'orders', // Android channel
    }));

    // Send via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    return new Response(
      JSON.stringify({
        message: `Sent ${messages.length} notification(s) for status: ${newStatus}`,
        result: pushResult,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
