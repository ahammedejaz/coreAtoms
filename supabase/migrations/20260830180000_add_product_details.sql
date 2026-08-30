-- Add structured product-detail content to products.
-- `details` holds the PDP's rich sections as JSONB:
--   {
--     "benefits":    [{ "icon": "energy", "title": "…", "text": "…" }],
--     "ingredients": [{ "name": "…", "amount": "…", "purpose": "…" }],
--     "howToUse":    ["Step one…", "Step two…"],
--     "faqs":        [{ "q": "…", "a": "…" }],
--     "safetyInfo":  "…"
--   }
-- Nullable and additive — existing rows and clients are unaffected.
-- World-readable like the rest of the products row (products SELECT policy
-- already covers all columns); writes stay admin-only via existing policies.

alter table public.products
    add column if not exists details jsonb;

comment on column public.products.details is
    'Structured PDP content: benefits, ingredients, howToUse, faqs, safetyInfo (JSONB).';
