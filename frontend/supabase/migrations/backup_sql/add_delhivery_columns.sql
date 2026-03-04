-- Delhivery Shipping Integration — Migration
-- Run this in Supabase SQL Editor to add shipping columns to the orders table.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_waybill TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name TEXT DEFAULT 'Delhivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Index for quick waybill lookups
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill ON orders (delhivery_waybill)
  WHERE delhivery_waybill IS NOT NULL;

COMMENT ON COLUMN orders.delhivery_waybill IS 'Waybill number from Delhivery';
COMMENT ON COLUMN orders.courier_name IS 'Courier partner name (default: Delhivery)';
COMMENT ON COLUMN orders.tracking_url IS 'Public tracking URL for the customer';
COMMENT ON COLUMN orders.shipped_at IS 'Timestamp when order was shipped';
COMMENT ON COLUMN orders.delivered_at IS 'Timestamp when order was delivered';
