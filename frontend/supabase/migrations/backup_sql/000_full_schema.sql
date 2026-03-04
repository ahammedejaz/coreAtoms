-- ============================================================
--  CORE ATOMS — Full Database Schema
--  This file contains ALL tables required by the application.
--
--  Run Order:
--    1. This file (creates all tables, indexes, RLS, triggers, RPCs)
--
--  Prerequisites:
--    - Supabase project with auth enabled
--    - Storage buckets: hero-images, product-images, replacement-images
--
--  Last updated: 2026-02-28
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  1. profiles — mirrors auth.users, stores role + display name
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       text,
    full_name   text,
    role        text NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  2. products — product catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                text NOT NULL,
    sku                 text UNIQUE,
    category            text,
    description         text,
    price_inr           numeric(10,2) NOT NULL DEFAULT 0,
    stock_qty           integer NOT NULL DEFAULT 0,
    image_url           text,
    image_position      text DEFAULT '50% 50%',   -- CSS objectPosition for card display
    is_active           boolean NOT NULL DEFAULT true,
    about_text          text,
    best_for            text,
    pairs_well_with     text,
    recommended_stack   text,
    highlights          jsonb,                     -- text[] stored as jsonb e.g. ["Clean label","Lab-tested"]
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  3. product_images — gallery images per product
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url   text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  4. product_variants — size / pack variants per product
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    label       text NOT NULL,              -- e.g. "60 caps", "90 caps"
    price_inr   numeric(10,2) NOT NULL DEFAULT 0,
    stock_qty   integer NOT NULL DEFAULT 0,
    sku         text,
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  5. product_reviews — customer reviews (1–5 stars)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id    uuid,                       -- FK added after orders table creation
    rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       text,
    body        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  6. orders — customer orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status              text NOT NULL DEFAULT 'placed',
                        -- 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    total_amount_inr    numeric(10,2) NOT NULL DEFAULT 0,
    total_items         integer NOT NULL DEFAULT 0,

    -- Shipping address (snapshot at time of order)
    shipping_name       text,
    shipping_phone      text,
    shipping_address_1  text,
    shipping_address_2  text,
    shipping_city       text,
    shipping_state      text,
    shipping_pincode    text,
    shipping_country    text DEFAULT 'India',

    -- Payment
    payment_method      text NOT NULL DEFAULT 'cod',  -- 'cod' | 'prepaid'
    razorpay_payment_id text,
    razorpay_order_id   text,

    -- Delhivery shipping
    delhivery_waybill   text,
    courier_name        text DEFAULT 'Delhivery',
    tracking_url        text,
    shipped_at          timestamptz,
    delivered_at        timestamptz,

    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Add FK from product_reviews to orders (after orders table exists)
ALTER TABLE public.product_reviews
    ADD CONSTRAINT fk_product_reviews_order
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- ============================================================
--  7. order_items — line items per order
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id      uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name    text NOT NULL,              -- snapshot at time of order
    variant_label   text,
    qty             integer NOT NULL DEFAULT 1,
    unit_price_inr  numeric(10,2) NOT NULL,
    line_total_inr  numeric(10,2) GENERATED ALWAYS AS (qty * unit_price_inr) STORED,
    image_url       text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  8. addresses — saved delivery addresses per user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.addresses (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text NOT NULL,
    phone       text NOT NULL,
    line1       text NOT NULL,
    line2       text,
    city        text NOT NULL,
    state       text NOT NULL,
    pincode     text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  9. replacements — replacement/return requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.replacements (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id                uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason                  text NOT NULL,      -- e.g. "Damaged in transit"
    description             text,               -- Customer's detailed description
    images                  text[] DEFAULT '{}', -- Array of Storage URLs
    status                  text NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'pickup_scheduled',
            'pickup_received',
            'replacement_shipped',
            'rejected'
        )),
    admin_notes             text,
    replacement_waybill     text,
    replacement_tracking_url text,
    reverse_waybill         text,
    reverse_tracking_url    text,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- ============================================================
-- 10. app_settings — key-value config store (jsonb values)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '""',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. wa_notifications — WhatsApp notification tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_notifications (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status        text NOT NULL,
    phone         text,
    customer_name text,
    sent_by       text,
    sent_at       timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
    UNIQUE (order_id, status)
);


