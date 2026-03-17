-- Add Korean/Japanese columns for mechanism and caution on ingredients table.
-- Run in Supabase Dashboard: SQL Editor, or via Supabase CLI (supabase db push).

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS mechanism_ko text,
  ADD COLUMN IF NOT EXISTS mechanism_ja text,
  ADD COLUMN IF NOT EXISTS caution_ko text,
  ADD COLUMN IF NOT EXISTS caution_ja text;

-- Optional: add comment for documentation
COMMENT ON COLUMN ingredients.mechanism_ko IS 'Korean translation of mechanism (작용 원리)';
COMMENT ON COLUMN ingredients.mechanism_ja IS 'Japanese translation of mechanism';
COMMENT ON COLUMN ingredients.caution_ko IS 'Korean translation of caution (주의사항)';
COMMENT ON COLUMN ingredients.caution_ja IS 'Japanese translation of caution';
