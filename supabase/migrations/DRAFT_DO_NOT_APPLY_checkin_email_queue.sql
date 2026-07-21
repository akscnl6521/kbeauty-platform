-- DRAFT ONLY - DO NOT APPLY
-- Check-in care email queue schema for Master Plan stage 5 retention.
-- This file is intentionally not a dated migration runner target.
-- Apply only after explicit Staging approval and schema review.
--
-- Staging review 2026-07-21: NOT READY (do not create table yet).
-- Blockers before any Staging apply:
--   1) ENABLE RLS + policies (service_role worker write; no anon)
--   2) GRANT SELECT/INSERT/UPDATE to service_role (no DELETE/TRUNCATE)
--   3) v1 privacy: recipient_mask required; recipient_hash optional/nullable (no new pepper)
--   4) Align idempotency with policy v1: checkin-email:v1:{subject}:{checkin}:{milestone}:{kind}:email
--      (exclude scheduleDate / locale / template_version)
--   5) status CHECK constraint for queue statuses
-- Preview remains Schema A: in-memory + console audit (no queue table required).
--
-- Privacy:
--   - Do NOT store recipient_email plaintext.
--   - Store recipient_mask (e.g. u***@example.com); recipient_hash optional for v1.
-- RLS:
--   - Enable RLS before any Staging apply.
--   - service_role for worker writes; authenticated users SELECT own rows only.
--   - No public anon access to queue rows.

CREATE TABLE IF NOT EXISTS public.checkin_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  anonymous_session_id text NULL,
  checkin_id text NOT NULL,
  milestone text NOT NULL,
  email_kind text NOT NULL,
  recipient_mask text NOT NULL,
  recipient_hash text NOT NULL,
  locale text NOT NULL DEFAULT 'ko',
  timezone text NOT NULL,
  scheduled_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NULL,
  last_error_code text NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  CONSTRAINT checkin_email_queue_subject_chk CHECK (
    user_id IS NOT NULL OR anonymous_session_id IS NOT NULL
  ),
  CONSTRAINT checkin_email_queue_idempotency_key_uq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS checkin_email_queue_status_next_attempt_idx
  ON public.checkin_email_queue (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS checkin_email_queue_checkin_id_idx
  ON public.checkin_email_queue (checkin_id);

-- ALTER TABLE public.checkin_email_queue ENABLE ROW LEVEL SECURITY;
-- Policies intentionally omitted until Staging approval.

SELECT 'DRAFT_DO_NOT_APPLY' AS notice;
