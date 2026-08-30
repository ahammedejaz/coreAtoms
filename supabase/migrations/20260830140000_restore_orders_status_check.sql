-- ============================================================================
-- Restore the orders.status CHECK constraint — 30 Aug 2026
--
-- Production had no CHECK on orders.status at all (pg_constraint returned
-- nothing for contype='c'), so any string could be written. master_schema.sql
-- still declared a six-value CHECK that was missing two statuses the app
-- actually writes, which is presumably why the constraint was dropped by hand
-- at some point rather than corrected.
--
-- The list below is the union of every status the code can write:
--   placed            — RPC default on order creation
--   confirmed         — labelled in MyOrders, mapped to the "Placed" timeline
--                       step, and notified on by send-order-notification
--   processing        — admin dropdown; Delhivery "picked_up" sync
--   shipped           — admin dropdown; Delhivery "in_transit" sync
--   out_for_delivery  — admin dropdown; Delhivery sync
--   delivered         — admin dropdown; Delhivery sync
--   cancelled         — cancel_order RPC; admin dropdown; Delhivery RTO sync
--   payment_failed    — log_failed_order RPC
--
-- Existing data is entirely within this set (cancelled 43, delivered 30,
-- placed 8, shipped 6, processing 2), so the constraint validates as-is.
-- ============================================================================

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check CHECK (status IN (
        'placed',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'payment_failed'
    ));
