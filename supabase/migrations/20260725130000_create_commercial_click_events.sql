-- Staging/dated migration: real click/conversion event persistence for the
-- affiliate/ad monetization pipeline (ROADMAP stage 7, P3-T04 wiring).
-- Apply only to Staging (jfnj***gfd). Do NOT apply to Production without separate approval.
--
-- Scope: smallest viable subset — a single events table, matching the field
-- shape already produced by src/lib/commercial/revenueReadiness/clickConversionEvents.ts
-- (`scrubEventForAnalytics`). No real commercial agreements are activated by
-- this migration; no revenue amounts are invented.
--
-- Privacy (ANALYTICS_PRIVACY_BOUNDARY / HEALTH_TARGETING_KEYS, see
-- src/lib/commercial/revenueReadiness/constants.ts):
--   - Never store health/symptom/beauty-profile targeting keys.
--   - Never store real user PII — session_ref is an anonymous, client-generated
--     id (not a user id, not an email, not a device fingerprint).
--
-- Re-run safety: IF NOT EXISTS / idempotent indexes.

CREATE TABLE IF NOT EXISTS public.commercial_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  kind text NOT NULL,
  lane text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  offer_or_placement_id text NOT NULL,
  country_code text NULL,
  revenue_amount numeric NULL,
  currency text NULL,
  session_ref text NULL,
  screen text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_click_events_event_id_uq UNIQUE (event_id),
  CONSTRAINT commercial_click_events_kind_chk CHECK (
    kind IN ('impression', 'click', 'lead', 'conversion')
  ),
  CONSTRAINT commercial_click_events_lane_chk CHECK (
    lane IN ('affiliate', 'sponsored')
  ),
  CONSTRAINT commercial_click_events_entity_type_chk CHECK (
    entity_type IN ('product', 'clinic', 'media')
  ),
  CONSTRAINT commercial_click_events_revenue_amount_chk CHECK (
    revenue_amount IS NULL OR revenue_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS commercial_click_events_entity_idx
  ON public.commercial_click_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS commercial_click_events_created_at_idx
  ON public.commercial_click_events (created_at);

CREATE INDEX IF NOT EXISTS commercial_click_events_lane_kind_idx
  ON public.commercial_click_events (lane, kind);

ALTER TABLE public.commercial_click_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.commercial_click_events FROM PUBLIC;
REVOKE ALL ON TABLE public.commercial_click_events FROM anon;
REVOKE ALL ON TABLE public.commercial_click_events FROM authenticated;

-- service_role only: INSERT (writer, the /api/track/click route) + SELECT
-- (read-back verification / future admin reporting). No UPDATE, no DELETE —
-- events are append-only.
GRANT SELECT, INSERT ON TABLE public.commercial_click_events TO service_role;

SELECT 'create_commercial_click_events_v1' AS notice;
