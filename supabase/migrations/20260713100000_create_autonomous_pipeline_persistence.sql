-- Autonomous catalog pipeline persistence
-- Apply name (MCP): create_autonomous_pipeline_persistence
-- Idempotent-safe: IF NOT EXISTS / DO blocks; no DROP of existing tables/columns/data.
-- RLS: service_role only (REVOKE ALL from anon/authenticated; no client GRANT).
-- FK: products.id = bigint; candidate refs = uuid (soft, no FK to discovery if optional).

-- =============================================================================
-- Helpers: updated_at trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. pipeline_batches
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pipeline_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'dry_run'
    CHECK (mode IN ('dry_run', 'commit')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued','running','paused','completed','completed_with_warnings','failed','cancelled'
    )),
  trigger_type text NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual','scheduler','api','resume','retry')),
  brand_limit integer NOT NULL DEFAULT 10
    CHECK (brand_limit > 0 AND brand_limit <= 200),
  product_limit_per_brand integer NOT NULL DEFAULT 20
    CHECK (product_limit_per_brand > 0 AND product_limit_per_brand <= 500),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  processed_items integer NOT NULL DEFAULT 0 CHECK (processed_items >= 0),
  success_items integer NOT NULL DEFAULT 0 CHECK (success_items >= 0),
  review_items integer NOT NULL DEFAULT 0 CHECK (review_items >= 0),
  failed_items integer NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
  skipped_items integer NOT NULL DEFAULT 0 CHECK (skipped_items >= 0),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  stages_completed text[] NOT NULL DEFAULT '{}',
  notes text[] NOT NULL DEFAULT '{}',
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_owner text NULL,
  lock_heartbeat_at timestamptz NULL,
  safe_error_code text NULL,
  safe_error_message text NULL,
  started_at timestamptz NULL,
  paused_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_batches_status_updated
  ON public.pipeline_batches (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_batches_lock
  ON public.pipeline_batches (lock_owner, lock_heartbeat_at)
  WHERE lock_owner IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pipeline_batches_updated_at ON public.pipeline_batches;
CREATE TRIGGER trg_pipeline_batches_updated_at
  BEFORE UPDATE ON public.pipeline_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMENT ON TABLE public.pipeline_batches IS
  'Autonomous catalog pipeline batches. Service role only. Never auto-publish.';

-- =============================================================================
-- 2. pipeline_jobs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.pipeline_batches(id) ON DELETE CASCADE,
  entity_type text NOT NULL
    CHECK (entity_type IN ('brand','product_url','product','ingredient','system')),
  entity_id text NOT NULL,
  source_key text NULL,
  brand_name text NULL,
  entity_label text NOT NULL DEFAULT '',
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued','running','completed','completed_with_warnings','needs_review',
      'retry_wait','failed','paused','cancelled'
    )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3
    CHECK (max_attempts > 0 AND max_attempts <= 10),
  next_retry_at timestamptz NULL,
  claimed_by text NULL,
  claim_heartbeat_at timestamptz NULL,
  failure_code text NULL,
  safe_failure_message text NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings text[] NOT NULL DEFAULT '{}',
  result_summary jsonb NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_jobs_batch_entity_stage_uq
    UNIQUE (batch_id, entity_type, entity_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_batch_status
  ON public.pipeline_jobs (batch_id, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_retry
  ON public.pipeline_jobs (status, next_retry_at)
  WHERE status IN ('queued','retry_wait');
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_claim
  ON public.pipeline_jobs (claimed_by, claim_heartbeat_at)
  WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_brand
  ON public.pipeline_jobs (brand_name)
  WHERE brand_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_source_key
  ON public.pipeline_jobs (source_key)
  WHERE source_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pipeline_jobs_updated_at ON public.pipeline_jobs;
CREATE TRIGGER trg_pipeline_jobs_updated_at
  BEFORE UPDATE ON public.pipeline_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMENT ON TABLE public.pipeline_jobs IS
  'Per-entity pipeline jobs with idempotent (batch,entity,stage) uniqueness.';

-- Atomic claim (SKIP LOCKED) for worker concurrency
CREATE OR REPLACE FUNCTION public.claim_pipeline_jobs(
  p_batch_id uuid,
  p_worker_id text,
  p_limit integer DEFAULT 5,
  p_stale_seconds integer DEFAULT 300
)
RETURNS SETOF public.pipeline_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 1;
  END IF;
  IF p_limit > 50 THEN
    p_limit := 50;
  END IF;

  -- Release stale running claims on this batch
  UPDATE public.pipeline_jobs j
  SET
    status = CASE
      WHEN j.attempts >= j.max_attempts THEN 'failed'
      ELSE 'queued'
    END,
    claimed_by = NULL,
    claim_heartbeat_at = NULL,
    failure_code = CASE
      WHEN j.attempts >= j.max_attempts THEN COALESCE(j.failure_code, 'STALE_CLAIM')
      ELSE j.failure_code
    END,
    safe_failure_message = CASE
      WHEN j.attempts >= j.max_attempts THEN COALESCE(j.safe_failure_message, 'stale claim')
      ELSE j.safe_failure_message
    END
  WHERE j.batch_id = p_batch_id
    AND j.status = 'running'
    AND (
      j.claim_heartbeat_at IS NULL
      OR j.claim_heartbeat_at < now() - make_interval(secs => p_stale_seconds)
    );

  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.pipeline_jobs j
    WHERE j.batch_id = p_batch_id
      AND (
        j.status = 'queued'
        OR (
          j.status = 'retry_wait'
          AND (j.next_retry_at IS NULL OR j.next_retry_at <= now())
        )
      )
    ORDER BY j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.pipeline_jobs j
  SET
    status = 'running',
    claimed_by = p_worker_id,
    claim_heartbeat_at = now(),
    started_at = COALESCE(j.started_at, now()),
    attempts = j.attempts + 1
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pipeline_jobs(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pipeline_jobs(uuid, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pipeline_jobs(uuid, text, integer, integer) TO service_role;

-- =============================================================================
-- 3. brand_official_site_state
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.brand_official_site_state (
  id bigserial PRIMARY KEY,
  brand_key text NOT NULL,
  canonical_name text NOT NULL,
  candidate_url text NULL,
  verified_url text NULL,
  official_domain text NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified','needs_review','verified','blocked','failed'
    )),
  connector text NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  robots_status text NULL,
  sitemap_status text NULL,
  crawl_status text NULL,
  last_checked_at timestamptz NULL,
  next_check_at timestamptz NULL,
  last_crawled_at timestamptz NULL,
  last_error_code text NULL,
  safe_error_message text NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_official_site_state_brand_key_uq UNIQUE (brand_key)
);

CREATE INDEX IF NOT EXISTS idx_brand_site_status
  ON public.brand_official_site_state (verification_status, next_check_at);
CREATE INDEX IF NOT EXISTS idx_brand_site_canonical
  ON public.brand_official_site_state (canonical_name);

DROP TRIGGER IF EXISTS trg_brand_official_site_state_updated_at
  ON public.brand_official_site_state;
CREATE TRIGGER trg_brand_official_site_state_updated_at
  BEFORE UPDATE ON public.brand_official_site_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =============================================================================
-- 4. product_field_provenance
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_field_provenance (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL DEFAULT 'candidate'
    CHECK (entity_type IN ('product','candidate','brand','job')),
  entity_id text NOT NULL,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  candidate_id uuid NULL,
  field_name text NOT NULL,
  value_summary text NULL,
  value_hash text NULL,
  source_url text NULL,
  source_domain text NULL,
  extraction_method text NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  raw_hash text NULL,
  verified_status text NOT NULL DEFAULT 'unverified'
    CHECK (verified_status IN ('unverified','needs_review','verified')),
  extracted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_field_provenance_entity_field_hash_uq
    UNIQUE (entity_type, entity_id, field_name, value_hash)
);

CREATE INDEX IF NOT EXISTS idx_field_prov_entity
  ON public.product_field_provenance (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_field_prov_product
  ON public.product_field_provenance (product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_prov_candidate
  ON public.product_field_provenance (candidate_id)
  WHERE candidate_id IS NOT NULL;

-- =============================================================================
-- 5. product_quality_scores
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_quality_scores (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  candidate_id uuid NULL,
  entity_key text NOT NULL,
  identity_score numeric(5,4) NOT NULL DEFAULT 0,
  source_authority_score numeric(5,4) NOT NULL DEFAULT 0,
  ingredient_completeness numeric(5,4) NOT NULL DEFAULT 0,
  offer_completeness numeric(5,4) NOT NULL DEFAULT 0,
  evidence_completeness numeric(5,4) NOT NULL DEFAULT 0,
  safety_completeness numeric(5,4) NOT NULL DEFAULT 0,
  tone_completeness numeric(5,4) NOT NULL DEFAULT 0,
  freshness_score numeric(5,4) NOT NULL DEFAULT 0,
  dedupe_confidence numeric(5,4) NOT NULL DEFAULT 0,
  total_score numeric(5,4) NOT NULL DEFAULT 0,
  grade text NOT NULL
    CHECK (grade IN ('A','B','C','D','Review Required')),
  publish_eligible boolean NOT NULL DEFAULT false,
  blockers text[] NOT NULL DEFAULT '{}',
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_version text NOT NULL DEFAULT 'v1',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_quality_scores_entity_version_uq
    UNIQUE (entity_key, scoring_version)
);

CREATE INDEX IF NOT EXISTS idx_quality_product
  ON public.product_quality_scores (product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quality_candidate
  ON public.product_quality_scores (candidate_id)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quality_grade
  ON public.product_quality_scores (grade, calculated_at DESC);

DROP TRIGGER IF EXISTS trg_product_quality_scores_updated_at
  ON public.product_quality_scores;
CREATE TRIGGER trg_product_quality_scores_updated_at
  BEFORE UPDATE ON public.product_quality_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =============================================================================
-- 6. product_skin_match_scores
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_skin_match_scores (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  candidate_id uuid NULL,
  entity_key text NOT NULL,
  skin_types text[] NOT NULL DEFAULT '{}',
  concerns text[] NOT NULL DEFAULT '{}',
  usage_areas text[] NOT NULL DEFAULT '{}',
  routine_steps text[] NOT NULL DEFAULT '{}',
  tone_depth text[] NOT NULL DEFAULT '{}',
  undertone text[] NOT NULL DEFAULT '{}',
  tone_relevance text NOT NULL DEFAULT 'not_applicable'
    CHECK (tone_relevance IN ('not_applicable','low','medium','high')),
  match_score numeric(5,4) NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  cautions jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring_version text NOT NULL DEFAULT 'v1',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_skin_match_scores_entity_version_uq
    UNIQUE (entity_key, scoring_version)
);

CREATE INDEX IF NOT EXISTS idx_skin_match_product
  ON public.product_skin_match_scores (product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skin_match_candidate
  ON public.product_skin_match_scores (candidate_id)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skin_match_entity
  ON public.product_skin_match_scores (entity_key);

DROP TRIGGER IF EXISTS trg_product_skin_match_scores_updated_at
  ON public.product_skin_match_scores;
CREATE TRIGGER trg_product_skin_match_scores_updated_at
  BEFORE UPDATE ON public.product_skin_match_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =============================================================================
-- 7. product_change_candidates
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_change_candidates (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL DEFAULT 'product'
    CHECK (entity_type IN ('product','candidate','brand','offer')),
  entity_id text NOT NULL,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  change_type text NOT NULL,
  old_hash text NULL,
  new_hash text NULL,
  safe_summary text NULL,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review','accepted','rejected','ignored')),
  confidence numeric(4,3) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  source text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_change_candidates_entity_type_hashes_uq
    UNIQUE (entity_type, entity_id, change_type, old_hash, new_hash)
);

CREATE INDEX IF NOT EXISTS idx_change_cand_status
  ON public.product_change_candidates (status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_cand_product
  ON public.product_change_candidates (product_id)
  WHERE product_id IS NOT NULL;

-- =============================================================================
-- RLS + privileges (service_role only; no anon/authenticated access)
-- =============================================================================
ALTER TABLE public.pipeline_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_official_site_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_skin_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_change_candidates ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.pipeline_batches FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.pipeline_jobs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.brand_official_site_state FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_field_provenance FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_quality_scores FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_skin_match_scores FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_change_candidates FROM anon, authenticated;

-- No GRANT to anon/authenticated. service_role bypasses RLS.
