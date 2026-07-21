-- DRAFT ONLY - DO NOT APPLY (v2 / Schema A)
-- Check-in care email queue for Master Plan stage 5 retention.
-- Not a dated supabase migration runner target.
-- Apply only after explicit Staging approval. Do NOT apply to Production from this file alone.
--
-- Schema A:
--   - Production care check-in emails may persist rows here.
--   - Preview admin test-send stays in-memory (no rows in this table).
--
-- Privacy:
--   - Never store recipient_email plaintext.
--   - recipient_mask only (no recipient_hash / pepper for v1).
--   - Never store subject/body plaintext; payload holds copy keys + URL paths only.
--
-- Idempotency (app layer):
--   checkin-email:v1:{user_id}:{checkin_id}:{milestone}:{kind}:email
--   Excludes scheduleDate, locale, template_version, recipient email.

CREATE TABLE IF NOT EXISTS public.checkin_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_id uuid NOT NULL REFERENCES public.care_check_ins(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  recipient_mask text NOT NULL,
  locale text NOT NULL DEFAULT 'ko',
  timezone text NOT NULL,
  template_version text NOT NULL DEFAULT 'v1',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_message_id text NULL,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  next_attempt_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz NULL,
  claimed_at timestamptz NULL,
  sent_at timestamptz NULL,
  failed_at timestamptz NULL,
  CONSTRAINT checkin_email_queue_milestone_chk CHECK (
    milestone IN ('day3', 'day7', 'day15', 'day30')
  ),
  CONSTRAINT checkin_email_queue_kind_chk CHECK (
    kind IN (
      'checkin_due',
      'checkin_reminder',
      'checkin_completed_confirmation',
      'care_alert'
    )
  ),
  CONSTRAINT checkin_email_queue_channel_chk CHECK (channel = 'email'),
  CONSTRAINT checkin_email_queue_status_chk CHECK (
    status IN (
      'pending',
      'processing',
      'sent',
      'failed',
      'skipped_duplicate',
      'cancelled'
    )
  ),
  CONSTRAINT checkin_email_queue_idempotency_key_uq UNIQUE (idempotency_key),
  CONSTRAINT checkin_email_queue_retry_count_chk CHECK (retry_count >= 0),
  CONSTRAINT checkin_email_queue_recipient_mask_chk CHECK (char_length(recipient_mask) >= 3),
  CONSTRAINT checkin_email_queue_no_plaintext_payload_chk CHECK (
    NOT (payload ? 'recipient_email')
    AND NOT (payload ? 'email')
    AND NOT (payload ? 'to')
    AND NOT (payload ? 'subject')
    AND NOT (payload ? 'body')
    AND NOT (payload ? 'html')
    AND NOT (payload ? 'text')
  )
);

CREATE INDEX IF NOT EXISTS checkin_email_queue_status_next_attempt_idx
  ON public.checkin_email_queue (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS checkin_email_queue_checkin_id_idx
  ON public.checkin_email_queue (checkin_id);

CREATE INDEX IF NOT EXISTS checkin_email_queue_user_id_idx
  ON public.checkin_email_queue (user_id);

CREATE INDEX IF NOT EXISTS checkin_email_queue_claimed_at_idx
  ON public.checkin_email_queue (claimed_at)
  WHERE status = 'processing';

ALTER TABLE public.checkin_email_queue ENABLE ROW LEVEL SECURITY;

-- No authenticated/anon policies: clients must not read or write the queue.
-- service_role bypasses RLS; still grant only SELECT/INSERT/UPDATE (no DELETE).

REVOKE ALL ON TABLE public.checkin_email_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.checkin_email_queue FROM anon;
REVOKE ALL ON TABLE public.checkin_email_queue FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.checkin_email_queue TO service_role;

SELECT 'DRAFT_DO_NOT_APPLY_checkin_email_queue_v2' AS notice;
