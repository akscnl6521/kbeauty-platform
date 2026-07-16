-- Search-to-Verified-Product Pipeline schema (DRAFT — do NOT apply until approved).
-- Creates 11 new tables only. Does NOT alter/drop products, ingredients, or product_offers.
--
-- Type compatibility (remote confirmed read-only):
--   public.products.id      = bigint (IDENTITY ALWAYS)
--   public.ingredients.id   = bigint (IDENTITY ALWAYS)
--   public.product_offers.id = uuid
--   public.product_offers.product_id = bigint → products(id)
--
-- Status vocabulary (new tables):
--   Common review / verification_status / review_status:
--     pending | in_review | approved | rejected | needs_review
--   Do NOT mix with product_offers.verification_status
--     (offers keep: verified | unverified | invalid | unavailable).
--   workflow_status.verified = pipeline stage after admin gate (not offer verified).
--
-- New table PKs: uuid DEFAULT gen_random_uuid()
-- FKs to products/ingredients: bigint
-- RLS: minimum privilege; admin tables have no client SELECT policy.
-- Privileges: REVOKE ALL from anon/authenticated on all 11 tables, then GRANT SELECT on 7 only.
-- No DROP / TRUNCATE / DELETE / UPDATE of existing data.
-- No new SEQUENCE (uuid PKs via gen_random_uuid).
-- Policy upsert unsupported in Postgres; use DO + EXISTS + CREATE POLICY / ALTER POLICY.
--
-- NOTE: CREATE TABLE IF NOT EXISTS does not add missing columns to an already-created
-- incomplete table. Remote currently has none of these tables, so first apply is OK.
-- Re-apply after a partial failed create would need a follow-up ALTER migration.

-- =============================================================================
-- 1. brands
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  name_ko text DEFAULT NULL,
  name_en text DEFAULT NULL,
  name_ja text DEFAULT NULL,
  official_website text DEFAULT NULL,
  country_code text DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  source_url text DEFAULT NULL,
  verified_at timestamptz DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brands_canonical_name_key UNIQUE (canonical_name),
  CONSTRAINT brands_canonical_name_nonempty_chk CHECK (btrim(canonical_name) <> ''),
  CONSTRAINT brands_official_website_nonempty_chk CHECK (
    official_website IS NULL OR btrim(official_website) <> ''
  ),
  CONSTRAINT brands_source_url_nonempty_chk CHECK (
    source_url IS NULL OR btrim(source_url) <> ''
  )
);

CREATE INDEX IF NOT EXISTS brands_verification_status_idx
  ON public.brands (verification_status);
CREATE INDEX IF NOT EXISTS brands_active_idx
  ON public.brands (active);
CREATE INDEX IF NOT EXISTS brands_country_code_idx
  ON public.brands (country_code);

-- =============================================================================
-- 2. product_variants
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  country_code text DEFAULT NULL,
  size_value numeric DEFAULT NULL,
  size_unit text DEFAULT NULL,
  variant_name text DEFAULT NULL,
  formula_version text DEFAULT NULL,
  package_version text DEFAULT NULL,
  launch_date date DEFAULT NULL,
  discontinued_at date DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Empty string forbidden: use NULL for unknown (distinct from '')
  CONSTRAINT product_variants_country_nonempty_chk CHECK (
    country_code IS NULL OR btrim(country_code) <> ''
  ),
  CONSTRAINT product_variants_variant_name_nonempty_chk CHECK (
    variant_name IS NULL OR btrim(variant_name) <> ''
  ),
  CONSTRAINT product_variants_formula_version_nonempty_chk CHECK (
    formula_version IS NULL OR btrim(formula_version) <> ''
  ),
  CONSTRAINT product_variants_package_version_nonempty_chk CHECK (
    package_version IS NULL OR btrim(package_version) <> ''
  ),
  CONSTRAINT product_variants_size_unit_nonempty_chk CHECK (
    size_unit IS NULL OR btrim(size_unit) <> ''
  )
);

