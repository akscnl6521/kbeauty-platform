-- Scalp / hair catalog staging fields.
-- FILE ONLY on shared Production: apply ONLY when CATALOG_DATABASE_ENV=staging
-- and project ref != Production (see assertCatalogMigrationAllowed).

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS scalp_types jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS hair_types jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS scalp_concerns jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS hair_concerns jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS hair_loss_support_tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS cleansing_strength text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS surfactant_types jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS anti_dandruff_actives jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS fragrance_status text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS menthol_status text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS sulfate_claim text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS silicone_claim text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS color_safe_claim text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS functional_claims jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS functional_claim_source_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS functional_claim_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS functional_claim_country text;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS scalp_hair_validation_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (scalp_hair_validation_status IN (
      'not_applicable', 'pending', 'needs_review', 'verified', 'regulatory_review'
    ));
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS scalp_hair_validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS catalog_domain text
    CHECK (catalog_domain IS NULL OR catalog_domain IN (
      'face', 'scalp', 'hair', 'hair_loss_support', 'color_makeup', 'unknown'
    ));

CREATE INDEX IF NOT EXISTS catalog_staging_products_domain_idx
  ON public.catalog_staging_products (catalog_domain);
CREATE INDEX IF NOT EXISTS catalog_staging_products_functional_claim_idx
  ON public.catalog_staging_products (functional_claim_verified);
