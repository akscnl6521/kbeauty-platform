-- Continuous care persistence (approved apply)
-- Name: create_continuous_care_persistence
-- Requires: public.profiles(id uuid) REFERENCES auth.users
-- Rollback (manual only): docs/132-care-migration-rollback.sql
-- No DELETE/TRUNCATE of existing operational data.
-- No RLS weakening. No anon table privileges.

-- =============================================================================
-- care_analysis_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Opaque client id for local↔account linking metadata only (never anon-readable via RLS)
  anonymous_session_id text NULL,
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
  referral_level text NOT NULL DEFAULT 'none'
    CHECK (referral_level IN ('none','consider_soon','seek_promptly','seek_emergency_care')),
  referral_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  dermatology_hints text[] NOT NULL DEFAULT '{}',
  consent_status text NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending','granted','revoked')),
  consented_at timestamptz NULL,
  consent_care_tracking boolean NOT NULL DEFAULT false,
  linked_account boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_analysis_sessions_user_idx
  ON public.care_analysis_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_analysis_sessions_anon_idx
  ON public.care_analysis_sessions (anonymous_session_id)
  WHERE anonymous_session_id IS NOT NULL;

-- =============================================================================
-- care_routines / care_routine_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  analysis_session_id uuid NULL
    REFERENCES public.care_analysis_sessions(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'default',
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','ended')),
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  conflict_notes text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS care_routines_user_session_version_uq
  ON public.care_routines (user_id, analysis_session_id, version)
  WHERE user_id IS NOT NULL AND analysis_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS care_routines_user_active_idx
  ON public.care_routines (user_id, status, updated_at DESC);

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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  progress_summary jsonb NULL,
  referral_level text NOT NULL DEFAULT 'none'
    CHECK (referral_level IN ('none','consider_soon','seek_promptly','seek_emergency_care')),
  referral_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_check_ins_session_day_uq UNIQUE (analysis_session_id, day)
);

CREATE INDEX IF NOT EXISTS care_check_ins_status_due_idx
  ON public.care_check_ins (status, due_at);
CREATE INDEX IF NOT EXISTS care_check_ins_user_idx
  ON public.care_check_ins (user_id, status, due_at);

-- =============================================================================
-- care_suggestions (routine adjustments — never auto-applied)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  routine_id uuid NULL REFERENCES public.care_routines(id) ON DELETE SET NULL,
  check_in_id uuid NULL REFERENCES public.care_check_ins(id) ON DELETE SET NULL,
  suggestion_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  reason text NOT NULL,
  expected_effect text NOT NULL DEFAULT '',
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_user_confirm boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','dismissed','expired')),
  applied boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_suggestions_confirm_true CHECK (requires_user_confirm = true)
);

CREATE INDEX IF NOT EXISTS care_suggestions_user_status_idx
  ON public.care_suggestions (user_id, status, created_at DESC);

-- =============================================================================
-- care_notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  check_in_id uuid NULL REFERENCES public.care_check_ins(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_check_in_id uuid NULL,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','read','dismissed','expired')),
  read boolean NOT NULL DEFAULT false,
  due_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT care_notifications_fingerprint_uq UNIQUE (fingerprint)
);

CREATE INDEX IF NOT EXISTS care_notifications_user_unread_idx
  ON public.care_notifications (user_id, status, created_at DESC)
  WHERE status = 'unread';

-- =============================================================================
-- care_feedback
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id bigint NULL REFERENCES public.products(id) ON DELETE SET NULL,
  routine_item_id uuid NULL REFERENCES public.care_routine_items(id) ON DELETE SET NULL,
  check_in_id uuid NULL REFERENCES public.care_check_ins(id) ON DELETE SET NULL,
  used boolean NULL,
  purchased boolean NULL,
  satisfaction numeric NULL,
  irritation boolean NULL,
  stop_reason text NULL,
  stopped_reason text NULL,
  repurchase_intent boolean NULL,
  concern_change text NULL,
  concern_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_feedback_user_idx
  ON public.care_feedback (user_id, created_at DESC);

