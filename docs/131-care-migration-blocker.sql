-- BLOCKER: Continuous care schema (do NOT auto-apply)
-- Suggested MCP apply name: create_user_care_lifecycle
-- Requires: public.profiles(id uuid) already exists
-- Rollback: docs/132-care-migration-rollback.sql

-- =============================================================================
-- care_analysis_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_device_id text NULL,
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  country text NULL,
  age_band text NULL,
  skin_type text NULL,
  sensitivity text NULL,
  concerns text[] NOT NULL DEFAULT '{}',
  tone_depth text NULL,
  undertone text NULL,
  allergy_ingredients text[] NOT NULL DEFAULT '{}',
  avoided_ingredients text[] NOT NULL DEFAULT '{}',
  current_products text[] NOT NULL DEFAULT '{}',
  budget_band text NULL,
  texture_preference text NULL,
  fragrance_preference text NULL,
  analysis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ranked_product_ids text[] NOT NULL DEFAULT '{}',
  data_confidence numeric NULL,
  dermatology_hints text[] NOT NULL DEFAULT '{}',
  consent_care_tracking boolean NOT NULL DEFAULT false,
  linked_account boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_analysis_sessions_user_idx
  ON public.care_analysis_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_analysis_sessions_device_idx
  ON public.care_analysis_sessions (anonymous_device_id, created_at DESC);

-- =============================================================================
-- care_routines / care_routine_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  analysis_session_id uuid NULL
    REFERENCES public.care_analysis_sessions(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  conflict_notes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_routine_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.care_routines(id) ON DELETE CASCADE,
  step text NOT NULL,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  custom_product_name text NULL,
  time_of_day text NOT NULL CHECK (time_of_day IN ('am','pm','both')),
  frequency text NOT NULL CHECK (frequency IN ('daily','every_other_day','2x_week','as_needed')),
  sort_order integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz NULL,
  usage_note text NULL,
  caution_notes text[] NOT NULL DEFAULT '{}',
  allergy_conflict boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_routine_items_routine_idx
  ON public.care_routine_items (routine_id, sort_order);

-- =============================================================================
-- care_check_ins
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  analysis_session_id uuid NOT NULL
    REFERENCES public.care_analysis_sessions(id) ON DELETE CASCADE,
  routine_id uuid NULL REFERENCES public.care_routines(id) ON DELETE SET NULL,
  day integer NOT NULL CHECK (day IN (3,7,15,30)),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','due','completed','skipped','expired','cancelled')),
  scheduled_for timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  answers jsonb NULL,
  referral_level text NOT NULL DEFAULT 'none'
    CHECK (referral_level IN ('none','consider_soon','seek_promptly','seek_emergency_care')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_check_ins_session_day_uq UNIQUE (analysis_session_id, day)
);

CREATE INDEX IF NOT EXISTS care_check_ins_status_due_idx
  ON public.care_check_ins (status, due_at);

-- =============================================================================
-- care_suggestions / care_notifications / care_feedback
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  check_in_id uuid NULL REFERENCES public.care_check_ins(id) ON DELETE SET NULL,
  title text NOT NULL,
  reason text NOT NULL,
  expected_effect text NOT NULL,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied boolean NOT NULL DEFAULT false,
  requires_user_confirm boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_check_in_id uuid NULL,
  fingerprint text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_notifications_fingerprint_uq UNIQUE (fingerprint)
);

CREATE TABLE IF NOT EXISTS public.care_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  used boolean NULL,
  purchased boolean NULL,
  satisfaction numeric NULL,
  irritation boolean NULL,
  stop_reason text NULL,
  repurchase_intent boolean NULL,
  concern_change text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- RLS: owner-only for authenticated; no anon SELECT of others
-- Admin aggregate via service_role only (no client policies for admin PII)
-- =============================================================================
ALTER TABLE public.care_analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_feedback ENABLE ROW LEVEL SECURITY;

-- Owner policies (authenticated)
CREATE POLICY care_sessions_owner_select ON public.care_analysis_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_sessions_owner_insert ON public.care_analysis_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_sessions_owner_update ON public.care_analysis_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_routines_owner_all ON public.care_routines
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_checkins_owner_all ON public.care_check_ins
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_suggestions_owner_all ON public.care_suggestions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_notifications_owner_all ON public.care_notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_feedback_owner_all ON public.care_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- routine items via parent routine ownership
CREATE POLICY care_routine_items_owner_select ON public.care_routine_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY care_routine_items_owner_write ON public.care_routine_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.care_analysis_sessions FROM anon;
REVOKE ALL ON public.care_routines FROM anon;
REVOKE ALL ON public.care_routine_items FROM anon;
REVOKE ALL ON public.care_check_ins FROM anon;
REVOKE ALL ON public.care_suggestions FROM anon;
REVOKE ALL ON public.care_notifications FROM anon;
REVOKE ALL ON public.care_feedback FROM anon;
