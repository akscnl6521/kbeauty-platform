-- DRAFT ONLY — DO NOT APPLY
-- Usage media / guide schema gaps for Master Plan stage 4.
-- This file is intentionally not a dated migration runner target.
-- Apply only after explicit Staging approval and schema review.
--
-- Existing table: public.catalog_product_media
-- Missing relative to admin review checklist / ProductUsageGuide policy layer:

-- ALTER TABLE public.catalog_product_media
--   ADD COLUMN IF NOT EXISTS rights_starts_at timestamptz,
--   ADD COLUMN IF NOT EXISTS rights_ends_at timestamptz,
--   ADD COLUMN IF NOT EXISTS disclosure_text text,
--   ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS locale text,
--   ADD COLUMN IF NOT EXISTS country_code text,
--   ADD COLUMN IF NOT EXISTS duration_seconds integer,
--   ADD COLUMN IF NOT EXISTS routine_step text,
--   ADD COLUMN IF NOT EXISTS application_area_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
--   ADD COLUMN IF NOT EXISTS skin_concern_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Future dedicated guide table (not created):
-- CREATE TABLE public.product_usage_guides (...);

SELECT 'DRAFT_DO_NOT_APPLY' AS notice;
