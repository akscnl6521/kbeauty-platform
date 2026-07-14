-- Staging only: public catalog read for analyze/results (anon client).
-- Fix: permission denied for table products (missing SELECT privilege).
-- Public rows: active=true AND verified_at IS NOT NULL.
-- Internal column data_confidence excluded via column-level GRANT only
-- (table-level SELECT would override column REVOKE in Postgres).

BEGIN;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read all products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated read all products" ON public.products;
DROP POLICY IF EXISTS "Allow anon read verified active products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated read verified active products" ON public.products;

CREATE POLICY "Allow anon read verified active products"
  ON public.products
  FOR SELECT
  TO anon
  USING (active IS TRUE AND verified_at IS NOT NULL);

CREATE POLICY "Allow authenticated read verified active products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (active IS TRUE AND verified_at IS NOT NULL);

REVOKE ALL ON TABLE public.products FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  name_ko,
  name_ja,
  brand,
  category,
  skin_concern,
  skin_tone,
  key_ingredients,
  key_ingredients_ja,
  price_usd,
  recommendation_reason,
  recommendation_reason_ko,
  recommendation_reason_ja,
  slug,
  link_sephora,
  link_amazon_us,
  link_amazon_jp,
  link_qoo10,
  link_oliveyoung,
  link_coupang,
  link_yesstyle,
  full_ingredients,
  usage_area,
  texture,
  fragrance_free,
  alcohol_free,
  verified_at,
  active
) ON TABLE public.products TO anon, authenticated;

COMMIT;
