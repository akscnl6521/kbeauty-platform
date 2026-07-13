-- Create admin authentication tables (admin_users + admin_role_history).
-- Purpose: admin permission SSOT separate from public.profiles.role.
-- Apply name (MCP): create_admin_auth_tables
--
-- Does NOT: alter profiles, alter auth.users, create policies,
--           seed admin rows, revoke service_role, or touch product tables.
-- Do NOT apply until human review + GitHub backup.
-- First admin bootstrap is Dashboard SQL only (see docs/47) — not in this file.

-- =============================================================================
-- 1. admin_users
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL
    CHECK (role IN (
      'admin',
      'reviewer',
      'researcher',
      'catalog_manager',
      'read_only'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Bootstrap: NULL. Later grants should set created_by to acting admin.
  created_by uuid DEFAULT NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  last_reviewed_at timestamptz DEFAULT NULL,
  notes text DEFAULT NULL,
  CONSTRAINT admin_users_notes_nonempty_chk CHECK (
    notes IS NULL OR btrim(notes) <> ''
  ),
  CONSTRAINT admin_users_last_reviewed_at_chk CHECK (
    last_reviewed_at IS NULL OR last_reviewed_at >= created_at
  )
);

-- role+active covers role-prefix lookups; active alone for "all active admins"
CREATE INDEX IF NOT EXISTS admin_users_role_active_idx
  ON public.admin_users (role, active);
CREATE INDEX IF NOT EXISTS admin_users_active_idx
  ON public.admin_users (active);
CREATE INDEX IF NOT EXISTS admin_users_updated_at_idx
  ON public.admin_users (updated_at);

COMMENT ON TABLE public.admin_users IS
  'Admin permission SSOT. Not readable by anon/authenticated. Server service_role only.';
COMMENT ON COLUMN public.admin_users.role IS
  'admin | reviewer | researcher | catalog_manager | read_only';

-- =============================================================================
-- 2. admin_role_history
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  old_role text DEFAULT NULL
    CHECK (
      old_role IS NULL
      OR old_role IN (
        'admin',
        'reviewer',
        'researcher',
        'catalog_manager',
        'read_only'
      )
    ),
  new_role text DEFAULT NULL
    CHECK (
      new_role IS NULL
      OR new_role IN (
        'admin',
        'reviewer',
        'researcher',
        'catalog_manager',
        'read_only'
      )
    ),
  old_active boolean DEFAULT NULL,
  new_active boolean DEFAULT NULL,
  changed_by uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_role_history_reason_nonempty_chk CHECK (
    btrim(reason) <> ''
  ),
  -- At least one dimension present (role and/or active)
  CONSTRAINT admin_role_history_change_present_chk CHECK (
    old_role IS NOT NULL
    OR new_role IS NOT NULL
    OR old_active IS NOT NULL
    OR new_active IS NOT NULL
  ),
  -- Reject no-op rows (identical old/new on both dimensions)
  CONSTRAINT admin_role_history_meaningful_change_chk CHECK (
    (old_role IS DISTINCT FROM new_role)
    OR (old_active IS DISTINCT FROM new_active)
  )
);

-- (target_user_id, changed_at) covers target_user_id prefix; skip redundant single-col
CREATE INDEX IF NOT EXISTS admin_role_history_target_changed_at_idx
  ON public.admin_role_history (target_user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS admin_role_history_changed_by_idx
  ON public.admin_role_history (changed_by);
CREATE INDEX IF NOT EXISTS admin_role_history_changed_at_idx
  ON public.admin_role_history (changed_at DESC);

COMMENT ON TABLE public.admin_role_history IS
  'Audit log for admin role/active changes. No client policies. Server only.';

-- =============================================================================
-- 3. RLS (policy count intentionally 0)
-- =============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. Privileges — defeat public default ACL; no client GRANT
-- Do NOT revoke service_role.
-- updated_at: no DB trigger (app/server sets on write). See docs/47.
-- =============================================================================
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.admin_role_history FROM anon, authenticated;

-- No GRANT to anon/authenticated.
-- No client RLS policies (policy count remains 0).
-- No seed INSERT (bootstrap via Dashboard SQL after apply — docs/47).
