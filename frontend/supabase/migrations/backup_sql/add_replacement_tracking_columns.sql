-- Migration: Add tracking columns and expand status for replacements
-- Run this in Supabase SQL Editor

-- ── New tracking columns ──
ALTER TABLE replacements
    ADD COLUMN IF NOT EXISTS replacement_waybill text,
    ADD COLUMN IF NOT EXISTS replacement_tracking_url text,
    ADD COLUMN IF NOT EXISTS reverse_waybill text,
    ADD COLUMN IF NOT EXISTS reverse_tracking_url text;

-- ── Expand the status CHECK constraint ──
-- Drop the old constraint and add the new one
ALTER TABLE replacements DROP CONSTRAINT IF EXISTS replacements_status_check;
ALTER TABLE replacements ADD CONSTRAINT replacements_status_check
    CHECK (status IN (
        'pending',
        'approved',
        'pickup_scheduled',
        'pickup_received',
        'replacement_shipped',
        'rejected'
    ));