-- NULLS NOT DISTINCT: unknown (NULL) fields participate in uniqueness without COALESCE('', '')
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_identity_uidx
  ON public.product_variants (
    product_id,
    country_code,
    variant_name,
    formula_version
  ) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS product_variants_country_code_idx
  ON public.product_variants (country_code);
CREATE INDEX IF NOT EXISTS product_variants_active_idx
  ON public.product_variants (active);
CREATE INDEX IF NOT EXISTS product_variants_verification_status_idx
  ON public.product_variants (verification_status);
CREATE INDEX IF NOT EXISTS product_variants_product_id_active_idx
  ON public.product_variants (product_id, active);

-- =============================================================================
-- 3. product_ingredients
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid DEFAULT NULL
    REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  ingredient_id bigint NOT NULL
    REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  ingredient_order integer NOT NULL
    CHECK (ingredient_order >= 1),
  is_key_ingredient boolean NOT NULL DEFAULT false,
  declared_concentration numeric DEFAULT NULL,
  concentration_unit text DEFAULT NULL,
  concentration_disclosed boolean NOT NULL DEFAULT false,
  source_url text DEFAULT NULL,
  source_type text DEFAULT NULL
    CHECK (
      source_type IS NULL
      OR source_type IN (
        'official_brand_page',
        'official_label',
        'official_retailer',
        'medical_paper',
        'clinical_guideline',
        'admin_entry',
        'search_result',
        'affiliate_feed',
        'brand_csv',
        'other'
      )
    ),
  verified_at timestamptz DEFAULT NULL,
  -- Admin review result uses approved (NOT offer "verified")
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_ingredients_source_url_nonempty_chk CHECK (
    source_url IS NULL OR btrim(source_url) <> ''
  ),
  -- When approved: official source URL + verified_at required
  CONSTRAINT product_ingredients_approved_source_chk CHECK (
    verification_status <> 'approved'
    OR (
      verified_at IS NOT NULL
      AND source_url IS NOT NULL
      AND btrim(source_url) <> ''
      AND source_type IN (
        'official_brand_page',
        'official_label',
        'official_retailer'
      )
    )
  )
);

-- Intentional: NULL variant_id = product-common formula; sentinel keeps order unique
CREATE UNIQUE INDEX IF NOT EXISTS product_ingredients_order_uidx
  ON public.product_ingredients (
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    ingredient_order
  );

CREATE INDEX IF NOT EXISTS product_ingredients_product_id_idx
  ON public.product_ingredients (product_id);
CREATE INDEX IF NOT EXISTS product_ingredients_variant_id_idx
  ON public.product_ingredients (variant_id);
CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_id_idx
  ON public.product_ingredients (ingredient_id);
CREATE INDEX IF NOT EXISTS product_ingredients_verification_status_idx
  ON public.product_ingredients (verification_status);
CREATE INDEX IF NOT EXISTS product_ingredients_product_variant_idx
  ON public.product_ingredients (product_id, variant_id);
CREATE INDEX IF NOT EXISTS product_ingredients_product_order_idx
  ON public.product_ingredients (product_id, ingredient_order);

-- =============================================================================
-- 4. ingredient_aliases
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ingredient_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id bigint NOT NULL
    REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  alias text NOT NULL,
  language_code text DEFAULT NULL,
  alias_type text NOT NULL DEFAULT 'synonym'
    CHECK (alias_type IN (
      'inci', 'common', 'ko', 'en', 'ja', 'synonym', 'misspelling'
    )),
  normalized_alias text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_aliases_alias_nonempty_chk CHECK (btrim(alias) <> ''),
  CONSTRAINT ingredient_aliases_normalized_nonempty_chk CHECK (btrim(normalized_alias) <> ''),
  CONSTRAINT ingredient_aliases_language_nonempty_chk CHECK (
    language_code IS NULL OR btrim(language_code) <> ''
  )
);

