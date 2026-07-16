-- Full beauty platform: makeup / lip / eye / media / evidence attrs on staging.
-- Apply on Staging linked ref only. Do not apply to Production without approval.

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS beauty_domain text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS category_detail text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS product_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS undertone_fit jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS skin_tone_fit jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS coverage_level text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS finish_level text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS waterproof boolean;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS mascara_effects jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS lip_effects jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS evidence_ingredient_slugs jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS evidence_concern_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS confidence_score numeric;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS image_source_url text;

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS image_rights_status text NOT NULL DEFAULT 'external_link_only';

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS sprint_tag text;

CREATE INDEX IF NOT EXISTS catalog_staging_products_beauty_domain_idx
  ON public.catalog_staging_products (beauty_domain);

CREATE INDEX IF NOT EXISTS catalog_staging_products_sprint_tag_idx
  ON public.catalog_staging_products (sprint_tag);

CREATE INDEX IF NOT EXISTS catalog_staging_products_confidence_idx
  ON public.catalog_staging_products (confidence_score);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_staging_products_sprint_ext_uidx
  ON public.catalog_staging_products (sprint_tag, external_product_id)
  WHERE sprint_tag IS NOT NULL AND external_product_id IS NOT NULL;

COMMENT ON COLUMN public.catalog_staging_products.image_rights_status IS
  'external_link_only | storage_hosted | unknown — never claim Storage copy without rights review';
