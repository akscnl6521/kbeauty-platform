-- BLOCKER: Durable operations alerts (optional)
-- Do NOT apply automatically. File-based acknowledgement is live without this.
-- Apply name suggestion: create_operations_alerts

CREATE TABLE IF NOT EXISTS public.operations_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  status text NOT NULL CHECK (status IN ('open','acknowledged','resolved','reopened')),
  title text NOT NULL,
  message text NOT NULL,
  affected_count integer NOT NULL DEFAULT 0,
  threshold_value text NULL,
  current_value text NULL,
  entity_type text NULL,
  safe_entity_reference text NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  acknowledged_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operations_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.operations_alerts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operations_alert_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.operations_alerts(id) ON DELETE CASCADE,
  actor_role text NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operations_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_alert_acknowledgements ENABLE ROW LEVEL SECURITY;
-- service_role only; no anon/authenticated policies.