-- NULL language_code = unspecified; empty string forbidden. NULLS NOT DISTINCT for uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_aliases_normalized_lang_uidx
  ON public.ingredient_aliases (normalized_alias, language_code)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS ingredient_aliases_ingredient_id_idx
  ON public.ingredient_aliases (ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_aliases_normalized_alias_idx
  ON public.ingredient_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS ingredient_aliases_active_idx
  ON public.ingredient_aliases (active);
CREATE INDEX IF NOT EXISTS ingredient_aliases_review_status_idx
  ON public.ingredient_aliases (review_status);

-- =============================================================================
-- 5. skin_concerns (ops reference data — requires review_status)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.skin_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name_ko text NOT NULL,
  name_en text NOT NULL,
  category text DEFAULT NULL
    CHECK (
      category IS NULL
      OR category IN ('cosmetic', 'borderline', 'refer_expert')
    ),
  medical_boundary text DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skin_concerns_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS skin_concerns_active_idx
  ON public.skin_concerns (active);
CREATE INDEX IF NOT EXISTS skin_concerns_category_idx
  ON public.skin_concerns (category);
CREATE INDEX IF NOT EXISTS skin_concerns_review_status_idx
  ON public.skin_concerns (review_status);

-- =============================================================================
-- 6. ingredient_evidence
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ingredient_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id bigint NOT NULL
    REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  concern_id uuid DEFAULT NULL
    REFERENCES public.skin_concerns(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL
    CHECK (evidence_type IN (
      'cosmetic_study', 'drug_study', 'guideline', 'claim'
    )),
  study_design text DEFAULT NULL,
  population text DEFAULT NULL,
  concentration text DEFAULT NULL,
  formulation text DEFAULT NULL,
  usage_frequency text DEFAULT NULL,
  study_duration text DEFAULT NULL,
  outcome_summary text DEFAULT NULL,
  evidence_level text NOT NULL
    CHECK (evidence_level IN (
      'systematic_review',
      'randomized_controlled_trial',
      'controlled_clinical_study',
      'observational_study',
      'expert_guideline',
      'in_vitro',
      'manufacturer_claim',
      'insufficient'
    )),
  pmid text DEFAULT NULL,
  doi text DEFAULT NULL,
  journal text DEFAULT NULL,
  publication_year integer DEFAULT NULL
    CHECK (
      publication_year IS NULL
      OR (publication_year >= 1900 AND publication_year <= 2100)
    ),
  conflict_of_interest text DEFAULT NULL
    CHECK (
      conflict_of_interest IS NULL
      OR conflict_of_interest IN ('none', 'disclosed', 'unknown', 'high')
    ),
  source_url text DEFAULT NULL,
  reviewed_by text DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_evidence_pmid_nonempty_chk CHECK (
    pmid IS NULL OR btrim(pmid) <> ''
  ),
  CONSTRAINT ingredient_evidence_doi_nonempty_chk CHECK (
    doi IS NULL OR btrim(doi) <> ''
  ),
  CONSTRAINT ingredient_evidence_source_url_nonempty_chk CHECK (
    source_url IS NULL OR btrim(source_url) <> ''
  ),
  CONSTRAINT ingredient_evidence_approved_citation_chk CHECK (
    review_status <> 'approved'
    OR (
      reviewed_at IS NOT NULL
      AND (
        (source_url IS NOT NULL AND btrim(source_url) <> '')
        OR (pmid IS NOT NULL AND btrim(pmid) <> '')
        OR (doi IS NOT NULL AND btrim(doi) <> '')
      )
    )
  )
);

-- Partial unique: NULL / blank blocked by CHECK; non-empty PMID/DOI unique
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_evidence_pmid_uidx
  ON public.ingredient_evidence (pmid)
  WHERE pmid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ingredient_evidence_doi_uidx
  ON public.ingredient_evidence (doi)
  WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS ingredient_evidence_ingredient_id_idx
  ON public.ingredient_evidence (ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_evidence_concern_id_idx
  ON public.ingredient_evidence (concern_id);
CREATE INDEX IF NOT EXISTS ingredient_evidence_ingredient_concern_idx
  ON public.ingredient_evidence (ingredient_id, concern_id);
CREATE INDEX IF NOT EXISTS ingredient_evidence_evidence_level_idx
  ON public.ingredient_evidence (evidence_level);
CREATE INDEX IF NOT EXISTS ingredient_evidence_review_status_idx
  ON public.ingredient_evidence (review_status);
CREATE INDEX IF NOT EXISTS ingredient_evidence_publication_year_idx
  ON public.ingredient_evidence (publication_year);

-- =============================================================================
-- 7. ingredient_cautions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ingredient_cautions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id bigint NOT NULL
    REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  caution_type text NOT NULL
    CHECK (caution_type IN (
      'irritation',
      'allergy',
      'sensitive',
      'pregnancy',
      'lactation',
      'interaction'
    )),
  severity text NOT NULL DEFAULT 'moderate'
    CHECK (severity IN ('low', 'moderate', 'high', 'refer_expert')),
  condition text DEFAULT NULL,
  description text NOT NULL,
  evidence_source text DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_cautions_approved_source_chk CHECK (
    review_status <> 'approved'
    OR (
      reviewed_at IS NOT NULL
      AND evidence_source IS NOT NULL
      AND btrim(evidence_source) <> ''
    )
  )
);

CREATE INDEX IF NOT EXISTS ingredient_cautions_ingredient_id_idx
  ON public.ingredient_cautions (ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_cautions_type_idx
  ON public.ingredient_cautions (caution_type);
CREATE INDEX IF NOT EXISTS ingredient_cautions_ingredient_type_idx
  ON public.ingredient_cautions (ingredient_id, caution_type);
CREATE INDEX IF NOT EXISTS ingredient_cautions_severity_active_idx
  ON public.ingredient_cautions (severity, active);
CREATE INDEX IF NOT EXISTS ingredient_cautions_active_idx
  ON public.ingredient_cautions (active);
CREATE INDEX IF NOT EXISTS ingredient_cautions_review_status_idx
  ON public.ingredient_cautions (review_status);

-- =============================================================================
-- 8. product_discovery_candidates (admin only — no client SELECT policy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_name text NOT NULL,
  discovered_brand text DEFAULT NULL,
  discovered_url text DEFAULT NULL,
  discovered_country text DEFAULT NULL,
  source_type text DEFAULT NULL
    CHECK (
      source_type IS NULL
      OR source_type IN (
        'official_brand_page',
        'official_label',
        'official_retailer',
        'medical_paper',
        'clinical_guideline',
        'admin_entry',
        'search_result',
        'affiliate_feed',
        'brand_csv',
        'other'
      )
    ),
  search_query text DEFAULT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  sale_check_status text NOT NULL DEFAULT 'pending'
    CHECK (sale_check_status IN ('pending', 'pass', 'fail')),
  ingredient_check_status text NOT NULL DEFAULT 'pending'
    CHECK (ingredient_check_status IN ('pending', 'pass', 'fail')),
  evidence_check_status text NOT NULL DEFAULT 'pending'
    CHECK (evidence_check_status IN ('pending', 'pass', 'fail')),
  safety_check_status text NOT NULL DEFAULT 'pending'
    CHECK (safety_check_status IN ('pending', 'pass', 'fail')),
  duplicate_check_status text NOT NULL DEFAULT 'pending'
    CHECK (duplicate_check_status IN ('pending', 'pass', 'fail')),
  -- workflow_status.verified = pipeline stage (distinct from offer verified)
  workflow_status text NOT NULL DEFAULT 'discovered'
    CHECK (workflow_status IN (
      'discovered',
      'sale_checked',
      'ingredients_checked',
      'evidence_checked',
      'safety_checked',
      'verified',
      'published',
      'rejected',
      'needs_review'
    )),
  linked_product_id bigint DEFAULT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  assigned_to text DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_discovery_candidates_url_nonempty_chk CHECK (
    discovered_url IS NULL OR btrim(discovered_url) <> ''
  )
);

-- Partial unique: NULL URL OK (multiple); non-empty URL unique
CREATE UNIQUE INDEX IF NOT EXISTS product_discovery_candidates_url_uidx
  ON public.product_discovery_candidates (discovered_url)
  WHERE discovered_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_discovery_candidates_workflow_status_idx
  ON public.product_discovery_candidates (workflow_status);
CREATE INDEX IF NOT EXISTS product_discovery_candidates_country_idx
  ON public.product_discovery_candidates (discovered_country);
CREATE INDEX IF NOT EXISTS product_discovery_candidates_linked_product_id_idx
  ON public.product_discovery_candidates (linked_product_id);
CREATE INDEX IF NOT EXISTS product_discovery_candidates_discovered_at_idx
  ON public.product_discovery_candidates (discovered_at DESC);
CREATE INDEX IF NOT EXISTS product_discovery_candidates_discovered_url_idx
  ON public.product_discovery_candidates (discovered_url);

-- =============================================================================
-- 9. verification_queue (admin only — no client SELECT policy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.verification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'candidate',
      'product',
      'offer',
      'ingredient',
      'evidence',
      'variant',
      'brand'
    )),
  entity_id text NOT NULL,
  review_type text NOT NULL
    CHECK (review_type IN (
      'sale',
      'ingredients',
      'evidence',
      'safety',
      'publish',
      'duplicate',
      'other'
    )),
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'in_review', 'approved', 'rejected', 'needs_review'
    )),
  assigned_to text DEFAULT NULL,
  reason text DEFAULT NULL,
  reviewer_notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS verification_queue_status_priority_idx
  ON public.verification_queue (status, priority, created_at);
