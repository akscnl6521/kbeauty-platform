-- Fixture isolation for catalog staging (no bulk product promotion).
-- Safe on shared DB: schema-only, no row deletes, no products/product_offers writes.

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS test_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalog_staging_offers
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalog_staging_ingredients
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS catalog_staging_products_fixture_idx
  ON public.catalog_staging_products (is_fixture);

COMMENT ON COLUMN public.catalog_staging_products.is_fixture IS
  'Fixture/test rows excluded from real catalog counts and promotion.';
