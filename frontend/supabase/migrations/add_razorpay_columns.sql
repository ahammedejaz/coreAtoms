-- Razorpay payment gateway support
-- Adds payment tracking columns to orders table

-- 1. Add payment method column (defaults to 'cod' for existing orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';

-- 2. Add Razorpay payment ID for prepaid orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- 3. Add Razorpay order ID for tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

-- 4. Insert the razorpay_enabled setting (default OFF)
INSERT INTO app_settings (key, value)
VALUES ('razorpay_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Create the place_order_prepaid RPC
--    This mirrors place_order_cod but includes payment details.
--    Adjust the function body to match your existing place_order_cod logic.
CREATE OR REPLACE FUNCTION place_order_prepaid(
    p_user_id UUID,
    p_address JSONB,
    p_items JSONB,
    p_payment_method TEXT DEFAULT 'prepaid',
    p_razorpay_payment_id TEXT DEFAULT NULL,
    p_razorpay_order_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_qty INT;
    v_unit_price NUMERIC;
    v_stock INT;
BEGIN
    -- Create the order
    INSERT INTO orders (
        user_id,
        status,
        shipping_name,
        shipping_phone,
        shipping_address_1,
        shipping_address_2,
        shipping_city,
        shipping_state,
        shipping_pincode,
        shipping_country,
        payment_method,
        razorpay_payment_id,
        razorpay_order_id
    ) VALUES (
        p_user_id,
        'placed',
        p_address->>'fullName',
        p_address->>'phone',
        p_address->>'line1',
        p_address->>'line2',
        p_address->>'city',
        p_address->>'state',
        p_address->>'pincode',
        'India',
        p_payment_method,
        p_razorpay_payment_id,
        p_razorpay_order_id
    ) RETURNING id INTO v_order_id;

    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        -- Check stock
        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL THEN
            RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;
        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
        END IF;

        -- Deduct stock
        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        -- Insert order item
        INSERT INTO order_items (order_id, product_id, variant_id, qty, unit_price_inr)
        VALUES (v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price);
    END LOOP;

    RETURN v_order_id;
END;
$$;

