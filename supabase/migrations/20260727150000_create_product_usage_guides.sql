-- Staging/dated migration: §36.5 product usage guidance as text
-- (도포량 · 사용 순서 · 사용 부위 · 아침·저녁 구분 · 주의사항).
-- Apply only to Staging (jfnj***gfd). Do NOT apply to Production without separate approval.
--
-- Why this table exists:
--   The display layer already exists (src/components/usage/ProductUsageGuide.tsx) but reads
--   window.localStorage["skinProductUsageGuides"]. There is no database behind it, so nothing
--   is sourced, reviewed, or re-checked. This gives that contract a real, sourced home.
--
-- Scope of this track: data only. No screen is rewired — ProductUsageGuide keeps reading
-- localStorage until a later track moves it. No anon / authenticated grants.
--
-- Anti-fabrication is a schema rule, not a convention:
--   product_usage_guides_approved_requires_evidence_chk makes it impossible to approve a
--   guide that has no method steps, no verification timestamp, or no source at all. An
--   invented usage instruction is an invented safety claim, so the DB refuses to hold one
--   in an approved state.
--
-- Statutory vs product-specific cautions are stored in separate columns. Korean cosmetics
-- law mandates an identical caution block on every product; filing that boilerplate as
-- product-specific guidance would overstate what we know about the product.
--
-- Re-run safety: IF NOT EXISTS everywhere. No DROP / DELETE / TRUNCATE.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_usage_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NULL
    REFERENCES public.product_variants(id) ON DELETE SET NULL,
  locale text NOT NULL DEFAULT 'ko',

  -- §36.5 도포량
  amount_label text NULL,

  -- §36.5 사용 순서 — position in the routine, plus the verbatim phrases the page used
  order_index integer NOT NULL DEFAULT 1,
  order_hints jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §36.5 아침·저녁 구분
  frequency text NULL,
  time_of_day text NULL,

  -- §36.5 사용 부위
  application_area jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 바르는 방법
  method_steps jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 주의사항 — product-specific and statutory kept apart on purpose
  caution_text jsonb NOT NULL DEFAULT '[]'::jsonb,
  statutory_notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- §36.5 함께 사용 시 주의
  combination_cautions jsonb NOT NULL DEFAULT '[]'::jsonb,

  patch_test_recommended boolean NOT NULL DEFAULT false,
  patch_test_wait_hours integer NULL,
  patch_test_steps jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- provenance
  source_type text NOT NULL,
  source_url text NULL,
  source_domain text NULL,
  -- the raw page excerpt the fields came from, so a reviewer can compare
  source_excerpt text NULL,
  extraction_method text NOT NULL DEFAULT 'automated_extraction',
  -- detects the source page changing under an already-reviewed guide
  content_hash text NULL,

  contains_medical_claim boolean NOT NULL DEFAULT false,

  -- review lifecycle
  verification_status text NOT NULL DEFAULT 'draft',
  verified_at timestamptz NULL,
  verified_by uuid NULL REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  review_note text NULL,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §41 재확인 주기
  last_checked_at timestamptz NULL,
  next_check_due_at timestamptz NULL,

  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_usage_guides_locale_chk CHECK (
    char_length(locale) BETWEEN 2 AND 8
  ),
  CONSTRAINT product_usage_guides_frequency_chk CHECK (
    frequency IS NULL
    OR frequency IN ('morning', 'evening', 'weekly', 'as_needed')
  ),
  CONSTRAINT product_usage_guides_time_of_day_chk CHECK (
    time_of_day IS NULL
    OR time_of_day IN ('am', 'pm', 'am_pm', 'weekly', 'as_needed')
  ),
  CONSTRAINT product_usage_guides_order_index_chk CHECK (order_index >= 1),
  CONSTRAINT product_usage_guides_source_type_chk CHECK (
    source_type IN (
      'official_brand',
      'authorized_retailer',
      'verified_editorial',
      'internal_review'
    )
  ),
  CONSTRAINT product_usage_guides_extraction_method_chk CHECK (
    extraction_method IN ('automated_extraction', 'manual_entry', 'brand_provided')
  ),
  CONSTRAINT product_usage_guides_status_chk CHECK (
    verification_status IN (
      'draft',
      'needs_review',
      'approved',
      'rejected',
      'expired',
      'superseded'
    )
  ),
  CONSTRAINT product_usage_guides_https_source_chk CHECK (
    source_url IS NULL OR source_url LIKE 'https://%'
  ),
  CONSTRAINT product_usage_guides_order_hints_array_chk CHECK (
    jsonb_typeof(order_hints) = 'array'
  ),
  CONSTRAINT product_usage_guides_area_array_chk CHECK (
    jsonb_typeof(application_area) = 'array'
  ),
  CONSTRAINT product_usage_guides_steps_array_chk CHECK (
    jsonb_typeof(method_steps) = 'array'
  ),
  CONSTRAINT product_usage_guides_caution_array_chk CHECK (
    jsonb_typeof(caution_text) = 'array'
  ),
  CONSTRAINT product_usage_guides_statutory_array_chk CHECK (
    jsonb_typeof(statutory_notices) = 'array'
  ),
  CONSTRAINT product_usage_guides_combination_array_chk CHECK (
    jsonb_typeof(combination_cautions) = 'array'
  ),
  CONSTRAINT product_usage_guides_patch_steps_array_chk CHECK (
    jsonb_typeof(patch_test_steps) = 'array'
  ),
  CONSTRAINT product_usage_guides_missing_fields_array_chk CHECK (
    jsonb_typeof(missing_fields) = 'array'
  ),
  CONSTRAINT product_usage_guides_patch_test_chk CHECK (
    patch_test_recommended = false
    OR (
      jsonb_array_length(patch_test_steps) > 0
      AND patch_test_wait_hours IS NOT NULL
      AND patch_test_wait_hours >= 0
    )
  ),
  -- an automatically extracted guide must say where it came from
  CONSTRAINT product_usage_guides_automated_needs_source_chk CHECK (
    extraction_method <> 'automated_extraction' OR source_url IS NOT NULL
  ),
  -- the anti-fabrication gate: nothing reaches 'approved' without real evidence
  CONSTRAINT product_usage_guides_approved_requires_evidence_chk CHECK (
    verification_status <> 'approved'
    OR (
      jsonb_array_length(method_steps) > 0
      AND verified_at IS NOT NULL
      AND contains_medical_claim = false
      AND (source_url IS NOT NULL OR review_note IS NOT NULL)
    )
  ),
  CONSTRAINT product_usage_guides_source_locale_uq
    UNIQUE (product_id, variant_id, locale, source_url)
);

