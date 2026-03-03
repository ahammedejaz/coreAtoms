-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║              CORE ATOMS — MASTER DATABASE SCHEMA                        ║
-- ║                                                                          ║
-- ║  This single file is the canonical source of truth for the entire       ║
-- ║  Core Atoms Supabase database schema. It is safe to run repeatedly      ║
-- ║  (all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT).         ║
-- ║                                                                          ║
-- ║  Pre-requisites (do in Supabase Dashboard before running this file):    ║
-- ║    1. Enable Supabase Auth                                               ║
-- ║    2. Create storage buckets:                                            ║
-- ║         - hero-images      (public)                                      ║
-- ║         - product-images   (public)                                      ║
-- ║         - replacement-images (public, 5 MB limit, jpg/png/webp)         ║
-- ║    3. Set up storage polices: SELECT public, INSERT authenticated        ║
-- ║                                                                          ║
-- ║  How to run: Supabase Dashboard → SQL Editor → paste & run              ║
-- ║                                                                          ║
-- ║  Last updated: 2026-03-04                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝


-- ══════════════════════════════════════════════════════════════════════════
--  EXTENSIONS
-- ══════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ══════════════════════════════════════════════════════════════════════════
--  SHARED UTILITY FUNCTION
--  set_updated_at() — auto-updates updated_at on every row UPDATE
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
--  Helper: is_admin() — returns true if the calling user has role = 'admin'
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════
--  1. profiles
--     Mirrors auth.users. Stores role (customer | admin) and display name.
--     Created automatically via a trigger whenever a new user signs up.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       text,
    full_name   text,
    role        text NOT NULL DEFAULT 'customer',   -- 'customer' | 'admin'
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'customer');  -- cannot self-promote to admin
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════════════════
--  1b. admin_users
--     Legacy admin role table. May be used by older parts of the codebase.
--     The canonical admin check is `profiles.role = 'admin'` via is_admin().
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════
--  2. products
--     Main product catalog. Each product can have multiple images, variants,
--     and reviews. The frontend reads is_active to filter visible products.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.products (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                text NOT NULL,
    sku                 text UNIQUE,
    category            text,
    description         text,
    price_inr           numeric(10,2) NOT NULL DEFAULT 0,
    stock_qty           integer NOT NULL DEFAULT 0,
    image_url           text,
    image_position      text DEFAULT '50% 50%',     -- CSS objectPosition on card
    is_active           boolean NOT NULL DEFAULT true,
    about_text          text,                        -- Long-form product description
    best_for            text,
    pairs_well_with     text,
    recommended_stack   text,
    highlights          jsonb,                       -- e.g. ["Clean label","Lab-tested"]
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are publicly readable"  ON public.products;
DROP POLICY IF EXISTS "Only admins can manage products" ON public.products;

CREATE POLICY "Products are publicly readable"  ON public.products FOR SELECT USING (true);
CREATE POLICY "Only admins can manage products" ON public.products FOR ALL   USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_products_category  ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
--  3. product_images
--     Gallery images per product. sort_order controls display order.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_images (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url   text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product images publicly readable"   ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Only admins can manage product imgs" ON public.product_images FOR ALL   USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id);


-- ══════════════════════════════════════════════════════════════════════════
--  4. product_variants
--     Size / pack variants per product. e.g. "60 caps", "90 caps".
--     When a product has variants, the base product price is a display-
--     only "from" price; the actual price comes from the selected variant.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_variants (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    label       text NOT NULL,
    price_inr   numeric(10,2) NOT NULL DEFAULT 0,
    stock_qty   integer NOT NULL DEFAULT 0,
    sku         text,
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variants publicly readable"      ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Only admins can manage variants" ON public.product_variants FOR ALL   USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id);


-- ══════════════════════════════════════════════════════════════════════════
--  5. product_reviews
--     Customer reviews linked to both product and order.
--     reviewerName is stored from the profile at write time.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_id        uuid,                           -- which order this review is for
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_name   text NOT NULL,
    rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           text,
    body            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are publicly readable"       ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add reviews" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews"        ON public.product_reviews FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews"       ON public.product_reviews FOR ALL   USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_reviews_product  ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user     ON public.product_reviews (user_id);


-- ══════════════════════════════════════════════════════════════════════════
--  6a. user_addresses
--     Saved delivery addresses per customer. A customer can save multiple
--     addresses and select one at checkout.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text NOT NULL,
    phone       text NOT NULL,
    line1       text NOT NULL,
    line2       text,
    city        text NOT NULL,
    state       text NOT NULL,
    pincode     text NOT NULL,
    country     text NOT NULL DEFAULT 'India',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own addresses" ON public.user_addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all addresses"  ON public.user_addresses FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON public.user_addresses (user_id);

DROP TRIGGER IF EXISTS trg_user_addresses_updated_at ON public.user_addresses;
CREATE TRIGGER trg_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
--  6b. addresses
--     Alternate addresses table used by early order system.
--     Has phone validation constraint and is_default flag.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.addresses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text NOT NULL,
    phone       text NOT NULL
                CHECK (phone IS NULL OR phone ~ '^(\+91|0)?[6-9][0-9]{9}$'),
    line1       text NOT NULL,
    line2       text,
    city        text NOT NULL,
    state       text NOT NULL,
    pincode     text,
    is_default  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own addresses (addr)" ON public.addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all addresses (addr)"  ON public.addresses FOR SELECT USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
--  7. orders
--     One row per order. Contains full shipping address as JSONB (snapshot
--     at order time), payment method, breakdown amounts, CoreCoins usage,
--     Razorpay IDs, and Delhivery shipping metadata.
--
--  Status flow:
--    placed → processing → shipped → delivered
--    placed / processing → cancelled
--    (payment error) → payment_failed
--
--  Key columns:
--    shipping_address  — JSONB snapshot of delivery address at order time
--    payment_method    — 'cod' | 'prepaid'
--    total_amount_inr  — final amount (items + shipping + gst - coins)
--    subtotal          — items only (pre-charges)
--    shipping_amount   — flat shipping charge applied
--    gst_amount        — GST amount applied
--    coins_used        — CoreCoins used for discount
--    coins_credited    — whether earn coins have been credited after delivery
--    coins_credit_after — timestamp after which coins should be credited
--                         (delivery_date + replacement window)
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.orders (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address_id            uuid REFERENCES public.addresses(id),  -- legacy FK to addresses table
    status                text NOT NULL DEFAULT 'placed'
                          CHECK (status IN ('placed','processing','shipped','delivered','cancelled','payment_failed')),
    shipping_address      jsonb,                                 -- JSONB snapshot (used by checkout)
    payment_method        text NOT NULL DEFAULT 'cod',           -- 'cod' | 'prepaid'
    razorpay_payment_id   text,
    razorpay_order_id     text,
    total_inr             integer NOT NULL DEFAULT 0,            -- legacy integer total
    total_amount          numeric NOT NULL DEFAULT 0,            -- numeric total (legacy)
    total_amount_inr      integer DEFAULT 0,                     -- final amount (items+ship+gst-coins-coupon)
    subtotal              numeric NOT NULL DEFAULT 0,            -- items only
    shipping              numeric NOT NULL DEFAULT 0,            -- legacy column
    shipping_amount       numeric NOT NULL DEFAULT 0,            -- actual shipping charged
    gst_amount            numeric NOT NULL DEFAULT 0,            -- actual GST charged
    total_items           integer NOT NULL DEFAULT 0,
    notes                 text,                                  -- optional order notes
    coins_used            integer NOT NULL DEFAULT 0,
    coins_credited        boolean NOT NULL DEFAULT false,
    coins_credited_amount integer NOT NULL DEFAULT 0,            -- actual coins credited
    coins_credit_after    timestamptz,                           -- credit after replacement window
    delhivery_waybill     text,
    courier_name          text DEFAULT 'Delhivery',
    tracking_url          text,
    shipped_at            timestamptz,
    delivered_at          timestamptz,
    discount_amount       numeric NOT NULL DEFAULT 0,
    coupon_code           text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders"  ON public.orders;
DROP POLICY IF EXISTS "Admins can manage orders"   ON public.orders;

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage orders"  ON public.orders FOR ALL   USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_orders_user_id         ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill ON public.orders (delhivery_waybill)
  WHERE delhivery_waybill IS NOT NULL;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
--  8. order_items
--     Line items for each order. product_name and image_url are snapshotted
--     so they remain accurate even if the product is later edited/deleted.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_items (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id      uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name    text NOT NULL,
    variant_label   text,                     -- snapshot of variant label at order time
    qty             integer NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price_inr  integer NOT NULL DEFAULT 0,
    line_total_inr  integer NOT NULL DEFAULT 0,
    unit_price      numeric NOT NULL DEFAULT 0,  -- numeric price (legacy)
    image_url       text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);


-- ══════════════════════════════════════════════════════════════════════════
--  9. app_settings
--     Key-value store for all admin-configurable settings. Value is always
--     JSONB so each setting can be a primitive, object, or array.
--
--  Known keys (as of 2026-03-02):
--    homepage_hero_images     — [{url, position}]
--    homepage_hero_copy       — {headline, headlineAccent, body, primaryCta, secondaryCta, trustIcons}
--    homepage_pillars         — [{icon, title, desc}]
--    homepage_categories      — [{label, emoji, category}]
--    homepage_philosophy      — {label, heading, body, cta}
--    homepage_featured_products — [product_id, ...]
--    promo_banner             — {enabled, text, link, bgColor, textColor}
--    shipping_amount          — {amount: 0}   (0 = use Delhivery pincode rate)
--    free_shipping_min        — {amount: 0}   (0 = disabled)
--    gst_percentage           — {percentage: 0}
--    razorpay_enabled         — {enabled: false}
--    cod_enabled              — {enabled: true}
--    discount_codes           — [{code, percentage, active, startsAt, endsAt}]
--    replacements_enabled     — {enabled: false, window_days: 1}
--    corecoins_enabled        — {enabled: false}
--    corecoins_config         — {earn_rate: 2, earn_per_rupees: 100, coin_value_inr: 1, min_redeem: 100}
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Granular read policy: sensitive keys require authentication, everything else is public
CREATE POLICY "Public can read non-sensitive app_settings" ON public.app_settings
    FOR SELECT USING (
        key NOT IN ('discount_codes', 'warehouse_address')
        OR auth.uid() IS NOT NULL
    );
CREATE POLICY "Only admins can write app_settings" ON public.app_settings FOR ALL USING (public.is_admin());

-- Seed default settings (do nothing on conflict — preserves existing admin config)
INSERT INTO public.app_settings (key, value) VALUES
  ('shipping_amount',          '{"amount": 0}'::jsonb),
  ('free_shipping_min',        '{"amount": 0}'::jsonb),
  ('gst_percentage',           '{"percentage": 0}'::jsonb),
  ('razorpay_enabled',         '{"enabled": false}'::jsonb),
  ('cod_enabled',              '{"enabled": true}'::jsonb),
  ('discount_codes',           '[]'::jsonb),
  ('replacements_enabled',     '{"enabled": false, "window_days": 1}'::jsonb),
  ('corecoins_enabled',        '{"enabled": false}'::jsonb),
  ('corecoins_config',         '{"earn_rate": 2, "earn_per_rupees": 100, "coin_value_inr": 1, "min_redeem": 100}'::jsonb),
  ('promo_banner',             '{"enabled": false, "text": "", "link": "", "bgColor": "#1e3a5f", "textColor": "#ffffff"}'::jsonb),
  ('max_items_per_order',      '{"n": 15}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
--  10. corecoins_wallet
--      One row per customer. balance is in coins (integer). Cannot go below 0.
--      Coins are earned on delivery, credited after the replacement window.
--      1 coin = ₹1 by default (configurable in corecoins_config).
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.corecoins_wallet (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance     integer NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now(),
    CONSTRAINT corecoins_wallet_user_unique   UNIQUE (user_id),
    CONSTRAINT corecoins_balance_non_negative CHECK (balance >= 0)
);

ALTER TABLE public.corecoins_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet"  ON public.corecoins_wallet;
DROP POLICY IF EXISTS "Admin can view all wallets" ON public.corecoins_wallet;

CREATE POLICY "Users can view own wallet"  ON public.corecoins_wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all wallets" ON public.corecoins_wallet FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_corecoins_wallet_user ON public.corecoins_wallet (user_id);

DROP TRIGGER IF EXISTS trg_corecoins_wallet_updated_at ON public.corecoins_wallet;
CREATE TRIGGER trg_corecoins_wallet_updated_at
  BEFORE UPDATE ON public.corecoins_wallet
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
--  11. replacements
--      One replacement request per order (unique index on order_id when
--      status != 'rejected'). Customers can submit multiple images.
--      Admins can approve/reject and update waybill numbers.
--
--  Status flow: pending → approved → pickup_scheduled → pickup_received
--                       → replacement_shipped
--               pending → rejected
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.replacements (
    id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id                  uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason                    text NOT NULL,
    description               text,
    images                    text[] DEFAULT '{}',
    status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','pickup_scheduled','pickup_received','replacement_shipped','rejected')),
    admin_notes               text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000),
    replacement_waybill       text,
    replacement_tracking_url  text,
    reverse_waybill           text,
    reverse_tracking_url      text,
    created_at                timestamptz DEFAULT now(),
    updated_at                timestamptz DEFAULT now(),
    CONSTRAINT replacements_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- One active (non-rejected) replacement per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_replacements_order
    ON public.replacements (order_id)
    WHERE status != 'rejected';

CREATE INDEX IF NOT EXISTS idx_replacements_status  ON public.replacements (status);
CREATE INDEX IF NOT EXISTS idx_replacements_user    ON public.replacements (user_id);

ALTER TABLE public.replacements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own replacements"   ON public.replacements;
DROP POLICY IF EXISTS "Users can create replacements"     ON public.replacements;
DROP POLICY IF EXISTS "Admins can view all replacements"  ON public.replacements;
DROP POLICY IF EXISTS "Admins can update replacements"    ON public.replacements;

CREATE POLICY "Users can view own replacements"  ON public.replacements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create replacements"    ON public.replacements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all replacements" ON public.replacements FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update replacements"   ON public.replacements FOR UPDATE USING (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
--  place_order_cod
--  Creates a COD order atomically:
--    1. Deducts CoreCoins from wallet (if used)
--    2. Reads app_settings for authoritative GST%, flat shipping rate, and
--       free-shipping threshold — CLIENT-SUPPLIED prices are ignored for GST;
--       shipping is enforced when a flat rate is configured.
--    3. Fetches unit prices from products/variants table (ignores client price)
--    4. Loops items: checks stock → deducts stock → inserts order_items
--    5. Updates final total (subtotal + shipping + gst - coin_discount)
--  Returns: new order UUID
-- ──────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_order_cod(UUID, JSONB, JSONB, INT);

CREATE OR REPLACE FUNCTION public.place_order_cod(
    p_user_id    UUID,
    p_address    JSONB,
    p_items      JSONB,
    p_coins_used  INT     DEFAULT 0,
    p_shipping    NUMERIC DEFAULT 0,  -- used only when flat rate = 0 (pincode mode)
    p_gst         NUMERIC DEFAULT 0, -- IGNORED — GST is recalculated server-side
    p_discount    NUMERIC DEFAULT 0, -- IGNORED — discount is recalculated server-side from coupon
    p_coupon_code TEXT    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id       UUID;
    v_item           JSONB;
    v_product_id     UUID;
    v_variant_id     UUID;
    v_qty            INT;
    v_unit_price     NUMERIC;  -- always fetched from DB, never from client
    v_stock          INT;
    v_subtotal       NUMERIC := 0;
    v_count          INT := 0;
    v_coin_value     NUMERIC;
    v_coin_disc      NUMERIC;
    v_total          NUMERIC;
    -- Authoritative server-side values
    v_flat_shipping  NUMERIC := 0;
    v_free_ship_min  NUMERIC := 0;
    v_gst_pct        NUMERIC := 0;
    v_gst_amount     NUMERIC := 0;
    v_shipping_final NUMERIC := 0;
    -- Server-side coupon validation
    v_discount_codes JSONB;
    v_coupon         JSONB;
    v_coupon_pct     NUMERIC := 0;
    v_discount       NUMERIC := 0;
BEGIN
    -- ── 0. Auth + input sanity guards ─────────────────────────────────────
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot place order for another user';
    END IF;
    IF p_coins_used < 0 THEN RAISE EXCEPTION 'Invalid coins_used value'; END IF;
    IF p_shipping < 0 OR p_shipping > 2000 THEN
        RAISE EXCEPTION 'Shipping amount out of valid range (0–2000)';
    END IF;

    -- ── 1. Load authoritative pricing from app_settings ──────────────────
    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_flat_shipping FROM app_settings WHERE key = 'shipping_amount';
    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_free_ship_min FROM app_settings WHERE key = 'free_shipping_min';
    SELECT COALESCE((value->>'percentage')::numeric, 0)
      INTO v_gst_pct FROM app_settings WHERE key = 'gst_percentage';

    -- ── 2. Deduct CoreCoins if used ───────────────────────────────────────
    IF p_coins_used > 0 THEN
        UPDATE corecoins_wallet
          SET balance    = balance - p_coins_used,
              updated_at = now()
          WHERE user_id = p_user_id
            AND balance >= p_coins_used;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient CoreCoins balance';
        END IF;
    END IF;

    -- ── 3. Server-side coupon validation ───────────────────────────────────
    IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
        SELECT value INTO v_discount_codes FROM app_settings WHERE key = 'discount_codes';
        -- Find matching active coupon in JSONB array
        SELECT elem INTO v_coupon FROM jsonb_array_elements(COALESCE(v_discount_codes, '[]'::jsonb)) AS elem
          WHERE elem->>'code' = UPPER(p_coupon_code) AND (elem->>'active')::boolean = true
          LIMIT 1;
        IF v_coupon IS NOT NULL THEN
            -- Validate schedule (startsAt / endsAt)
            IF v_coupon->>'startsAt' IS NOT NULL AND (v_coupon->>'startsAt')::timestamptz > now() THEN
                v_coupon := NULL;  -- not active yet
            END IF;
            IF v_coupon IS NOT NULL AND v_coupon->>'endsAt' IS NOT NULL AND (v_coupon->>'endsAt')::timestamptz < now() THEN
                v_coupon := NULL;  -- expired
            END IF;
        END IF;
        IF v_coupon IS NOT NULL THEN
            v_coupon_pct := COALESCE((v_coupon->>'percentage')::numeric, 0);
        END IF;
    END IF;

    -- ── 4. Insert order shell (totals updated after item loop) ────────────
    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used, discount_amount, coupon_code
    ) VALUES (
        p_user_id, 'placed', p_address, 'cod',
        0, 0, 0, 0, 0,
        0, p_coins_used, 0, CASE WHEN v_coupon IS NOT NULL THEN p_coupon_code ELSE NULL END
    ) RETURNING id INTO v_order_id;

    -- ── 5. Loop items: fetch DB price → check stock → deduct → insert ─────
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;

        -- Fetch authoritative price from DB (variant preferred, else product)
        IF v_variant_id IS NOT NULL THEN
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM product_variants WHERE id = v_variant_id AND product_id = v_product_id FOR UPDATE;
        ELSE
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM products WHERE id = v_product_id FOR UPDATE;
        END IF;

        IF v_unit_price IS NULL THEN RAISE EXCEPTION 'Product or variant % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        -- Deduct stock from products table
        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name', v_qty, v_unit_price,
            v_unit_price * v_qty, v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- ── 6. Server-side shipping and GST calculation ───────────────────────
    -- Shipping: use flat rate if configured; otherwise accept client's pincode rate
    IF v_flat_shipping > 0 THEN
        v_shipping_final := v_flat_shipping;
    ELSE
        v_shipping_final := GREATEST(0, p_shipping);  -- pincode-based, client-provided
    END IF;
    -- Apply free-shipping threshold
    IF v_free_ship_min > 0 AND v_subtotal >= v_free_ship_min THEN
        v_shipping_final := 0;
    END IF;

    -- GST: always recalculated server-side — client value is ignored
    v_gst_amount := CASE WHEN v_gst_pct > 0
                         THEN ROUND(v_subtotal * v_gst_pct / 100)
                         ELSE 0 END;

    -- ── 7. Coupon discount (server-calculated), coin discount, final total ─
    v_discount := CASE WHEN v_coupon_pct > 0 THEN ROUND(v_subtotal * v_coupon_pct / 100) ELSE 0 END;

    SELECT COALESCE((value->>'coin_value_inr')::numeric, 1) INTO v_coin_value
      FROM app_settings WHERE key = 'corecoins_config';
    v_coin_disc := COALESCE(p_coins_used, 0) * COALESCE(v_coin_value, 1);
    v_total     := GREATEST(0, v_subtotal + v_shipping_final + v_gst_amount - v_coin_disc - v_discount);

    UPDATE orders
      SET subtotal         = v_subtotal,
          shipping_amount  = v_shipping_final,
          shipping         = v_shipping_final,
          gst_amount       = v_gst_amount,
          discount_amount  = v_discount,
          total_amount_inr = v_total,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
--  place_order_prepaid
--  Same as place_order_cod but stores Razorpay payment IDs.
--  Called by the verify-razorpay-payment Edge Function after HMAC verification.
--  Item prices, GST, and flat shipping are all verified server-side.
-- ──────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_order_prepaid(UUID, JSONB, JSONB, TEXT, TEXT, TEXT, INT);

CREATE OR REPLACE FUNCTION public.place_order_prepaid(
    p_user_id             UUID,
    p_address             JSONB,
    p_items               JSONB,
    p_payment_method      TEXT    DEFAULT 'prepaid',
    p_razorpay_payment_id TEXT    DEFAULT NULL,
    p_razorpay_order_id   TEXT    DEFAULT NULL,
    p_coins_used          INT     DEFAULT 0,
    p_shipping            NUMERIC DEFAULT 0,  -- used only when flat rate = 0 (pincode mode)
    p_gst                 NUMERIC DEFAULT 0,  -- IGNORED — GST is recalculated server-side
    p_discount            NUMERIC DEFAULT 0,  -- IGNORED — discount is recalculated server-side from coupon
    p_coupon_code         TEXT    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order_id       UUID;
    v_item           JSONB;
    v_product_id     UUID;
    v_variant_id     UUID;
    v_qty            INT;
    v_unit_price     NUMERIC;  -- always fetched from DB
    v_stock          INT;
    v_subtotal       NUMERIC := 0;
    v_count          INT := 0;
    v_coin_value     NUMERIC;
    v_coin_disc      NUMERIC;
    v_total          NUMERIC;
    -- Authoritative server-side values
    v_flat_shipping  NUMERIC := 0;
    v_free_ship_min  NUMERIC := 0;
    v_gst_pct        NUMERIC := 0;
    v_gst_amount     NUMERIC := 0;
    v_shipping_final NUMERIC := 0;
    -- Server-side coupon validation
    v_discount_codes JSONB;
    v_coupon         JSONB;
    v_coupon_pct     NUMERIC := 0;
    v_discount       NUMERIC := 0;
BEGIN
    -- ── 0. Auth + input sanity guards ─────────────────────────────────────
    -- Allow both direct user calls (auth.uid check) and service-role calls
    -- (auth.uid() is NULL for service-role, so skip check in that case)
    IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot place order for another user';
    END IF;
    IF p_coins_used < 0 THEN RAISE EXCEPTION 'Invalid coins_used value'; END IF;
    IF p_shipping < 0 OR p_shipping > 2000 THEN
        RAISE EXCEPTION 'Shipping amount out of valid range (0–2000)';
    END IF;

    -- ── 1. Load authoritative pricing from app_settings ──────────────────
    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_flat_shipping FROM app_settings WHERE key = 'shipping_amount';
    SELECT COALESCE((value->>'amount')::numeric, 0)
      INTO v_free_ship_min FROM app_settings WHERE key = 'free_shipping_min';
    SELECT COALESCE((value->>'percentage')::numeric, 0)
      INTO v_gst_pct FROM app_settings WHERE key = 'gst_percentage';

    -- ── 2. Deduct CoreCoins if used ───────────────────────────────────────
    IF p_coins_used > 0 THEN
        UPDATE corecoins_wallet
          SET balance    = balance - p_coins_used,
              updated_at = now()
          WHERE user_id = p_user_id
            AND balance >= p_coins_used;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient CoreCoins balance';
        END IF;
    END IF;

    -- ── 3. Server-side coupon validation ───────────────────────────────────
    IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
        SELECT value INTO v_discount_codes FROM app_settings WHERE key = 'discount_codes';
        SELECT elem INTO v_coupon FROM jsonb_array_elements(COALESCE(v_discount_codes, '[]'::jsonb)) AS elem
          WHERE elem->>'code' = UPPER(p_coupon_code) AND (elem->>'active')::boolean = true
          LIMIT 1;
        IF v_coupon IS NOT NULL THEN
            IF v_coupon->>'startsAt' IS NOT NULL AND (v_coupon->>'startsAt')::timestamptz > now() THEN
                v_coupon := NULL;
            END IF;
            IF v_coupon IS NOT NULL AND v_coupon->>'endsAt' IS NOT NULL AND (v_coupon->>'endsAt')::timestamptz < now() THEN
                v_coupon := NULL;
            END IF;
        END IF;
        IF v_coupon IS NOT NULL THEN
            v_coupon_pct := COALESCE((v_coupon->>'percentage')::numeric, 0);
        END IF;
    END IF;

    -- ── 4. Insert order shell ──────────────────────────────────────────
    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        razorpay_payment_id, razorpay_order_id,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used, discount_amount, coupon_code
    ) VALUES (
        p_user_id, 'placed', p_address, p_payment_method,
        p_razorpay_payment_id, p_razorpay_order_id,
        0, 0, 0, 0, 0,
        0, p_coins_used, 0, CASE WHEN v_coupon IS NOT NULL THEN p_coupon_code ELSE NULL END
    ) RETURNING id INTO v_order_id;

    -- ── 5. Loop items: fetch DB price → check stock → deduct → insert ─────
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> ''
                             THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty        := (v_item->>'qty')::INT;

        -- Fetch authoritative price from DB (variant preferred, else product)
        IF v_variant_id IS NOT NULL THEN
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM product_variants WHERE id = v_variant_id AND product_id = v_product_id FOR UPDATE;
        ELSE
            SELECT price_inr, stock_qty INTO v_unit_price, v_stock
              FROM products WHERE id = v_product_id FOR UPDATE;
        END IF;

        IF v_unit_price IS NULL THEN RAISE EXCEPTION 'Product or variant % not found', v_product_id; END IF;
        IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for product %', v_product_id; END IF;

        UPDATE products SET stock_qty = stock_qty - v_qty WHERE id = v_product_id;

        INSERT INTO order_items (
            order_id, product_id, variant_id,
            product_name, qty, unit_price_inr, line_total_inr, image_url
        ) VALUES (
            v_order_id, v_product_id, v_variant_id,
            v_item->>'product_name', v_qty, v_unit_price,
            v_unit_price * v_qty, v_item->>'image_url'
        );

        v_subtotal := v_subtotal + (v_unit_price * v_qty);
        v_count    := v_count + v_qty;
    END LOOP;

    -- ── 6. Server-side shipping and GST ──────────────────────────────────
    IF v_flat_shipping > 0 THEN
        v_shipping_final := v_flat_shipping;
    ELSE
        v_shipping_final := GREATEST(0, p_shipping);  -- pincode-based
    END IF;
    IF v_free_ship_min > 0 AND v_subtotal >= v_free_ship_min THEN
        v_shipping_final := 0;
    END IF;

    v_gst_amount := CASE WHEN v_gst_pct > 0
                         THEN ROUND(v_subtotal * v_gst_pct / 100)
                         ELSE 0 END;

    -- ── 7. Coupon discount (server-calculated), coin discount, final total ─
    v_discount := CASE WHEN v_coupon_pct > 0 THEN ROUND(v_subtotal * v_coupon_pct / 100) ELSE 0 END;

    SELECT COALESCE((value->>'coin_value_inr')::numeric, 1) INTO v_coin_value
      FROM app_settings WHERE key = 'corecoins_config';
    v_coin_disc := COALESCE(p_coins_used, 0) * COALESCE(v_coin_value, 1);
    v_total     := GREATEST(0, v_subtotal + v_shipping_final + v_gst_amount - v_coin_disc - v_discount);

    UPDATE orders
      SET subtotal         = v_subtotal,
          shipping_amount  = v_shipping_final,
          shipping         = v_shipping_final,
          gst_amount       = v_gst_amount,
          discount_amount  = v_discount,
          total_amount_inr = v_total,
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
--  log_failed_order
--  Creates a minimal order record with status = 'payment_failed'.
--  Called client-side when Razorpay payment is authorised by the gateway
--  but order creation/verification fails, ensuring no transaction is lost.
-- ──────────────────────────────────────────────────────────────────────────
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
    -- Security: ensure callers can only log their own failed orders
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot log order for another user';
    END IF;

    INSERT INTO orders (
        user_id, status, shipping_address, payment_method,
        total_amount_inr, subtotal, shipping, shipping_amount, gst_amount,
        total_items, coins_used
    ) VALUES (
        p_user_id, 'payment_failed', COALESCE(p_address, '{}'::JSONB), 'prepaid',
        0, 0, 0, COALESCE(p_shipping, 0), COALESCE(p_gst, 0),
        0, 0
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        DECLARE
            v_qty        INT     := COALESCE((v_item->>'qty')::INT, 0);
            v_price      NUMERIC := COALESCE((v_item->>'unit_price_inr')::NUMERIC, 0);
            v_product_id UUID;
        BEGIN
            BEGIN v_product_id := (v_item->>'product_id')::UUID;
            EXCEPTION WHEN OTHERS THEN CONTINUE; END;

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
          total_amount_inr = GREATEST(0, v_subtotal + COALESCE(p_shipping,0) + COALESCE(p_gst,0)),
          total_items      = v_count
      WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
--  credit_corecoins  (trigger function)
--  Fires BEFORE UPDATE on orders when status changes to 'delivered'.
--  Uses BEFORE trigger so we can modify NEW directly (avoids "tuple already
--  modified" error that AFTER triggers cause when UPDATEing the same row).
--  - If replacements are DISABLED: credits coins immediately
--  - If replacements are ENABLED:  sets coins_credit_after = delivered_at + window
--    If window_minutes > 0, uses minutes (for testing). Otherwise uses window_days.
--    (frontend calls process_pending_corecoins() on load to pick these up)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_corecoins()
RETURNS TRIGGER AS $$
DECLARE
  v_cc_enabled    BOOLEAN;
  v_rep_enabled   BOOLEAN;
  v_window_days   INT;
  v_window_mins   INT;
  v_config        JSONB;
  v_earn_rate     NUMERIC;
  v_earn_per      NUMERIC;
  v_coin_value    NUMERIC;
  v_net_paid      NUMERIC;
  v_coins         INTEGER;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.coins_credited, false) THEN RETURN NEW; END IF;

  SELECT (value->>'enabled')::boolean INTO v_cc_enabled
    FROM app_settings WHERE key = 'corecoins_enabled';
  IF NOT COALESCE(v_cc_enabled, false) THEN RETURN NEW; END IF;

  SELECT (value->>'enabled')::boolean, COALESCE((value->>'window_days')::int, 1), COALESCE((value->>'window_minutes')::int, 0)
    INTO v_rep_enabled, v_window_days, v_window_mins
    FROM app_settings WHERE key = 'replacements_enabled';

  SELECT value INTO v_config FROM app_settings WHERE key = 'corecoins_config';
  v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  2);
  v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
  v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

  -- Net amount paid = total paid by customer + coin value they 'spent' from wallet
  v_net_paid := COALESCE(NEW.total_amount_inr, 0) + COALESCE(NEW.coins_used, 0) * v_coin_value;
  v_coins    := FLOOR((v_net_paid / v_earn_per) * v_earn_rate)::integer;

  IF v_coins <= 0 THEN RETURN NEW; END IF;

  IF COALESCE(v_rep_enabled, false) AND (v_window_days > 0 OR v_window_mins > 0) THEN
    -- Defer crediting until after replacement window
    -- Modify NEW directly (BEFORE trigger) — no separate UPDATE needed
    NEW.coins_credit_after := COALESCE(NEW.delivered_at, now()) +
          CASE WHEN v_window_mins > 0 THEN (v_window_mins || ' minutes')::interval
               ELSE (v_window_days || ' days')::interval END;
    NEW.coins_credited := false;
  ELSE
    -- Credit immediately
    INSERT INTO corecoins_wallet (user_id, balance)
      VALUES (NEW.user_id, v_coins)
      ON CONFLICT (user_id) DO UPDATE SET balance = corecoins_wallet.balance + v_coins, updated_at = now();
    NEW.coins_credited := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_corecoins ON public.orders;
CREATE TRIGGER trg_credit_corecoins
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_corecoins();


-- ──────────────────────────────────────────────────────────────────────────
--  process_pending_corecoins
--  Called from the frontend (MyOrders.jsx) on page load for the logged-in
--  user. Credits any orders where coins_credit_after <= now().
--  This pattern avoids the need for pg_cron.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_pending_corecoins(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_order    RECORD;
    v_config   JSONB;
    v_earn_rate  NUMERIC;
    v_earn_per   NUMERIC;
    v_coin_value NUMERIC;
    v_net_paid   NUMERIC;
    v_coins      INTEGER;
    v_total      INTEGER := 0;
BEGIN
    -- Auth guard: only allow crediting your own orders
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT value INTO v_config FROM app_settings WHERE key = 'corecoins_config';
    v_earn_rate  := COALESCE((v_config->>'earn_rate')::numeric,  2);
    v_earn_per   := COALESCE((v_config->>'earn_per_rupees')::numeric, 100);
    v_coin_value := COALESCE((v_config->>'coin_value_inr')::numeric, 1);

    FOR v_order IN
        SELECT * FROM orders
        WHERE user_id = p_user_id
          AND status = 'delivered'
          AND coins_credited = false
          AND coins_credit_after IS NOT NULL
          AND coins_credit_after <= now()
        FOR UPDATE SKIP LOCKED
    LOOP
        v_net_paid := COALESCE(v_order.total_amount_inr, 0) +
                      COALESCE(v_order.coins_used, 0) * v_coin_value;
        v_coins    := FLOOR((v_net_paid / v_earn_per) * v_earn_rate)::integer;

        IF v_coins > 0 THEN
            INSERT INTO corecoins_wallet (user_id, balance)
              VALUES (v_order.user_id, v_coins)
              ON CONFLICT (user_id) DO UPDATE
                SET balance = corecoins_wallet.balance + v_coins, updated_at = now();
        END IF;

        UPDATE orders SET coins_credited = true WHERE id = v_order.id;
        v_total := v_total + 1;
    END LOOP;

    RETURN v_total;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
--  cancel_order
--  Lets a customer cancel their own order if it is still in
--  'placed' or 'processing' status. Called via supabase.rpc().
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_order_id
      AND user_id = auth.uid()
      AND status IN ('placed', 'processing');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order cannot be cancelled (not found, not yours, or already shipped)';
    END IF;
END; $$;


-- ══════════════════════════════════════════════════════════════════════════
--  12. wa_notifications
--     Tracks WhatsApp notification sends to customers.
--     One row per order-status notification sent.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.wa_notifications (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status          text NOT NULL,
    phone           text,
    customer_name   text,
    sent_by         text,
    sent_at         timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')
);

ALTER TABLE public.wa_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage wa_notifications" ON public.wa_notifications FOR ALL USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
--  13. store_settings
--     Legacy settings table. Similar shape to app_settings but may hold
--     older configuration or be used by a different code path.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.store_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can write store_settings" ON public.store_settings FOR ALL USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
--  Reload PostgREST schema cache
-- ══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