-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category         ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active        ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_images_product    ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product  ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user               ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status             ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill  ON public.orders(delhivery_waybill)
    WHERE delhivery_waybill IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_order         ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product           ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user              ON public.product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user            ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_replacements_order        ON public.replacements(order_id)
    WHERE status != 'rejected';
CREATE INDEX IF NOT EXISTS idx_replacements_status       ON public.replacements(status);
CREATE INDEX IF NOT EXISTS idx_wa_notifications_order_id ON public.wa_notifications(order_id);


-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_notifications   ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- ── profiles policies ─────────────────────────────────────
CREATE POLICY "Users can read own profile"        ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users can update own profile"      ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin full access to profiles"     ON public.profiles FOR ALL    USING (public.is_admin());

-- ── products policies ─────────────────────────────────────
CREATE POLICY "Anyone can read active products"   ON public.products FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin can manage products"         ON public.products FOR ALL    USING (public.is_admin());

-- ── product_images policies ───────────────────────────────
CREATE POLICY "Anyone can read product images"    ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Admin can manage product images"   ON public.product_images FOR ALL    USING (public.is_admin());

-- ── product_variants policies ─────────────────────────────
CREATE POLICY "Anyone can read variants"          ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Admin can manage variants"         ON public.product_variants FOR ALL    USING (public.is_admin());

-- ── orders policies ───────────────────────────────────────
CREATE POLICY "Users can read own orders"         ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can manage all orders"       ON public.orders FOR ALL    USING (public.is_admin());

-- ── order_items policies ──────────────────────────────────
CREATE POLICY "Users can read own order items"    ON public.order_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "Authenticated can insert order items" ON public.order_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admin can manage all order items"  ON public.order_items FOR ALL USING (public.is_admin());

-- ── product_reviews policies ──────────────────────────────
CREATE POLICY "Anyone can read reviews"           ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated can write reviews"   ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews"      ON public.product_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage reviews"          ON public.product_reviews FOR ALL    USING (public.is_admin());

-- ── app_settings policies ─────────────────────────────────
CREATE POLICY "Anyone can read app settings"      ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage app settings"     ON public.app_settings FOR ALL    USING (public.is_admin());

-- ── addresses policies ────────────────────────────────────
CREATE POLICY "Users can read own addresses"      ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create addresses"        ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses"    ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses"    ON public.addresses FOR DELETE USING (auth.uid() = user_id);

