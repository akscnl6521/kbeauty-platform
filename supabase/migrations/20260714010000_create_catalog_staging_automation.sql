-- Verified catalog staging automation schema.
-- Service-role write only. No client INSERT/UPDATE/DELETE.
-- Does NOT alter products / product_offers rows or bulk-promote.
-- Does NOT drop existing product_ingredients (extends optionally).

-- =============================================================================
-- catalog_sources
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL,
  source_tier integer NOT NULL CHECK (source_tier BETWEEN 1 AND 4),
  base_url text,
  country_code text,
  language_code text,
  retailer_type text,
  is_official_brand_source boolean NOT NULL DEFAULT false,
  is_authorized_retailer boolean NOT NULL DEFAULT false,
  automation_allowed boolean NOT NULL DEFAULT false,
  authorization_status text NOT NULL DEFAULT 'manual_review'
    CHECK (authorization_status IN (
      'approved', 'manual_review', 'api_credentials_required',
      'prohibited', 'suspended'
    )),
  robots_status text NOT NULL DEFAULT 'unknown',
  terms_status text NOT NULL DEFAULT 'unknown',
  parser_type text,
  rate_limit_per_minute integer DEFAULT 6,
  crawl_interval_hours integer DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_sources_name_nonempty CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_sources_name_uidx
  ON public.catalog_sources (name);

-- =============================================================================
-- catalog_crawl_jobs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_crawl_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.catalog_sources(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'running', 'completed', 'failed', 'cancelled', 'authorization_required'
    )),
  started_at timestamptz,
  finished_at timestamptz,
  discovered_count integer NOT NULL DEFAULT 0,
  fetched_count integer NOT NULL DEFAULT 0,
  parsed_count integer NOT NULL DEFAULT 0,
  staged_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  needs_review_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  dry_run boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_crawl_jobs_source_idx
  ON public.catalog_crawl_jobs (source_id, created_at DESC);

-- =============================================================================
-- catalog_staging_products
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_staging_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.catalog_sources(id) ON DELETE SET NULL,
  external_product_id text,
  barcode text,
  gtin text,
  sku text,
  brand_raw text NOT NULL,
  brand_canonical text,
  product_name_raw text NOT NULL,
  product_name_ko text,
  product_name_en text,
  category_raw text,
  category_canonical text,
  product_type text,
  size_value numeric,
  size_unit text,
  form text,
  description_raw text,
  shade_family text,
  shades jsonb,
  finish text,
  coverage text,
  spf_value integer,
  pa_rating text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_image_url text,
  official_product_url text,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_tier integer,
  product_status text NOT NULL DEFAULT 'discovered'
    CHECK (product_status IN (
      'discovered', 'fetched', 'parsed', 'source_verified', 'data_complete',
      'needs_review', 'approved', 'rejected', 'discontinued', 'duplicate_candidate'
    )),
  ingredients_status text NOT NULL DEFAULT 'not_found'
    CHECK (ingredients_status IN (
      'not_found', 'raw_collected', 'parsed', 'normalized',
      'source_verified', 'needs_review'
    )),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_group_key text,
  content_hash text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  approved_product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_staging_products_brand_nonempty CHECK (btrim(brand_raw) <> ''),
  CONSTRAINT catalog_staging_products_name_nonempty CHECK (btrim(product_name_raw) <> '')
);

CREATE INDEX IF NOT EXISTS catalog_staging_products_status_idx
  ON public.catalog_staging_products (product_status);
CREATE INDEX IF NOT EXISTS catalog_staging_products_brand_idx
  ON public.catalog_staging_products (lower(brand_canonical));
CREATE INDEX IF NOT EXISTS catalog_staging_products_dup_idx
  ON public.catalog_staging_products (duplicate_group_key);

-- =============================================================================
-- catalog_staging_ingredients
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_staging_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid NOT NULL
    REFERENCES public.catalog_staging_products(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  ingredient_raw text NOT NULL,
  inci_name text,
  canonical_key text,
  name_ko text,
  normalization_status text NOT NULL DEFAULT 'raw'
    CHECK (normalization_status IN (
      'raw', 'parsed', 'normalized', 'unknown', 'needs_review'
    )),
  confidence numeric NOT NULL DEFAULT 0,
  source_url text,
  source_type text,
  source_verified boolean NOT NULL DEFAULT false,
  parsing_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_staging_ingredients_raw_nonempty CHECK (btrim(ingredient_raw) <> '')
);

CREATE INDEX IF NOT EXISTS catalog_staging_ingredients_product_idx
  ON public.catalog_staging_ingredients (staging_product_id, display_order);

-- =============================================================================
-- catalog_ingredients (automation canonical layer; distinct from public.ingredients)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inci_name text NOT NULL,
  canonical_key text NOT NULL,
  name_ko text,
  common_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  functions jsonb NOT NULL DEFAULT '[]'::jsonb,
  concern_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  caution_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  regulatory_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredients_canonical_key_uidx UNIQUE (canonical_key),
  CONSTRAINT catalog_ingredients_inci_nonempty CHECK (btrim(inci_name) <> ''),
  CONSTRAINT catalog_ingredients_key_nonempty CHECK (btrim(canonical_key) <> '')
);

