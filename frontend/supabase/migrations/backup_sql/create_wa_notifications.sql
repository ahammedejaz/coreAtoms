-- Drop existing table and policies if they exist
DROP TABLE IF EXISTS wa_notifications CASCADE;

-- WhatsApp notification tracking table
CREATE TABLE wa_notifications (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status        TEXT NOT NULL,
    phone         TEXT,
    customer_name TEXT,
    sent_by       TEXT,
    sent_at       TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),

    UNIQUE (order_id, status)
);

CREATE INDEX idx_wa_notifications_order_id ON wa_notifications(order_id);

ALTER TABLE wa_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read wa_notifications"
    ON wa_notifications FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can insert wa_notifications"
    ON wa_notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);
