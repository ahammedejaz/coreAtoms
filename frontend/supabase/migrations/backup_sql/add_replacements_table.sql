-- Migration: Create replacements table and storage bucket
-- Run this in Supabase SQL Editor

-- ── Replacements table ──
CREATE TABLE IF NOT EXISTS replacements (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason      text NOT NULL,          -- e.g. "Damaged in transit", "Wrong product", "Missing items"
    description text,                   -- Customer's detailed description
    images      text[] DEFAULT '{}',    -- Array of Supabase Storage URLs
    status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes text,                   -- Admin's reason for approval/rejection
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- One active replacement per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_replacements_order
    ON replacements(order_id)
    WHERE status != 'rejected';

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_replacements_status ON replacements(status);

-- RLS policies
ALTER TABLE replacements ENABLE ROW LEVEL SECURITY;

-- Customers can view their own replacements
CREATE POLICY "Users can view own replacements"
    ON replacements FOR SELECT
    USING (auth.uid() = user_id);

-- Customers can insert replacements for their own orders
CREATE POLICY "Users can create replacements"
    ON replacements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all replacements
CREATE POLICY "Admins can view all replacements"
    ON replacements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update replacements (approve/reject)
CREATE POLICY "Admins can update replacements"
    ON replacements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ── Storage bucket for damage images ──
-- NOTE: Create this manually in Supabase Dashboard → Storage → New Bucket:
--   Name: replacement-images
--   Public: YES (so images can be displayed)
--   File size limit: 5MB
--   Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage RLS: Allow authenticated users to upload
-- Add these policies in the Supabase Dashboard → Storage → replacement-images → Policies:
--   SELECT: Allow public access (anon + authenticated)
--   INSERT: Allow authenticated users