CREATE INDEX IF NOT EXISTS verification_queue_entity_idx
  ON public.verification_queue (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS verification_queue_status_idx
  ON public.verification_queue (status);

-- =============================================================================
-- 10. data_sources (admin only — no client SELECT policy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL
    CHECK (source_type IN (
      'official_brand_page',
      'official_label',
      'official_retailer',
      'medical_paper',
      'clinical_guideline',
      'admin_entry',
      'search_result',
      'affiliate_feed',
      'brand_csv',
      'other'
    )),
  source_name text NOT NULL,
  base_url text DEFAULT NULL,
  country_code text DEFAULT NULL,
  trust_level text NOT NULL DEFAULT 'medium'
    CHECK (trust_level IN ('high', 'medium', 'low')),
  official boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_sources_name_nonempty_chk CHECK (btrim(source_name) <> ''),
  CONSTRAINT data_sources_base_url_nonempty_chk CHECK (
    base_url IS NULL OR btrim(base_url) <> ''
  )
);

-- Partial unique: NULL base_url = unknown (multiple OK); non-empty URL unique per type
-- Empty string blocked by CHECK above, so WHERE base_url IS NOT NULL is enough
CREATE UNIQUE INDEX IF NOT EXISTS data_sources_type_url_uidx
  ON public.data_sources (source_type, base_url)
  WHERE base_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS data_sources_country_code_idx
  ON public.data_sources (country_code);
CREATE INDEX IF NOT EXISTS data_sources_active_idx
  ON public.data_sources (active);
CREATE INDEX IF NOT EXISTS data_sources_trust_official_idx
  ON public.data_sources (trust_level, official);

-- =============================================================================
-- 11. product_change_history (admin only — no client SELECT policy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint DEFAULT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid DEFAULT NULL
    REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  change_type text NOT NULL
    CHECK (change_type IN (
      'name',
      'ingredients',
      'price',
      'status',
      'source',
      'offer',
      'other'
    )),
  old_value jsonb DEFAULT NULL,
  new_value jsonb DEFAULT NULL,
  source_url text DEFAULT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz DEFAULT NULL,
  approved_by text DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS product_change_history_product_id_idx
  ON public.product_change_history (product_id);
CREATE INDEX IF NOT EXISTS product_change_history_variant_id_idx
  ON public.product_change_history (variant_id);
CREATE INDEX IF NOT EXISTS product_change_history_product_detected_idx
  ON public.product_change_history (product_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS product_change_history_change_type_idx
  ON public.product_change_history (change_type);
CREATE INDEX IF NOT EXISTS product_change_history_product_variant_idx
  ON public.product_change_history (product_id, variant_id);

-- =============================================================================
-- RLS enable (all new tables)
-- =============================================================================
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_cautions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_change_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Client-readable SELECT policies (idempotent DO blocks)
-- Admin tables intentionally have ZERO SELECT policies for anon/authenticated.
-- service_role bypasses RLS (Supabase default).
-- =============================================================================

-- brands: active + approved
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brands'
      AND policyname = 'Allow client read approved brands'
  ) THEN
    ALTER POLICY "Allow client read approved brands"
      ON public.brands
      TO anon, authenticated
      USING (active = true AND verification_status = 'approved');
  ELSE
    CREATE POLICY "Allow client read approved brands"
      ON public.brands
      FOR SELECT
      TO anon, authenticated
      USING (active = true AND verification_status = 'approved');
  END IF;
END $$;

-- product_variants: active + approved
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_variants'
      AND policyname = 'Allow client read approved product_variants'
  ) THEN
    ALTER POLICY "Allow client read approved product_variants"
      ON public.product_variants
      TO anon, authenticated
      USING (active = true AND verification_status = 'approved');
  ELSE
    CREATE POLICY "Allow client read approved product_variants"
      ON public.product_variants
      FOR SELECT
      TO anon, authenticated
      USING (active = true AND verification_status = 'approved');
  END IF;
END $$;

-- product_ingredients: approved + official source + verified_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_ingredients'
      AND policyname = 'Allow client read approved product_ingredients'
  ) THEN
    ALTER POLICY "Allow client read approved product_ingredients"
      ON public.product_ingredients
      TO anon, authenticated
      USING (
        verification_status = 'approved'
        AND verified_at IS NOT NULL
        AND source_url IS NOT NULL
        AND btrim(source_url) <> ''
        AND source_type IN (
          'official_brand_page',
          'official_label',
          'official_retailer'
        )
      );
  ELSE
    CREATE POLICY "Allow client read approved product_ingredients"
      ON public.product_ingredients
      FOR SELECT
      TO anon, authenticated
      USING (
        verification_status = 'approved'
        AND verified_at IS NOT NULL
        AND source_url IS NOT NULL
        AND btrim(source_url) <> ''
        AND source_type IN (
          'official_brand_page',
          'official_label',
          'official_retailer'
        )
      );
  END IF;
