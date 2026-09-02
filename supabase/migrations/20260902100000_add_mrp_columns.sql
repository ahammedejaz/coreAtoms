-- ============================================================================
-- Add MRP (maximum retail price) columns for strikethrough pricing.
--
-- Already applied to production on 2026-09-02. Safe to replay.
--
-- `mrp_inr` is DISPLAY-ONLY data: the storefront shows "₹MRP ₹price X% off"
-- when mrp_inr > price_inr, and nothing at all otherwise. It never feeds a
-- money path — the order RPCs price lines from `price_inr` exactly as before,
-- so a wrong or missing MRP can mislabel a discount but can never change what
-- a customer is charged.
--
-- Both columns are nullable and the deployed frontend selects explicit column
-- lists, so applying this ahead of the web release changes nothing visible.
-- ============================================================================

alter table public.products
    add column if not exists mrp_inr integer
    check (mrp_inr is null or mrp_inr >= 0);

alter table public.product_variants
    add column if not exists mrp_inr integer
    check (mrp_inr is null or mrp_inr >= 0);

comment on column public.products.mrp_inr is
    'Maximum retail price for strikethrough display. Display-only: orders always charge price_inr.';
comment on column public.product_variants.mrp_inr is
    'Maximum retail price for strikethrough display. Display-only: orders always charge price_inr.';
