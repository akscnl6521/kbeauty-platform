-- Enrichment + admin bulk audit (Staging apply only).

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS match_class text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS enrichment_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS image_content_hash text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS recommendable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS catalog_staging_products_match_class_idx
  ON public.catalog_staging_products (match_class);

CREATE INDEX IF NOT EXISTS catalog_staging_products_recommendable_idx
  ON public.catalog_staging_products (recommendable);

CREATE TABLE IF NOT EXISTS public.catalog_bulk_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  filter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_count integer NOT NULL DEFAULT 0,
  applied_count integer NOT NULL DEFAULT 0,
  dry_run boolean NOT NULL DEFAULT true,
  actor text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
