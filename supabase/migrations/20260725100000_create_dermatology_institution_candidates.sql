-- T07-02 Seoul dermatology institution candidates (HIRA public open data).
-- Creates ONE new table only. Does NOT alter/drop any existing table.
-- Mirrors the product_discovery_candidates gating pattern:
--   workflow_status enum (discovered -> verified -> published / rejected),
--   admin-only writes via service_role, client SELECT limited to
--   verified/published rows only (never anything human hasn't reviewed at
--   least via automated required-field checks).
--
-- Data source: HIRA (건강보험심사평가원) hospInfoServicev2 open API via
-- data.go.kr — public business/clinic directory data, not personal data.
-- publishAllowed is always false at collection time (see
-- src/lib/publicData/seoulDermatologyIngestion/types.ts); 'published' here
-- requires a human reviewer action, same as product_discovery_candidates.
--
-- No DELETE grant to service_role (same restraint as prior migrations in
-- this project — destructive ops require a human Dashboard action).

CREATE TABLE IF NOT EXISTS public.dermatology_institution_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_institution_id text NOT NULL,
  name text NOT NULL,
  address text DEFAULT NULL,
  longitude numeric DEFAULT NULL,
  latitude numeric DEFAULT NULL,
  phone text DEFAULT NULL,
  institution_type_code text DEFAULT NULL,
  institution_type_name text DEFAULT NULL,
  sido_code text DEFAULT NULL,
  sido_name text DEFAULT NULL,
  sggu_code text DEFAULT NULL,
  sggu_name text DEFAULT NULL,
  department_code text DEFAULT NULL,
  department_name text DEFAULT NULL,
  established_date text DEFAULT NULL,
  source_service text NOT NULL DEFAULT 'hira_hospital_info'
    CHECK (source_service IN ('hira_hospital_info', 'hira_institution_detail')),
  source_url text DEFAULT NULL,
  -- workflow_status.verified = required-field presence check passed
  -- (not a medical/clinical claim — this is public directory metadata).
  workflow_status text NOT NULL DEFAULT 'discovered'
    CHECK (workflow_status IN ('discovered', 'verified', 'published', 'rejected')),
  notes jsonb DEFAULT NULL,
  collected_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dermatology_institution_candidates_name_nonempty_chk CHECK (btrim(name) <> ''),
  CONSTRAINT dermatology_institution_candidates_external_id_nonempty_chk CHECK (
    btrim(external_institution_id) <> ''
  ),
  CONSTRAINT dermatology_institution_candidates_source_url_nonempty_chk CHECK (
    source_url IS NULL OR btrim(source_url) <> ''
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS dermatology_institution_candidates_external_id_uidx
  ON public.dermatology_institution_candidates (external_institution_id);

CREATE INDEX IF NOT EXISTS dermatology_institution_candidates_workflow_status_idx
  ON public.dermatology_institution_candidates (workflow_status);
CREATE INDEX IF NOT EXISTS dermatology_institution_candidates_sggu_name_idx
  ON public.dermatology_institution_candidates (sggu_name);
CREATE INDEX IF NOT EXISTS dermatology_institution_candidates_department_name_idx
  ON public.dermatology_institution_candidates (department_name);
CREATE INDEX IF NOT EXISTS dermatology_institution_candidates_status_sggu_idx
  ON public.dermatology_institution_candidates (workflow_status, sggu_name);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.dermatology_institution_candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dermatology_institution_candidates'
      AND policyname = 'Allow client read verified dermatology institutions'
  ) THEN
    ALTER POLICY "Allow client read verified dermatology institutions"
      ON public.dermatology_institution_candidates
      TO anon, authenticated
      USING (workflow_status IN ('verified', 'published'));
  ELSE
    CREATE POLICY "Allow client read verified dermatology institutions"
      ON public.dermatology_institution_candidates
      FOR SELECT
      TO anon, authenticated
      USING (workflow_status IN ('verified', 'published'));
  END IF;
END $$;

-- =============================================================================
-- Privileges
-- REVOKE ALL defeats default public ACL, then GRANT only what each role needs.
-- No DELETE for service_role (matches product_discovery_candidates convention).
-- =============================================================================
REVOKE ALL PRIVILEGES ON TABLE public.dermatology_institution_candidates FROM anon, authenticated;
GRANT SELECT ON TABLE public.dermatology_institution_candidates TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.dermatology_institution_candidates TO service_role;

-- Apply only after human review. Staging project only (jfnj***gfd).
-- Do NOT apply against Production (rhfr***mns).
