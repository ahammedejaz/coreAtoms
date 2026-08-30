-- Enable Supabase Realtime replication for products and orders tables.
-- Without this, postgres_changes events are NOT emitted even if the client subscribes.

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
