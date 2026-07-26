-- DRAFT ONLY - DO NOT APPLY
-- Photo comparison consent, asset metadata, deletion queue, audit events.
-- DO NOT APPLY until explicit Staging approval.
-- Separate private Storage bucket `care-photos` required later (not created in this SQL).
--
-- Privacy:
--   - Opaque UUID object paths only (no email/name in paths).
--   - No face embeddings, no EXIF/GPS jsonb columns.
--   - Audit metadata blocks email/name/path-with-email keys.

CREATE TABLE IF NOT EXISTS public.photo_comparison_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_version text NOT NULL DEFAULT 'v1',
  state text NOT NULL,
  save_for_comparison boolean NOT NULL DEFAULT false,
  learning_opt_in boolean NOT NULL DEFAULT false,
  retention_acknowledged boolean NOT NULL DEFAULT false,
  analysis_consent boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 90,
  analysis_session_id uuid NULL REFERENCES public.care_analysis_sessions(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  CONSTRAINT photo_comparison_consents_state_chk CHECK (
    state IN ('analysis_only', 'save_for_comparison', 'learning_opt_in', 'revoked')
  ),
  CONSTRAINT photo_comparison_consents_retention_days_chk CHECK (retention_days >= 1 AND retention_days <= 365)
);

CREATE TABLE IF NOT EXISTS public.photo_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  analysis_session_id uuid NULL REFERENCES public.care_analysis_sessions(id) ON DELETE SET NULL,
  storage_status text NOT NULL DEFAULT 'ephemeral',
  object_path_original text NOT NULL,
  object_path_thumb text NOT NULL,
  object_path_preview text NOT NULL,
  retention_days integer NOT NULL DEFAULT 90,
  expires_at timestamptz NULL,
  consent_id uuid NULL REFERENCES public.photo_comparison_consents(id) ON DELETE SET NULL,
  learning_opt_in boolean NOT NULL DEFAULT false,
  content_type text NOT NULL DEFAULT 'image/jpeg',
  byte_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT photo_assets_storage_status_chk CHECK (
    storage_status IN ('ephemeral', 'stored', 'pending_delete', 'deleted', 'delete_failed')
  ),
  CONSTRAINT photo_assets_byte_size_chk CHECK (byte_size >= 0)
);

CREATE TABLE IF NOT EXISTS public.photo_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.photo_assets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT photo_deletion_requests_status_chk CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  CONSTRAINT photo_deletion_requests_idempotency_key_uq UNIQUE (idempotency_key),
  CONSTRAINT photo_deletion_requests_retry_count_chk CHECK (retry_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.photo_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id uuid NULL REFERENCES public.photo_assets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_audit_events_no_pii_metadata_chk CHECK (
    NOT (metadata ? 'email')
    AND NOT (metadata ? 'recipient_email')
    AND NOT (metadata ? 'name')
    AND NOT (metadata ? 'display_name')
    AND NOT (metadata ? 'path_with_email')
    AND NOT (metadata ? 'object_path_with_email')
  )
);

CREATE INDEX IF NOT EXISTS photo_comparison_consents_user_id_idx
  ON public.photo_comparison_consents (user_id);

CREATE INDEX IF NOT EXISTS photo_assets_user_id_idx
  ON public.photo_assets (user_id);

CREATE INDEX IF NOT EXISTS photo_assets_storage_status_idx
  ON public.photo_assets (storage_status);

CREATE INDEX IF NOT EXISTS photo_assets_expires_at_idx
  ON public.photo_assets (expires_at)
  WHERE storage_status = 'stored';

CREATE INDEX IF NOT EXISTS photo_deletion_requests_user_id_idx
  ON public.photo_deletion_requests (user_id);

CREATE INDEX IF NOT EXISTS photo_deletion_requests_status_idx
  ON public.photo_deletion_requests (status);

CREATE INDEX IF NOT EXISTS photo_audit_events_user_id_idx
  ON public.photo_audit_events (user_id);

ALTER TABLE public.photo_comparison_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.photo_comparison_consents FROM PUBLIC;
REVOKE ALL ON TABLE public.photo_comparison_consents FROM anon;
REVOKE ALL ON TABLE public.photo_comparison_consents FROM authenticated;
REVOKE ALL ON TABLE public.photo_assets FROM PUBLIC;
REVOKE ALL ON TABLE public.photo_assets FROM anon;
REVOKE ALL ON TABLE public.photo_assets FROM authenticated;
REVOKE ALL ON TABLE public.photo_deletion_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.photo_deletion_requests FROM anon;
REVOKE ALL ON TABLE public.photo_deletion_requests FROM authenticated;
REVOKE ALL ON TABLE public.photo_audit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.photo_audit_events FROM anon;
REVOKE ALL ON TABLE public.photo_audit_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_comparison_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_deletion_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_audit_events TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_comparison_consents TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_assets TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_deletion_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.photo_audit_events TO service_role;

REVOKE DELETE ON TABLE public.photo_comparison_consents FROM authenticated, anon;
REVOKE DELETE ON TABLE public.photo_assets FROM authenticated, anon;
REVOKE DELETE ON TABLE public.photo_deletion_requests FROM authenticated, anon;
REVOKE DELETE ON TABLE public.photo_audit_events FROM authenticated, anon;

CREATE POLICY photo_consents_owner_select ON public.photo_comparison_consents
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY photo_consents_owner_insert ON public.photo_comparison_consents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY photo_consents_owner_update ON public.photo_comparison_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY photo_assets_owner_select ON public.photo_assets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY photo_assets_owner_insert ON public.photo_assets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY photo_assets_owner_update ON public.photo_assets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY photo_deletion_requests_owner_select ON public.photo_deletion_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY photo_deletion_requests_owner_insert ON public.photo_deletion_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY photo_deletion_requests_owner_update ON public.photo_deletion_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY photo_audit_events_owner_select ON public.photo_audit_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY photo_audit_events_owner_insert ON public.photo_audit_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY photo_audit_events_owner_update ON public.photo_audit_events
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

SELECT 'draft_care_photo_comparison_v1' AS notice;
