-- DRAFT ONLY - DO NOT APPLY
-- Durable BeautyProfile server storage (cross-device account sync).
-- DO NOT APPLY until explicit Staging approval.
-- Production apply is forbidden without separate explicit approval.
--
-- Privacy:
--   - Owner-scoped RLS only (auth.uid()).
--   - No email/name columns; profile jsonb must not store photo pixels.
--   - No DELETE grant to authenticated/anon (soft-replace via UPDATE).

CREATE TABLE IF NOT EXISTS public.beauty_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_version integer NOT NULL DEFAULT 1,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beauty_profiles_version_chk CHECK (profile_version >= 1),
  CONSTRAINT beauty_profiles_no_pii_keys_chk CHECK (
    NOT (profile ? 'email')
    AND NOT (profile ? 'recipient_email')
    AND NOT (profile ? 'name')
    AND NOT (profile ? 'display_name')
    AND NOT (profile ? 'phone')
  )
);

CREATE INDEX IF NOT EXISTS beauty_profiles_updated_at_idx
  ON public.beauty_profiles (updated_at DESC);

ALTER TABLE public.beauty_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.beauty_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.beauty_profiles FROM anon;
REVOKE ALL ON TABLE public.beauty_profiles FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.beauty_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.beauty_profiles TO service_role;

REVOKE DELETE ON TABLE public.beauty_profiles FROM authenticated, anon;

CREATE POLICY beauty_profiles_owner_select ON public.beauty_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY beauty_profiles_owner_insert ON public.beauty_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY beauty_profiles_owner_update ON public.beauty_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
