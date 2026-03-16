-- Allow anonymous (anon) users to read all rows from products table.
-- Run this in Supabase Dashboard: SQL Editor, or via Supabase CLI.

-- Enable RLS on products if not already enabled (optional, only if table is new)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if you had a restrictive one (adjust policy name if needed)
-- DROP POLICY IF EXISTS "Restrict products read" ON products;

-- Policy: allow SELECT for anon role on all rows
CREATE POLICY "Allow anon read all products"
  ON products
  FOR SELECT
  TO anon
  USING (true);
