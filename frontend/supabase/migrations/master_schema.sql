-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║              CORE ATOMS — BASE DATABASE SCHEMA                           ║
-- ║                                                                          ║
-- ║  WHAT THIS FILE IS                                                       ║
-- ║  ─────────────────                                                       ║
-- ║  The tables, indexes, RLS policies and seed data for a FRESH project.    ║
-- ║  It is the only record of the pre-March 2026 schema: the root            ║
-- ║  `supabase/migrations/` tree starts from an empty baseline marker        ║
-- ║  (`20260304_existing.sql`), so it cannot stand a project up on its own.  ║
-- ║                                                                          ║
-- ║  WHAT THIS FILE IS NOT                                                   ║
-- ║  ─────────────────────                                                   ║
-- ║  It no longer defines the order RPCs, the CoreCoins functions or the     ║
-- ║  notification trigger. It used to hold a second copy of each, and that   ║
-- ║  copy drifted until it described a variant-oversell bug and a            ║
-- ║  pre-discount GST calculation as if they were the schema. Those bodies   ║
-- ║  have been removed and replaced with pointers to the migration that      ║
-- ║  owns each one, so there is nothing left here to drift.                  ║
-- ║                                                                          ║
-- ║  STANDING UP A FRESH PROJECT                                             ║
-- ║  ───────────────────────────                                             ║
-- ║    1. Supabase Dashboard → SQL Editor → run this file (tables + RLS).    ║
-- ║    2. `npx supabase db push` (functions, RPCs, and the security          ║
-- ║       hardening that comes with them).                                   ║
-- ║                                                                          ║
-- ║  DO NOT REPLAY THIS FILE OVER THE LIVE DATABASE. `CREATE OR REPLACE      ║
-- ║  FUNCTION` DISCARDS a function's SET clause, so any SECURITY DEFINER     ║
-- ║  function here that lacks an inline `SET search_path = public, pg_temp`  ║
-- ║  would silently lose that hardening.                                     ║
-- ║                                                                          ║
-- ║  Pre-requisites (in the Supabase Dashboard, before running this file):   ║
-- ║    1. Enable Supabase Auth                                               ║
-- ║    2. Create storage buckets:                                            ║
-- ║         - hero-images        (public)                                    ║
-- ║         - product-images     (public)                                    ║
-- ║         - replacement-images (public, 5 MB limit, jpg/png/webp)          ║
-- ║    3. Storage policies: SELECT public, INSERT authenticated              ║
-- ║                                                                          ║
-- ║  When this file and the live database disagree, the live database wins.  ║
-- ║                                                                          ║
-- ║  Last updated: 2026-08-31                                                ║
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
-- The WITH CHECK is load-bearing: for UPDATE, Postgres falls back to the USING
-- expression when a policy has none, and a duplicate policy without one let any
-- customer promote themselves to admin. Never add a second permissive UPDATE
-- policy on this table — permissive policies OR together.
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND (COALESCE(role, 'customer') = 'customer' OR (SELECT public.is_admin()))
  );
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
    details             jsonb,                       -- Structured PDP content: benefits, ingredients, howToUse, faqs, safetyInfo
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Idempotent add for databases created before the details column existed
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS details jsonb;

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
                          CHECK (status IN ('placed','confirmed','processing','shipped',
                                            'out_for_delivery','delivered','cancelled','payment_failed')),
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
-- Granular read policy: sensitive keys require authentication, everything else is public.
-- There must be exactly ONE permissive SELECT policy here — permissive policies OR
-- together, so adding a second `USING (true)` silently defeats this filter.
CREATE POLICY "Public can read non-sensitive app_settings" ON public.app_settings
    FOR SELECT USING (
        key <> ALL (ARRAY['discount_codes','warehouse_address',
                          'delhivery_client_name','delhivery_pickup_name'])
        OR (select auth.uid()) IS NOT NULL
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

-- ⚠ place_order_cod() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260830183910_security_and_order_integrity.sql
--   The live version decrements product_variants for variant lines, and taxes the discounted subtotal.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.


-- ──────────────────────────────────────────────────────────────────────────
--  place_order_prepaid
--  Same as place_order_cod but stores Razorpay payment IDs.
--  Called by the verify-razorpay-payment Edge Function after HMAC verification.
--  Item prices, GST, and flat shipping are all verified server-side.
-- ──────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_order_prepaid(UUID, JSONB, JSONB, TEXT, TEXT, TEXT, INT);

-- ⚠ place_order_prepaid() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260830184145_order_rpcs_prepaid_cancel_corecoins.sql
--   The live version adds p_amount_paid_paise, is idempotent on razorpay_payment_id, and fixes variant stock and GST ordering.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.


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
-- ⚠ credit_corecoins() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260830184145_order_rpcs_prepaid_cancel_corecoins.sql
--   The live version records coins_credited_amount.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.

DROP TRIGGER IF EXISTS trg_credit_corecoins ON public.orders;
CREATE TRIGGER trg_credit_corecoins
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.credit_corecoins();


-- ──────────────────────────────────────────────────────────────────────────
--  process_pending_corecoins
--  Called from the frontend (MyOrders.jsx) on page load for the logged-in
--  user. Credits any orders where coins_credit_after <= now().
--  This pattern avoids the need for pg_cron.
-- ──────────────────────────────────────────────────────────────────────────
-- ⚠ process_pending_corecoins() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260830184145_order_rpcs_prepaid_cancel_corecoins.sql
--   The live version records coins_credited_amount.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.


-- ──────────────────────────────────────────────────────────────────────────
--  cancel_order
--  Lets a customer cancel their own order if it is still in
--  'placed' or 'processing' status. Called via supabase.rpc().
-- ──────────────────────────────────────────────────────────────────────────
-- ⚠ cancel_order() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260830184145_order_rpcs_prepaid_cancel_corecoins.sql
--   The live version restores stock to the right table and refunds redeemed CoreCoins.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.



-- ══════════════════════════════════════════════════════════════════════════
--  Push notifications  (was only in the repo-root supabase/migrations tree)
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expo_push_token text NOT NULL,
    device_name     text,
    platform        text CHECK (platform IN ('ios', 'android')),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (user_id, expo_push_token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Service role reads all tokens" ON public.push_tokens;

CREATE POLICY "Users manage own push tokens" ON public.push_tokens
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role reads all tokens" ON public.push_tokens
    FOR SELECT USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens (user_id);

CREATE OR REPLACE FUNCTION public.update_push_token_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER trg_push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_push_token_timestamp();

-- Fires the send-order-notification Edge Function whenever orders.status changes.
-- ⚠ notify_order_status_change() IS NOT DEFINED HERE ANY MORE.
--
--   Authoritative definition: supabase/migrations/20260831120000_restore_order_status_updates.sql
--   The live version cannot abort the order status change any more, and authenticates with a Vault secret.
--
--   The body was removed rather than refreshed. Keeping a second copy is
--   what let this file drift far enough to describe an oversell bug as if
--   it were the schema. To stand up a fresh project: run this file for the
--   tables, then `npx supabase db push` for the functions and the
--   hardening that comes with them.

DROP TRIGGER IF EXISTS trg_order_status_push_notification ON public.orders;
CREATE TRIGGER trg_order_status_push_notification
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.notify_order_status_change();


-- ══════════════════════════════════════════════════════════════════════════
--  Realtime replication — without this, postgres_changes never fires
-- ══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
--  Least-privilege EXECUTE grants
--
--  The order RPCs are SECURITY DEFINER and take p_user_id as an argument.
--  Their guard compares it against auth.uid(), which is NULL for an anonymous
--  caller — so granting these to `anon` lets anyone holding the public anon key
--  place orders as any user. Do not re-grant them.
--
--  is_admin() deliberately keeps its grants: RLS policies across the schema
--  call it, and policy expressions run with the querying role's privileges.
-- ══════════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.place_order_cod(
    uuid, jsonb, jsonb, integer, numeric, numeric, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_order(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_pending_corecoins(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_pending_corecoins(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_failed_order(
    uuid, jsonb, jsonb, text, numeric, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_failed_order(
    uuid, jsonb, jsonb, text, numeric, numeric) TO authenticated, service_role;

-- Prepaid orders are created only by the verify-razorpay-payment Edge Function.
REVOKE EXECUTE ON FUNCTION public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_prepaid(
    uuid, jsonb, jsonb, text, text, text, integer, numeric, numeric, numeric, text)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_corecoins()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_push_token_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limits()         TO service_role;

-- ══════════════════════════════════════════════════════════════════════════
--  Reload PostgREST schema cache
-- ══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
--  FUNCTIONS THAT LIVE ONLY IN THE MIGRATIONS TREE
--
--  These have never been defined in this file. They are listed so that reading
--  it does not leave you believing the schema is smaller than it is.
--
--    resolve_coupon_percentage(code, user_id)  — the single source of truth for
--        coupon validity: active, date window, email whitelist, new-users-only.
--        20260830183910_security_and_order_integrity.sql
--
--    validate_coupon(code)                     — the customer-facing wrapper.
--        20260830183910_security_and_order_integrity.sql
--
--    handle_replacement_coins()                — trigger on `replacements`.
--        Predates the audit; see the live database for its definition.
--
--    verify_notify_secret(secret)              — checks the Vault secret that
--        proves a send-order-notification call came from the orders trigger.
--        20260831120000_restore_order_status_updates.sql
--
--    prune_rate_limits()                       — keeps `rate_limits` bounded
--        without pg_cron.
--        20260831130000_prune_rate_limits_and_hide_internal_tables.sql
-- ══════════════════════════════════════════════════════════════════════════
