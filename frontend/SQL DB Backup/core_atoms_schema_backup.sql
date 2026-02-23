-- ============================================================
--  CORE ATOMS — Complete Database Schema Backup
--  Generated: 2026-02-23
--  Source: Supabase (PostgreSQL)
--  Use this to recreate the entire DB on any PostgreSQL host
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  TABLE: profiles
--  Mirrors auth.users — stores role and display name
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text,
    role        text NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: products
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
--  TABLE: product_images   (extra/gallery images per product)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url   text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: product_variants  (size / pack variants)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    label       text NOT NULL,          -- e.g. "60 caps", "90 caps"
    price_inr   numeric(10,2) NOT NULL DEFAULT 0,
    stock_qty   integer NOT NULL DEFAULT 0,
    sku         text,
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'pending',
                    -- 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    total_inr       numeric(10,2) NOT NULL DEFAULT 0,
    shipping_name   text,
    shipping_phone  text,
    shipping_address text,
    shipping_city   text,
    shipping_state  text,
    shipping_pincode text,
    payment_method  text DEFAULT 'cod',
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id  uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
    name        text NOT NULL,          -- snapshot of name at time of order
    variant_label text,                 -- snapshot of variant label
    price_inr   numeric(10,2) NOT NULL,
    qty         integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: product_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       text,
    body        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  TABLE: app_settings   (key-value store for homepage config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '""',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category       ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active      ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_images_product  ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user             ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order       ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product         ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user            ON public.product_reviews(user_id);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings     ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- ── profiles ────────────────────────────────────────────────
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admin full access to profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- ── products ────────────────────────────────────────────────
CREATE POLICY "Anyone can read active products"
    ON public.products FOR SELECT
    USING (is_active = true OR public.is_admin());

CREATE POLICY "Admin can manage products"
    ON public.products FOR ALL
    USING (public.is_admin());

-- ── product_images ───────────────────────────────────────────
CREATE POLICY "Anyone can read product images"
    ON public.product_images FOR SELECT USING (true);

CREATE POLICY "Admin can manage product images"
    ON public.product_images FOR ALL
    USING (public.is_admin());

-- ── product_variants ─────────────────────────────────────────
CREATE POLICY "Anyone can read variants"
    ON public.product_variants FOR SELECT USING (true);

CREATE POLICY "Admin can manage variants"
    ON public.product_variants FOR ALL
    USING (public.is_admin());

-- ── orders ──────────────────────────────────────────────────
CREATE POLICY "Users can read own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Authenticated users can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all orders"
    ON public.orders FOR ALL
    USING (public.is_admin());

-- ── order_items ──────────────────────────────────────────────
CREATE POLICY "Users can read own order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Authenticated users can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admin can manage all order items"
    ON public.order_items FOR ALL
    USING (public.is_admin());

-- ── product_reviews ──────────────────────────────────────────
CREATE POLICY "Anyone can read reviews"
    ON public.product_reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can write reviews"
    ON public.product_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
    ON public.product_reviews FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage reviews"
    ON public.product_reviews FOR ALL
    USING (public.is_admin());

-- ── app_settings ─────────────────────────────────────────────
CREATE POLICY "Anyone can read app settings"
    ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "Admin can manage app settings"
    ON public.app_settings FOR ALL
    USING (public.is_admin());

-- ============================================================
--  STORAGE BUCKETS  (run in Supabase dashboard or via API)
--  These SQL statements won't work on plain PostgreSQL —
--  they are Supabase-specific. Listed here for reference.
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('hero-images', 'hero-images', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;

-- Storage RLS (Supabase only):
-- CREATE POLICY "Public read hero-images" ON storage.objects FOR SELECT USING (bucket_id = 'hero-images');
-- CREATE POLICY "Admin upload hero-images" ON storage.objects FOR INSERT USING (bucket_id = 'hero-images' AND public.is_admin());
-- CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
-- CREATE POLICY "Admin upload product-images" ON storage.objects FOR INSERT USING (bucket_id = 'product-images' AND public.is_admin());

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
('homepage_featured_products', '[]')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  TRIGGER: auto-update updated_at on row change
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
--  AUTO-CREATE profile on new user signup  (Supabase trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
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
--  END OF SCHEMA
-- ============================================================
