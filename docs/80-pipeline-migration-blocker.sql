-- BLOCKER: Autonomous pipeline persistence
-- DO NOT APPLY without explicit user approval.
-- Rollback: DROP TABLE IF EXISTS in reverse order (see bottom).
-- Existing product/offer data: no destructive changes intended.
-- RLS: service_role / admin-only; no public SELECT of crawl state.

-- 1) pipeline_batches
CREATE TABLE IF NOT EXISTS public.pipeline_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('dry_run', 'commit')),
  status text NOT NULL CHECK (status IN (
    'queued','running','paused','completed','completed_with_warnings','failed','cancelled'
  )),
  brand_limit integer NOT NULL DEFAULT 10 CHECK (brand_limit > 0 AND brand_limit <= 200),
  product_limit_per_brand integer NOT NULL DEFAULT 20 CHECK (product_limit_per_brand > 0 AND product_limit_per_brand <= 500),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  stages_completed text[] NOT NULL DEFAULT '{}',
  notes text[] NOT NULL DEFAULT '{}',
  lock_owner text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_batches_status ON public.pipeline_batches (status, updated_at DESC);

-- 2) pipeline_jobs
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.pipeline_batches(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('brand','product_url','product','ingredient','system')),
  entity_id text NOT NULL,
  entity_label text NOT NULL DEFAULT '',
  stage text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'queued','running','completed','completed_with_warnings','needs_review',
    'retry_wait','failed','paused','cancelled'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0 AND max_attempts <= 10),
  next_retry_at timestamptz NULL,
  failure_code text NULL,
  safe_failure_message text NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings text[] NOT NULL DEFAULT '{}',
  result_summary jsonb NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entity_type, entity_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_batch_status ON public.pipeline_jobs (batch_id, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_retry ON public.pipeline_jobs (status, next_retry_at);

-- 3) brand official site state (avoid inventing columns on brands without review)
CREATE TABLE IF NOT EXISTS public.brand_official_site_state (
  id bigserial PRIMARY KEY,
  brand_key text NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  candidate_url text NULL,
  verified_url text NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','needs_review','verified','blocked')),
  connector text NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  last_crawled_at timestamptz NULL,
  last_error_code text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) field provenance
CREATE TABLE IF NOT EXISTS public.product_field_provenance (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id),
  candidate_id uuid NULL,
  field_name text NOT NULL,
  field_value text NULL,
  source_url text NULL,
  extraction_method text NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  raw_hash text NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_prov_product ON public.product_field_provenance (product_id);
CREATE INDEX IF NOT EXISTS idx_field_prov_candidate ON public.product_field_provenance (candidate_id);

-- 5) quality / skin scores (not publish flags)
CREATE TABLE IF NOT EXISTS public.product_quality_scores (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id),
  candidate_id uuid NULL,
  grade text NOT NULL CHECK (grade IN ('A','B','C','D','Review Required')),
  score numeric(5,4) NOT NULL,
  publish_eligible boolean NOT NULL DEFAULT false,
  blockers text[] NOT NULL DEFAULT '{}',
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id),
  UNIQUE (candidate_id)
);

CREATE TABLE IF NOT EXISTS public.product_skin_match_scores (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id),
  candidate_id uuid NULL,
  skin_types text[] NOT NULL DEFAULT '{}',
  concerns text[] NOT NULL DEFAULT '{}',
  usage_areas text[] NOT NULL DEFAULT '{}',
  routine_steps text[] NOT NULL DEFAULT '{}',
  tone_relevance text NOT NULL DEFAULT 'not_applicable',
  undertones text[] NOT NULL DEFAULT '{}',
  depths text[] NOT NULL DEFAULT '{}',
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  reasons text[] NOT NULL DEFAULT '{}',
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_change_candidates (
  id bigserial PRIMARY KEY,
  product_id bigint NULL REFERENCES public.products(id),
  change_type text NOT NULL,
  before_hash text NULL,
  after_hash text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS sketch (admin/service only) — finalize with project RLS patterns before apply
ALTER TABLE public.pipeline_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_official_site_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_skin_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_change_candidates ENABLE ROW LEVEL SECURITY;

-- ROLLBACK (manual, approved only)
-- DROP TABLE IF EXISTS public.product_change_candidates;
-- DROP TABLE IF EXISTS public.product_skin_match_scores;
-- DROP TABLE IF EXISTS public.product_quality_scores;
-- DROP TABLE IF EXISTS public.product_field_provenance;
-- DROP TABLE IF EXISTS public.brand_official_site_state;
-- DROP TABLE IF EXISTS public.pipeline_jobs;
-- DROP TABLE IF EXISTS public.pipeline_batches;