-- =============================================================================
-- catalog_staging_offers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_staging_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid NOT NULL
    REFERENCES public.catalog_staging_products(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.catalog_sources(id) ON DELETE SET NULL,
  external_offer_id text,
  retailer_name_raw text NOT NULL,
  retailer_name_canonical text,
  seller_name text,
  seller_type text,
  country_code text NOT NULL,
  currency text,
  price numeric,
  original_price numeric,
  displayed_price numeric,
  price_type text,
  option_name text,
  membership_required boolean NOT NULL DEFAULT false,
  coupon_required boolean NOT NULL DEFAULT false,
  in_stock boolean,
  availability_raw text,
  ships_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  purchase_url text NOT NULL,
  is_official_store boolean NOT NULL DEFAULT false,
  is_authorized_retailer boolean NOT NULL DEFAULT false,
  source_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  content_hash text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  offer_status text NOT NULL DEFAULT 'discovered'
    CHECK (offer_status IN (
      'discovered', 'verified', 'unavailable', 'invalid', 'needs_review', 'expired'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_staging_offers_retailer_nonempty CHECK (btrim(retailer_name_raw) <> ''),
  CONSTRAINT catalog_staging_offers_url_nonempty CHECK (btrim(purchase_url) <> '')
);

CREATE INDEX IF NOT EXISTS catalog_staging_offers_product_idx
  ON public.catalog_staging_offers (staging_product_id);
CREATE INDEX IF NOT EXISTS catalog_staging_offers_status_idx
  ON public.catalog_staging_offers (offer_status);

-- =============================================================================
-- catalog_sync_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.catalog_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid REFERENCES public.catalog_staging_products(id) ON DELETE SET NULL,
  target_product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_sync_events_staging_idx
  ON public.catalog_sync_events (staging_product_id, performed_at DESC);

-- =============================================================================
-- Optional product_ingredients extensions (table already exists)
-- =============================================================================
ALTER TABLE public.product_ingredients
  ADD COLUMN IF NOT EXISTS source_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.product_ingredients
  ADD COLUMN IF NOT EXISTS confidence numeric;
ALTER TABLE public.product_ingredients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =============================================================================
-- RLS: admin/service only (no anon/authenticated policies)
-- =============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'catalog_sources',
    'catalog_crawl_jobs',
    'catalog_staging_products',
    'catalog_staging_ingredients',
    'catalog_ingredients',
    'catalog_staging_offers',
    'catalog_sync_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Seed authorization-aware sources (no secrets). Idempotent by name.
INSERT INTO public.catalog_sources (
  name, source_type, source_tier, base_url, country_code, language_code,
  retailer_type, is_official_brand_source, is_authorized_retailer,
  automation_allowed, authorization_status, robots_status, terms_status,
  parser_type, rate_limit_per_minute, crawl_interval_hours, is_active
)
SELECT v.name, v.source_type, v.source_tier, v.base_url, v.country_code,
  v.language_code, v.retailer_type, v.is_official_brand_source,
  v.is_authorized_retailer, v.automation_allowed, v.authorization_status,
  v.robots_status, v.terms_status, v.parser_type, v.rate_limit_per_minute,
  v.crawl_interval_hours, v.is_active
FROM (
  VALUES
    ('Coupang Partners', 'retailer', 2, 'https://www.coupang.com', 'KR', 'ko', 'marketplace', false, false, false, 'api_credentials_required', 'unknown', 'unknown', 'coupang_authorized', 6, 24, true),
    ('Olive Young KR', 'retailer', 2, 'https://www.oliveyoung.co.kr', 'KR', 'ko', 'authorized_retailer', false, true, false, 'manual_review', 'unknown', 'unknown', 'oliveyoung_approved', 6, 24, true),
    ('COSRX Official KR', 'brand_official', 1, 'https://www.cosrx.co.kr', 'KR', 'ko', 'brand_store', true, true, false, 'manual_review', 'unknown', 'unknown', 'brand_official', 6, 168, true),
    ('Open Beauty Facts', 'open_data', 3, 'https://world.openbeautyfacts.org', NULL, 'en', NULL, false, false, true, 'approved', 'allowed', 'allowed', 'open_beauty_facts', 10, 168, true),
    ('Manual Seed Fixtures', 'manual', 1, NULL, 'KR', 'ko', NULL, true, true, true, 'approved', 'n/a', 'n/a', 'manual_seed', 60, 0, true)
) AS v(
  name, source_type, source_tier, base_url, country_code, language_code,
  retailer_type, is_official_brand_source, is_authorized_retailer,
  automation_allowed, authorization_status, robots_status, terms_status,
  parser_type, rate_limit_per_minute, crawl_interval_hours, is_active
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_sources s WHERE s.name = v.name
);