END $$;

-- ingredient_aliases: active + approved
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingredient_aliases'
      AND policyname = 'Allow client read approved ingredient_aliases'
  ) THEN
    ALTER POLICY "Allow client read approved ingredient_aliases"
      ON public.ingredient_aliases
      TO anon, authenticated
      USING (active = true AND review_status = 'approved');
  ELSE
    CREATE POLICY "Allow client read approved ingredient_aliases"
      ON public.ingredient_aliases
      FOR SELECT
      TO anon, authenticated
      USING (active = true AND review_status = 'approved');
  END IF;
END $$;

-- skin_concerns: active + approved
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skin_concerns'
      AND policyname = 'Allow client read approved skin_concerns'
  ) THEN
    ALTER POLICY "Allow client read approved skin_concerns"
      ON public.skin_concerns
      TO anon, authenticated
      USING (active = true AND review_status = 'approved');
  ELSE
    CREATE POLICY "Allow client read approved skin_concerns"
      ON public.skin_concerns
      FOR SELECT
      TO anon, authenticated
      USING (active = true AND review_status = 'approved');
  END IF;
END $$;

-- ingredient_evidence: approved + citation + reviewed_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingredient_evidence'
      AND policyname = 'Allow client read approved ingredient_evidence'
  ) THEN
    ALTER POLICY "Allow client read approved ingredient_evidence"
      ON public.ingredient_evidence
      TO anon, authenticated
      USING (
        review_status = 'approved'
        AND reviewed_at IS NOT NULL
        AND (
          (source_url IS NOT NULL AND btrim(source_url) <> '')
          OR (pmid IS NOT NULL AND btrim(pmid) <> '')
          OR (doi IS NOT NULL AND btrim(doi) <> '')
        )
      );
  ELSE
    CREATE POLICY "Allow client read approved ingredient_evidence"
      ON public.ingredient_evidence
      FOR SELECT
      TO anon, authenticated
      USING (
        review_status = 'approved'
        AND reviewed_at IS NOT NULL
        AND (
          (source_url IS NOT NULL AND btrim(source_url) <> '')
          OR (pmid IS NOT NULL AND btrim(pmid) <> '')
          OR (doi IS NOT NULL AND btrim(doi) <> '')
        )
      );
  END IF;
