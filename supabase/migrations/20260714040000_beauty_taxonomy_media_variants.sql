-- Beauty taxonomy status columns + product media + variants (staging).
-- FILE ONLY on shared Production: apply ONLY when CATALOG_DATABASE_ENV=staging
-- and project ref != Production (see assertCatalogMigrationAllowed).

-- Expand catalog_domain check to full beauty domains
ALTER TABLE public.catalog_staging_products
  DROP CONSTRAINT IF EXISTS catalog_staging_products_catalog_domain_check;

ALTER TABLE public.catalog_staging_products
  ADD CONSTRAINT catalog_staging_products_catalog_domain_check
  CHECK (
    catalog_domain IS NULL OR catalog_domain IN (
      'face_skincare', 'sun_care', 'lip_care', 'lip_color',
      'base_makeup', 'color_makeup', 'eye_makeup', 'brow_makeup',
      'scalp_care', 'hair_care', 'hair_loss_support',
      'body_care', 'hand_foot_care', 'shaving_care', 'baby_kids',
      'nail_care', 'fragrance', 'beauty_tools', 'other',
      -- legacy values retained for existing staging rows
      'face', 'scalp', 'hair', 'unknown'
    )
  );

ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'missing'
    CHECK (media_status IN (
      'source_verified', 'needs_review', 'missing', 'broken', 'not_applicable', 'prohibited'
    ));
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS offer_status text NOT NULL DEFAULT 'missing'
    CHECK (offer_status IN (
      'source_verified', 'needs_review', 'missing', 'broken', 'not_applicable', 'prohibited'
    ));
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS variant_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (variant_status IN (
      'source_verified', 'needs_review', 'missing', 'broken', 'not_applicable', 'prohibited'
    ));
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (claim_status IN (
      'source_verified', 'needs_review', 'missing', 'broken', 'not_applicable', 'prohibited'
    ));
ALTER TABLE public.catalog_staging_products
  ADD COLUMN IF NOT EXISTS target_audience text
    CHECK (target_audience IS NULL OR target_audience IN (
      'unisex', 'women', 'men', 'teen', 'kids', 'baby', 'unknown'
    ));

CREATE TABLE IF NOT EXISTS public.catalog_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid REFERENCES public.catalog_staging_products(id) ON DELETE SET NULL,
  product_id bigint,
  source_id uuid REFERENCES public.catalog_sources(id) ON DELETE SET NULL,
  media_type text NOT NULL CHECK (media_type IN (
    'product_front', 'product_back', 'packaging', 'texture', 'swatch',
    'shade_swatch', 'application', 'ingredient_label', 'size_reference', 'other'
  )),
  variant_key text,
  shade_name text,
  image_url text NOT NULL,
  canonical_image_url text,
  thumbnail_url text,
  source_page_url text NOT NULL,
  source_domain text NOT NULL,
  source_type text NOT NULL,
  source_tier integer NOT NULL DEFAULT 3 CHECK (source_tier BETWEEN 1 AND 4),
  is_official_source boolean NOT NULL DEFAULT false,
  usage_rights_status text NOT NULL DEFAULT 'unknown'
    CHECK (usage_rights_status IN (
      'official_remote_use', 'licensed_copy_allowed', 'external_link_only', 'unknown', 'prohibited'
    )),
  rights_notes text,
  width integer,
  height integer,
  mime_type text,
  content_length bigint,
  content_hash text,
  perceptual_hash text,
  http_status integer,
  is_accessible boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  validation_status text NOT NULL DEFAULT 'discovered'
    CHECK (validation_status IN (
      'discovered', 'verified', 'broken', 'mismatched', 'needs_review', 'prohibited'
    )),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_product_media_staging_idx
  ON public.catalog_product_media (staging_product_id);
CREATE INDEX IF NOT EXISTS catalog_product_media_validation_idx
  ON public.catalog_product_media (validation_status);

CREATE TABLE IF NOT EXISTS public.catalog_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid REFERENCES public.catalog_staging_products(id) ON DELETE SET NULL,
  product_id bigint,
  variant_type text NOT NULL CHECK (variant_type IN (
    'shade', 'size', 'scent', 'pack', 'formula'
  )),
  variant_key text NOT NULL,
  shade_name text,
  shade_name_ko text,
  shade_code text,
  color_hex text,
  undertone_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  depth_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  finish text,
  availability text,
  official_variant_url text,
  ingredient_scope text NOT NULL DEFAULT 'unknown'
    CHECK (ingredient_scope IN (
      'common', 'variant_specific', 'may_contain', 'unknown'
    )),
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staging_product_id, variant_key)
);

CREATE INDEX IF NOT EXISTS catalog_product_variants_staging_idx
  ON public.catalog_product_variants (staging_product_id);

ALTER TABLE public.catalog_product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_product_variants ENABLE ROW LEVEL SECURITY;