-- =============================================================================
-- care_progress_snapshots
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  routine_id uuid NULL REFERENCES public.care_routines(id) ON DELETE SET NULL,
  check_in_id uuid NULL REFERENCES public.care_check_ins(id) ON DELETE SET NULL,
  dryness numeric NULL,
  oiliness numeric NULL,
  redness numeric NULL,
  breakouts numeric NULL,
  sensitivity numeric NULL,
  texture numeric NULL,
  pigmentation numeric NULL,
  satisfaction numeric NULL,
  adherence numeric NULL,
  comparison_status text NULL
    CHECK (comparison_status IN ('improved','similar','worsened','insufficient_data')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_progress_user_idx
  ON public.care_progress_snapshots (user_id, created_at DESC);

-- =============================================================================
-- care_audit_events (service_role only — no health free-text)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.care_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  event_type text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_audit_events_created_idx
  ON public.care_audit_events (created_at DESC);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.care_analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_audit_events ENABLE ROW LEVEL SECURITY;

-- Owner policies (authenticated only). No DELETE policies.
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

CREATE POLICY care_routines_owner_select ON public.care_routines
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_routines_owner_insert ON public.care_routines
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_routines_owner_update ON public.care_routines
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_checkins_owner_select ON public.care_check_ins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_checkins_owner_insert ON public.care_check_ins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_checkins_owner_update ON public.care_check_ins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_suggestions_owner_select ON public.care_suggestions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_suggestions_owner_insert ON public.care_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_suggestions_owner_update ON public.care_suggestions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_notifications_owner_select ON public.care_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_notifications_owner_insert ON public.care_notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_notifications_owner_update ON public.care_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_feedback_owner_select ON public.care_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_feedback_owner_insert ON public.care_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_feedback_owner_update ON public.care_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_progress_owner_select ON public.care_progress_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY care_progress_owner_insert ON public.care_progress_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY care_progress_owner_update ON public.care_progress_snapshots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_routine_items_owner_select ON public.care_routine_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY care_routine_items_owner_insert ON public.care_routine_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY care_routine_items_owner_update ON public.care_routine_items
  FOR UPDATE TO authenticated
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

-- care_audit_events: no client policies (service_role bypasses RLS)

-- Privileges: authenticated can use owner policies; anon none; no DELETE grants
REVOKE ALL ON public.care_analysis_sessions FROM PUBLIC;
REVOKE ALL ON public.care_routines FROM PUBLIC;
REVOKE ALL ON public.care_routine_items FROM PUBLIC;
REVOKE ALL ON public.care_check_ins FROM PUBLIC;
REVOKE ALL ON public.care_suggestions FROM PUBLIC;
REVOKE ALL ON public.care_notifications FROM PUBLIC;
REVOKE ALL ON public.care_feedback FROM PUBLIC;
REVOKE ALL ON public.care_progress_snapshots FROM PUBLIC;
REVOKE ALL ON public.care_audit_events FROM PUBLIC;

REVOKE ALL ON public.care_analysis_sessions FROM anon;
REVOKE ALL ON public.care_routines FROM anon;
REVOKE ALL ON public.care_routine_items FROM anon;
REVOKE ALL ON public.care_check_ins FROM anon;
REVOKE ALL ON public.care_suggestions FROM anon;
REVOKE ALL ON public.care_notifications FROM anon;
REVOKE ALL ON public.care_feedback FROM anon;
REVOKE ALL ON public.care_progress_snapshots FROM anon;
REVOKE ALL ON public.care_audit_events FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.care_analysis_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_routines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_routine_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_check_ins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_progress_snapshots TO authenticated;
-- audit: no grant to authenticated/anon

REVOKE DELETE ON public.care_analysis_sessions FROM authenticated, anon;
REVOKE DELETE ON public.care_routines FROM authenticated, anon;
REVOKE DELETE ON public.care_routine_items FROM authenticated, anon;
REVOKE DELETE ON public.care_check_ins FROM authenticated, anon;
REVOKE DELETE ON public.care_suggestions FROM authenticated, anon;
REVOKE DELETE ON public.care_notifications FROM authenticated, anon;
REVOKE DELETE ON public.care_feedback FROM authenticated, anon;
REVOKE DELETE ON public.care_progress_snapshots FROM authenticated, anon;
REVOKE DELETE ON public.care_audit_events FROM authenticated, anon;
