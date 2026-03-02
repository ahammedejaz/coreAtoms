-- ============================================================
--  Failed Order Tracking
--
--  RPC: log_failed_order — inserts a minimal order record with
--  status = 'payment_failed'. Called client-side when Razorpay
--  payment is authorised but verification/order-creation fails,
--  ensuring no order is silently lost.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_failed_order(
    p_user_id    UUID,
    p_address    JSONB    DEFAULT NULL,
    p_items      JSONB    DEFAULT '[]'::JSONB,
    p_reason     TEXT     DEFAULT 'Payment failed',
    p_shipping   NUMERIC  DEFAULT 0,
    p_gst        NUMERIC  DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_item     JSONB;
    v_subtotal NUMERIC := 0;
    v_count    INT     := 0;
BEGIN
    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used
    ) VALUES (
        p_user_id,
        'payment_failed',
        COALESCE(p_address, '{}'::JSONB),
        'prepaid',
        0,
        0,
        0,
        COALESCE(p_shipping, 0),
        COALESCE(p_gst, 0),
        0,
        0
    ) RETURNING id INTO v_order_id;

    -- Log items if provided
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        DECLARE
            v_qty        INT     := COALESCE((v_item->>'qty')::INT, 0);
            v_price      NUMERIC := COALESCE((v_item->>'unit_price_inr')::NUMERIC, 0);
            v_product_id UUID;
        BEGIN
            BEGIN
                v_product_id := (v_item->>'product_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;

            INSERT INTO order_items (
                order_id, product_id, product_name,
                qty, unit_price_inr, line_total_inr, image_url
            ) VALUES (
                v_order_id, v_product_id, COALESCE(v_item->>'product_name', ''),
                v_qty, v_price, v_qty * v_price, COALESCE(v_item->>'image_url', '')
            );

            v_subtotal := v_subtotal + (v_qty * v_price);
            v_count    := v_count + v_qty;
        END;
    END LOOP;

    UPDATE orders
      SET subtotal         = v_subtotal,
          total_amount_inr = GREATEST(0, v_subtotal + COALESCE(p_shipping, 0) + COALESCE(p_gst, 0)),
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