END $$;

-- ingredient_cautions: active + approved + evidence_source + reviewed_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingredient_cautions'
      AND policyname = 'Allow client read approved ingredient_cautions'
  ) THEN
    ALTER POLICY "Allow client read approved ingredient_cautions"
      ON public.ingredient_cautions
      TO anon, authenticated
      USING (
        active = true
        AND review_status = 'approved'
        AND reviewed_at IS NOT NULL
        AND evidence_source IS NOT NULL
        AND btrim(evidence_source) <> ''
      );
  ELSE
    CREATE POLICY "Allow client read approved ingredient_cautions"
      ON public.ingredient_cautions
      FOR SELECT
      TO anon, authenticated
      USING (
        active = true
        AND review_status = 'approved'
        AND reviewed_at IS NOT NULL
        AND evidence_source IS NOT NULL
        AND btrim(evidence_source) <> ''
      );
  END IF;
END $$;

-- =============================================================================
-- Privileges (defeats public default ACL arwdDxtm for anon/authenticated)
-- 1) REVOKE ALL on every new table (removes INSERT/UPDATE/DELETE/TRUNCATE/…)
-- 2) GRANT SELECT only on the 7 client-readable tables
-- 3) Admin 4 tables: no GRANT (remain inaccessible to anon/authenticated)
-- Do NOT revoke service_role.
-- RLS policies still filter rows on SELECT.
-- =============================================================================

REVOKE ALL PRIVILEGES ON TABLE public.brands FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_variants FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_ingredients FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ingredient_aliases FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.skin_concerns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ingredient_evidence FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ingredient_cautions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_discovery_candidates FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.verification_queue FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.data_sources FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_change_history FROM anon, authenticated;

GRANT SELECT ON TABLE public.brands TO anon, authenticated;
GRANT SELECT ON TABLE public.product_variants TO anon, authenticated;
GRANT SELECT ON TABLE public.product_ingredients TO anon, authenticated;
GRANT SELECT ON TABLE public.ingredient_aliases TO anon, authenticated;
GRANT SELECT ON TABLE public.skin_concerns TO anon, authenticated;
GRANT SELECT ON TABLE public.ingredient_evidence TO anon, authenticated;
GRANT SELECT ON TABLE public.ingredient_cautions TO anon, authenticated;

-- Example insert shapes intentionally omitted (no seed data in this migration).
-- Apply only after human review + GitHub backup. Do not run against production yet.