-- ── replacements policies ─────────────────────────────────
CREATE POLICY "Users can view own replacements"   ON public.replacements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create replacements"     ON public.replacements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all replacements"  ON public.replacements FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update replacements"    ON public.replacements FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ── wa_notifications policies ─────────────────────────────
CREATE POLICY "Admins can read wa_notifications"  ON public.wa_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert wa_notifications" ON public.wa_notifications FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
--  TRIGGERS — auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at     BEFORE UPDATE ON public.products     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated_at       BEFORE UPDATE ON public.orders       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_replacements_updated_at BEFORE UPDATE ON public.replacements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
--  TRIGGER — auto-create profile on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
--  RPC: place_order_cod — creates a COD order with stock deduction
-- ============================================================
CREATE OR REPLACE FUNCTION place_order_cod(
    p_user_id UUID,
    p_address JSONB,
    p_items JSONB
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
    INSERT INTO orders (
        user_id, status,
        shipping_name, shipping_phone, shipping_address_1, shipping_address_2,
        shipping_city, shipping_state, shipping_pincode, shipping_country,
        payment_method
    ) VALUES (
        p_user_id, 'placed',
        p_address->>'fullName', p_address->>'phone',
        p_address->>'line1', p_address->>'line2',
        p_address->>'city', p_address->>'state', p_address->>'pincode',
        'India', 'cod'
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;
        INSERT INTO order_items (order_id, product_id, variant_id, qty, unit_price_inr, product_name, image_url)
        VALUES (v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price,
                v_item->>'product_name', v_item->>'image_url');
    END LOOP;

    RETURN v_order_id;
END;
$$;


-- ============================================================
--  RPC: place_order_prepaid — creates a prepaid (Razorpay) order
-- ============================================================
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
    INSERT INTO orders (
        user_id, status,
        shipping_name, shipping_phone, shipping_address_1, shipping_address_2,
        shipping_city, shipping_state, shipping_pincode, shipping_country,
        payment_method, razorpay_payment_id, razorpay_order_id
    ) VALUES (
        p_user_id, 'placed',
        p_address->>'fullName', p_address->>'phone',
        p_address->>'line1', p_address->>'line2',
        p_address->>'city', p_address->>'state', p_address->>'pincode',
        'India', p_payment_method, p_razorpay_payment_id, p_razorpay_order_id
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;
        v_unit_price := (v_item->>'unit_price_inr')::NUMERIC;

        SELECT stock_qty INTO v_stock FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_stock IS NULL THEN RAISE EXCEPTION 'Product % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;
        INSERT INTO order_items (order_id, product_id, variant_id, qty, unit_price_inr, product_name, image_url)
        VALUES (v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price,
                v_item->>'product_name', v_item->>'image_url');
    END LOOP;

    RETURN v_order_id;
END;
$$;


-- ============================================================
--  RPC: cancel_order — cancels an order and restores stock
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id UUID,
    p_user_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Verify the order belongs to the user and is cancellable
    IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE id = p_order_id AND user_id = p_user_id
        AND status IN ('placed', 'processing')
    ) THEN
        RAISE EXCEPTION 'Order not found or cannot be cancelled';
    END IF;

    -- Restore stock for each item
    FOR v_item IN SELECT product_id, qty FROM order_items WHERE order_id = p_order_id LOOP
        UPDATE products SET stock_qty = stock_qty + v_item.qty WHERE id = v_item.product_id;
    END LOOP;

    -- Update order status
    UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;
END;
$$;


-- ============================================================
--  DEFAULT app_settings SEED DATA
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
    ('site_logo',               '""'),
    ('homepage_hero_images',    '[]'),
    ('homepage_hero_copy', '{
        "headline": "Engineered for",
        "headlineAccent": "daily consistency.",
        "body": "Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, and a premium experience from checkout to delivery.",
        "primaryCta": "Shop all products",
        "secondaryCta": "View best sellers",
        "trustIcons": [
            {"icon": "🧪", "label": "Clean labels"},
            {"icon": "🚚", "label": "COD available"},
            {"icon": "📦", "label": "Pan-India delivery"}
        ]
    }'),
    ('homepage_pillars', '[
        {"icon": "✦", "title": "Clean Labels",    "desc": "No fillers, no hidden ingredients. Every formula is fully disclosed."},
        {"icon": "◈", "title": "Lab Tested",      "desc": "Third-party verified for potency, purity, and safety."},
        {"icon": "⬡", "title": "COD Available",   "desc": "Cash on delivery across India. No prepayment required."},
        {"icon": "⌖", "title": "Fast Fulfilment", "desc": "Orders dispatched within 24 hours from our facility."}
    ]'),
    ('homepage_categories', '[
        {"label": "Multivitamins", "emoji": "💊", "category": "General Wellness"},
        {"label": "Joint Support",  "emoji": "🦴", "category": "Joint Support"},
        {"label": "Bone Health",    "emoji": "🧬", "category": "Bone Health"},
        {"label": "Hair & Skin",    "emoji": "✨", "category": "HSN"},
        {"label": "Gut Health",     "emoji": "🌿", "category": "Gut Health"},
        {"label": "Collagen",       "emoji": "🔬", "category": "Collagen"}
    ]'),
    ('homepage_philosophy', '{
        "label": "Our Philosophy",
        "heading": "Built like a system,\nnot a trend.",
        "body": "Each Core Atoms formulation is designed around consistency — functional ingredients, simplified stacks, and structured support for real-world routines. No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.",
        "cta": "Explore the range"
    }'),
    ('homepage_featured_products', '[]'),
    ('razorpay_enabled', '{"enabled": false}'),
    ('cod_enabled', '{"enabled": true}'),
    ('replacements_enabled', '{"enabled": false}'),
    ('shipping_amount', '{"amount": 0}'),
    ('max_order_items', '{"max": 10}'),
    ('discount_codes', '[]')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
--  STORAGE BUCKETS (create manually in Supabase Dashboard)
-- ============================================================
-- Bucket: hero-images       (public: YES, max: 5MB, MIME: image/*)
-- Bucket: product-images    (public: YES, max: 5MB, MIME: image/*)
-- Bucket: replacement-images (public: YES, max: 5MB, MIME: image/jpeg,image/png,image/webp)

-- ============================================================
--  END OF FULL SCHEMA
-- ============================================================