CREATE INDEX IF NOT EXISTS product_usage_guides_product_idx
  ON public.product_usage_guides (product_id);
CREATE INDEX IF NOT EXISTS product_usage_guides_status_idx
  ON public.product_usage_guides (verification_status);
CREATE INDEX IF NOT EXISTS product_usage_guides_recheck_idx
  ON public.product_usage_guides (next_check_due_at)
  WHERE verification_status = 'approved';

-- ---------------------------------------------------------------------------
-- Review audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_usage_guide_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_guide_id uuid NOT NULL
    REFERENCES public.product_usage_guides(id) ON DELETE CASCADE,
  reviewer_id uuid NULL
    REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  decision text NOT NULL,
  previous_status text NULL,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_usage_guide_review_events_decision_chk CHECK (
    decision IN ('approved', 'rejected', 'needs_review', 'expired', 'superseded', 'reopened')
  ),
  CONSTRAINT product_usage_guide_review_events_reason_array_chk CHECK (
    jsonb_typeof(reason_codes) = 'array'
  ),
  CONSTRAINT product_usage_guide_review_events_reject_reason_chk CHECK (
    decision <> 'rejected' OR jsonb_array_length(reason_codes) > 0
  )
);

CREATE INDEX IF NOT EXISTS product_usage_guide_review_events_guide_idx
  ON public.product_usage_guide_review_events (usage_guide_id, created_at);

-- ---------------------------------------------------------------------------
-- Read-only helper view: guides that pass the review gate right now.
-- No screen reads this yet; it exists so display code never re-derives the rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.product_usage_guides_publishable AS
SELECT
  g.id,
  g.product_id,
  g.variant_id,
  g.locale,
  g.amount_label,
  g.order_index,
  g.order_hints,
  g.frequency,
  g.time_of_day,
  g.application_area,
  g.method_steps,
  g.caution_text,
  g.statutory_notices,
  g.combination_cautions,
  g.patch_test_recommended,
  g.patch_test_wait_hours,
  g.patch_test_steps,
  g.source_type,
  g.source_url,
  g.verified_at
FROM public.product_usage_guides g
WHERE g.verification_status = 'approved'
  AND jsonb_array_length(g.method_steps) > 0
  AND g.contains_medical_claim = false
  AND g.verified_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS + privileges. Data-only track: no anon / authenticated grants.
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_usage_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_usage_guide_review_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_usage_guides FROM PUBLIC;
REVOKE ALL ON TABLE public.product_usage_guides FROM anon;
REVOKE ALL ON TABLE public.product_usage_guides FROM authenticated;
REVOKE ALL ON TABLE public.product_usage_guide_review_events FROM PUBLIC;
REVOKE ALL ON TABLE public.product_usage_guide_review_events FROM anon;
REVOKE ALL ON TABLE public.product_usage_guide_review_events FROM authenticated;

REVOKE ALL ON public.product_usage_guides_publishable FROM PUBLIC;
REVOKE ALL ON public.product_usage_guides_publishable FROM anon;
REVOKE ALL ON public.product_usage_guides_publishable FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.product_usage_guides TO service_role;
GRANT SELECT, INSERT ON TABLE public.product_usage_guide_review_events TO service_role;
GRANT SELECT ON public.product_usage_guides_publishable TO service_role;

SELECT 'create_product_usage_guides_v1' AS notice;
