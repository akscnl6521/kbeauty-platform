-- Add Korean translation column for product recommendation_reason.
-- Run in Supabase Dashboard: SQL Editor, or via Supabase CLI.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS recommendation_reason_ko text;

COMMENT ON COLUMN products.recommendation_reason_ko IS 'Korean translation of recommendation_reason (제품 추천 이유)';
