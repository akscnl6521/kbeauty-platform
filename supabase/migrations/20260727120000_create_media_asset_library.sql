-- Staging/dated migration: §36.4 media asset library (usage video infrastructure).
-- Apply only to Staging (jfnj***gfd). Do NOT apply to Production without separate approval.
--
-- Scope of this track:
--   - Structure only. No screen consumes these tables yet (/routine, /results untouched).
--   - Category-common assets first (scope='category_common'); product-specific comes later.
--
-- §36.4 required-field mapping (fields are distributed, not duplicated):
--   asset_type, source_type, source_url, storage_url, language, country, duration,
--   concern_tags, body_area_tags, routine_step, disclosure, verification_status,
--   verified_at            -> public.media_assets
--   rights_status, rights_start_at, rights_end_at
--                          -> public.media_rights (one row per grant, asset may hold several)
--   product_id, variant_id -> public.product_videos (link table; a category-common asset has none)
--
-- Rights policy (§36.3):
--   - "무단 복제 영상 금지" is enforced in the DB: storage_url may only be set for assets we
--     produced or contracted (platform_original / contracted_creator). Brand, retailer and UGC
--     sources are embed/link only — see media_assets_no_unauthorized_copy_chk.
--   - Every external asset must carry source, rights window and territory in media_rights.
--
-- Privacy:
--   - video_performance_events is aggregate telemetry. No user_id, no email, no IP.
--
-- Re-run safety: IF NOT EXISTS everywhere. No DROP / DELETE / TRUNCATE.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- media_assets — canonical asset record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- what kind of content this is (§36.2)
  asset_type text NOT NULL,
  media_type text NOT NULL DEFAULT 'video',
  -- category_common = no product name attached (this track's target)
  scope text NOT NULL DEFAULT 'category_common',

  -- where it came from (§36.3)
  source_type text NOT NULL,
  source_url text NULL,
  source_domain text NULL,
  source_page_url text NULL,
  -- only set when we are allowed to hold a copy (see copy policy CHECK below)
  storage_url text NULL,
  embed_provider text NOT NULL DEFAULT 'none',
  embed_id text NULL,
  channel_name text NULL,
  channel_url text NULL,

  title text NOT NULL,
  summary text NULL,

  -- localisation + reach (§36.4)
  language text NOT NULL DEFAULT 'ko',
  country text NULL,
  duration_seconds integer NULL,

  -- routing / matching context
  routine_step text NULL,
  time_of_day text NULL,
  category_slug text NULL,
  catalog_domain text NULL,
  concern_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  body_area_tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- disclosure (§36.3 — AI / sponsorship / brand-provided)
  content_relationship text NOT NULL DEFAULT 'organic',
  disclosure text NULL,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_name text NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,

  -- review flags a human must clear before display
  contains_medical_claim boolean NOT NULL DEFAULT false,
  contains_before_after boolean NOT NULL DEFAULT false,
  shows_product_name boolean NOT NULL DEFAULT false,

  -- review lifecycle
  verification_status text NOT NULL DEFAULT 'draft',
  verified_at timestamptz NULL,
  verified_by uuid NULL REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  review_note text NULL,

  -- liveness re-check (§41 영상 URL 정상 여부 1~7일)
  last_checked_at timestamptz NULL,
  last_http_status integer NULL,
  is_accessible boolean NOT NULL DEFAULT false,
  next_check_due_at timestamptz NULL,

  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_assets_asset_type_chk CHECK (
    asset_type IN (
      'product_usage',
      'category_usage',
      'routine_morning',
      'routine_evening',
      'routine_weekly',
      'routine_concern',
      'makeup_application',
      'base_makeup',
      'eye_makeup',
      'lip_makeup',
      'sun_care_amount',
      'scalp_hair_care',
      'texture_finish',
      'before_after_guide',
      'adverse_reaction_guide',
      'other'
    )
  ),
  CONSTRAINT media_assets_media_type_chk CHECK (
    media_type IN ('video', 'animation', 'image')
  ),
  CONSTRAINT media_assets_scope_chk CHECK (
    scope IN ('category_common', 'product_specific', 'brand_general')
  ),
  CONSTRAINT media_assets_source_type_chk CHECK (
    source_type IN (
      'official_brand',
      'authorized_retailer',
      'platform_original',
      'contracted_creator',
      'licensed_ugc'
    )
  ),
  CONSTRAINT media_assets_embed_provider_chk CHECK (
    embed_provider IN ('none', 'youtube', 'vimeo', 'self_hosted')
  ),
  CONSTRAINT media_assets_content_relationship_chk CHECK (
    content_relationship IN (
      'organic',
      'ai_generated',
      'sponsored',
      'advertisement',
      'brand_provided',
      'affiliate',
      'creator_partner'
    )
  ),
  CONSTRAINT media_assets_verification_status_chk CHECK (
    verification_status IN (
      'draft',
      'needs_review',
      'approved',
      'rejected',
      'expired',
      'revoked'
    )
  ),
  CONSTRAINT media_assets_time_of_day_chk CHECK (
    time_of_day IS NULL OR time_of_day IN ('am', 'pm', 'am_pm', 'weekly', 'as_needed')
  ),
  CONSTRAINT media_assets_title_nonempty_chk CHECK (btrim(title) <> ''),
  CONSTRAINT media_assets_duration_chk CHECK (
    duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 3600)
  ),
  CONSTRAINT media_assets_language_chk CHECK (char_length(language) BETWEEN 2 AND 8),
  CONSTRAINT media_assets_country_chk CHECK (
    country IS NULL OR char_length(country) = 2
  ),
  CONSTRAINT media_assets_concern_tags_array_chk CHECK (
    jsonb_typeof(concern_tags) = 'array'
  ),
  CONSTRAINT media_assets_body_area_tags_array_chk CHECK (
    jsonb_typeof(body_area_tags) = 'array'
  ),
  -- must be reachable somehow
  CONSTRAINT media_assets_locator_present_chk CHECK (
    source_url IS NOT NULL OR storage_url IS NOT NULL
  ),
  CONSTRAINT media_assets_https_source_chk CHECK (
    source_url IS NULL OR source_url LIKE 'https://%'
  ),
  CONSTRAINT media_assets_https_page_chk CHECK (
    source_page_url IS NULL OR source_page_url LIKE 'https://%'
  ),
  CONSTRAINT media_assets_https_storage_chk CHECK (
    storage_url IS NULL OR storage_url LIKE 'https://%'
  ),
  -- §36.3: no unauthorized copies. External sources are embed/link only.
  CONSTRAINT media_assets_no_unauthorized_copy_chk CHECK (
    storage_url IS NULL
    OR source_type IN ('platform_original', 'contracted_creator')
  ),
  -- §36.3: AI-generated content must be declared as such
  CONSTRAINT media_assets_ai_disclosure_chk CHECK (
    is_ai_generated = false OR content_relationship = 'ai_generated'
  ),
  CONSTRAINT media_assets_sponsor_disclosure_chk CHECK (
    is_sponsored = false
    OR (content_relationship IN ('sponsored', 'advertisement') AND disclosure IS NOT NULL)
  ),
  -- category-common assets must not carry a product name (this track's rule)
  CONSTRAINT media_assets_category_common_no_product_chk CHECK (
    scope <> 'category_common' OR shows_product_name = false
  ),
  CONSTRAINT media_assets_verified_at_chk CHECK (
    verification_status <> 'approved' OR verified_at IS NOT NULL
  ),
  CONSTRAINT media_assets_embed_pair_chk CHECK (
    (embed_provider = 'none' AND embed_id IS NULL)
    OR (embed_provider <> 'none' AND embed_id IS NOT NULL)
  ),
  CONSTRAINT media_assets_source_url_uq UNIQUE (source_url)
);

CREATE INDEX IF NOT EXISTS media_assets_status_idx
  ON public.media_assets (verification_status);
CREATE INDEX IF NOT EXISTS media_assets_scope_type_idx
  ON public.media_assets (scope, asset_type);
CREATE INDEX IF NOT EXISTS media_assets_category_idx
  ON public.media_assets (category_slug);
CREATE INDEX IF NOT EXISTS media_assets_next_check_idx
  ON public.media_assets (next_check_due_at)
  WHERE verification_status = 'approved';

-- ---------------------------------------------------------------------------
-- media_rights — rights grant per asset (§36.3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,

  rights_status text NOT NULL,
  -- what the grant rests on: ToS clause, written permission, contract id, licence name
  rights_basis text NOT NULL,
  rights_holder text NOT NULL,

  allows_embed boolean NOT NULL DEFAULT false,
  allows_copy boolean NOT NULL DEFAULT false,
  allows_download boolean NOT NULL DEFAULT false,
  allows_modification boolean NOT NULL DEFAULT false,

  rights_start_at timestamptz NULL,
  rights_end_at timestamptz NULL,

  is_worldwide boolean NOT NULL DEFAULT false,
  territory_codes jsonb NOT NULL DEFAULT '[]'::jsonb,

  evidence_url text NULL,
  evidence_note text NULL,
  granted_by text NULL,

  -- §41 재확인 주기: rights expiry / re-verification
  review_due_at timestamptz NULL,
  last_reviewed_at timestamptz NULL,

  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_rights_status_chk CHECK (
    rights_status IN (
      'owned',
      'brand_permission',
      'retailer_permission',
      'licensed',
      'creator_contract',
      'user_consent',
      'embed_only',
      'unknown',
      'expired',
      'revoked'
    )
  ),
  CONSTRAINT media_rights_basis_nonempty_chk CHECK (btrim(rights_basis) <> ''),
  CONSTRAINT media_rights_holder_nonempty_chk CHECK (btrim(rights_holder) <> ''),
  CONSTRAINT media_rights_window_chk CHECK (
    rights_start_at IS NULL
    OR rights_end_at IS NULL
    OR rights_end_at > rights_start_at
  ),
  CONSTRAINT media_rights_territory_array_chk CHECK (
    jsonb_typeof(territory_codes) = 'array'
  ),
  CONSTRAINT media_rights_territory_present_chk CHECK (
    is_worldwide = true OR jsonb_array_length(territory_codes) > 0
  ),
  -- embed_only never permits copying or downloading
  CONSTRAINT media_rights_embed_only_chk CHECK (
    rights_status <> 'embed_only'
    OR (allows_copy = false AND allows_download = false AND allows_modification = false)
  ),
  -- unknown rights permit nothing
  CONSTRAINT media_rights_unknown_chk CHECK (
    rights_status <> 'unknown'
    OR (allows_embed = false AND allows_copy = false AND allows_download = false)
  ),
  CONSTRAINT media_rights_https_evidence_chk CHECK (
    evidence_url IS NULL OR evidence_url LIKE 'https://%'
  )
);

CREATE INDEX IF NOT EXISTS media_rights_asset_idx
  ON public.media_rights (media_asset_id);
CREATE INDEX IF NOT EXISTS media_rights_expiry_idx
  ON public.media_rights (rights_end_at);
CREATE INDEX IF NOT EXISTS media_rights_review_due_idx
  ON public.media_rights (review_due_at);

-- ---------------------------------------------------------------------------
-- media_localizations — per-locale title / caption track
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_localizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  locale text NOT NULL,
  title text NULL,
  summary text NULL,
  caption_url text NULL,
  caption_kind text NOT NULL DEFAULT 'none',
  is_machine_translated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_localizations_locale_chk CHECK (char_length(locale) BETWEEN 2 AND 8),
  CONSTRAINT media_localizations_caption_kind_chk CHECK (
    caption_kind IN ('none', 'burned_in', 'sidecar', 'provider_auto')
  ),
  CONSTRAINT media_localizations_https_caption_chk CHECK (
    caption_url IS NULL OR caption_url LIKE 'https://%'
  ),
  CONSTRAINT media_localizations_asset_locale_uq UNIQUE (media_asset_id, locale)
);

-- ---------------------------------------------------------------------------
-- product_videos — asset ↔ product/variant link (§36.4 product_id, variant_id)
-- Designed now, intentionally unpopulated this track.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  product_id bigint NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NULL
    REFERENCES public.product_variants(id) ON DELETE SET NULL,
  relation text NOT NULL DEFAULT 'primary_usage',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  linked_by uuid NULL REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_videos_relation_chk CHECK (
    relation IN ('primary_usage', 'texture', 'application', 'routine_context', 'other')
  ),
  CONSTRAINT product_videos_display_order_chk CHECK (display_order >= 0),
  CONSTRAINT product_videos_asset_product_variant_uq
    UNIQUE (media_asset_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS product_videos_product_idx
  ON public.product_videos (product_id);
CREATE INDEX IF NOT EXISTS product_videos_asset_idx
  ON public.product_videos (media_asset_id);

-- ---------------------------------------------------------------------------
-- routine_videos — asset ↔ routine/category context (this track's link table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.routine_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  routine_context text NOT NULL,
  category_slug text NULL,
  catalog_domain text NULL,
  routine_step text NULL,
  step_order integer NULL,
  concern_slug text NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT routine_videos_context_chk CHECK (
    routine_context IN (
      'am_routine',
      'pm_routine',
      'weekly_routine',
      'concern_routine',
      'category_common'
    )
  ),
  CONSTRAINT routine_videos_step_order_chk CHECK (
    step_order IS NULL OR step_order >= 1
  ),
  CONSTRAINT routine_videos_display_order_chk CHECK (display_order >= 0),
  -- a category-common link needs a category to attach to
  CONSTRAINT routine_videos_category_present_chk CHECK (
    routine_context <> 'category_common' OR category_slug IS NOT NULL
  ),
  CONSTRAINT routine_videos_concern_present_chk CHECK (
    routine_context <> 'concern_routine' OR concern_slug IS NOT NULL
  ),
  CONSTRAINT routine_videos_asset_context_uq
    UNIQUE (media_asset_id, routine_context, category_slug, concern_slug)
);

CREATE INDEX IF NOT EXISTS routine_videos_context_idx
  ON public.routine_videos (routine_context, category_slug);
CREATE INDEX IF NOT EXISTS routine_videos_asset_idx
  ON public.routine_videos (media_asset_id);

-- ---------------------------------------------------------------------------
-- creator_assets — contracted creator provenance (§36.3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  creator_name text NOT NULL,
  creator_platform text NOT NULL,
  creator_profile_url text NULL,
  contract_reference text NOT NULL,
  contract_start_at timestamptz NULL,
  contract_end_at timestamptz NULL,
  compensation_disclosed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT creator_assets_platform_chk CHECK (
    creator_platform IN ('youtube', 'instagram', 'tiktok', 'naver', 'other')
  ),
  CONSTRAINT creator_assets_name_nonempty_chk CHECK (btrim(creator_name) <> ''),
  CONSTRAINT creator_assets_contract_nonempty_chk CHECK (btrim(contract_reference) <> ''),
  CONSTRAINT creator_assets_window_chk CHECK (
    contract_start_at IS NULL
    OR contract_end_at IS NULL
    OR contract_end_at > contract_start_at
  ),
  CONSTRAINT creator_assets_https_profile_chk CHECK (
    creator_profile_url IS NULL OR creator_profile_url LIKE 'https://%'
  ),
  CONSTRAINT creator_assets_asset_uq UNIQUE (media_asset_id)
);

-- ---------------------------------------------------------------------------
-- video_usage_steps — timestamped usage breakdown inside one video
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_usage_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  start_seconds integer NULL,
  end_seconds integer NULL,
  instruction text NOT NULL,
  amount_label text NULL,
  application_area jsonb NOT NULL DEFAULT '[]'::jsonb,
  caution_text text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT video_usage_steps_order_chk CHECK (step_order >= 1),
  CONSTRAINT video_usage_steps_instruction_nonempty_chk CHECK (btrim(instruction) <> ''),
  CONSTRAINT video_usage_steps_seconds_chk CHECK (
    start_seconds IS NULL
    OR end_seconds IS NULL
    OR end_seconds >= start_seconds
  ),
  CONSTRAINT video_usage_steps_area_array_chk CHECK (
    jsonb_typeof(application_area) = 'array'
  ),
  CONSTRAINT video_usage_steps_asset_order_uq UNIQUE (media_asset_id, step_order)
);

-- ---------------------------------------------------------------------------
-- video_performance_events — aggregate playback telemetry. No PII.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_performance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  surface text NOT NULL,
  locale text NULL,
  country text NULL,
  watched_seconds integer NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT video_performance_events_type_chk CHECK (
    event_type IN ('impression', 'play_start', 'play_complete', 'cta_click', 'error')
  ),
  CONSTRAINT video_performance_events_surface_chk CHECK (btrim(surface) <> ''),
  CONSTRAINT video_performance_events_watched_chk CHECK (
    watched_seconds IS NULL OR watched_seconds >= 0
  ),
  CONSTRAINT video_performance_events_country_chk CHECK (
    country IS NULL OR char_length(country) = 2
  ),
  -- privacy: this table must never carry identity
  CONSTRAINT video_performance_events_no_pii_chk CHECK (
    NOT (metadata ? 'user_id')
    AND NOT (metadata ? 'email')
    AND NOT (metadata ? 'ip')
    AND NOT (metadata ? 'ip_address')
    AND NOT (metadata ? 'session_id')
  )
);

CREATE INDEX IF NOT EXISTS video_performance_events_asset_idx
  ON public.video_performance_events (media_asset_id, occurred_at);

-- ---------------------------------------------------------------------------
-- media_review_events — audit trail for /admin/media-review decisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL
    REFERENCES public.media_assets(id) ON DELETE CASCADE,
  reviewer_id uuid NULL
    REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  decision text NOT NULL,
  previous_status text NULL,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_review_events_decision_chk CHECK (
    decision IN ('approved', 'rejected', 'needs_review', 'revoked', 'expired', 'reopened')
  ),
  CONSTRAINT media_review_events_reason_array_chk CHECK (
    jsonb_typeof(reason_codes) = 'array'
  ),
  -- a rejection must say why
  CONSTRAINT media_review_events_reject_reason_chk CHECK (
    decision <> 'rejected' OR jsonb_array_length(reason_codes) > 0
  )
);

CREATE INDEX IF NOT EXISTS media_review_events_asset_idx
  ON public.media_review_events (media_asset_id, created_at);

-- ---------------------------------------------------------------------------
-- Read-only helper view: assets that pass the rights + review gate right now.
-- No screen reads this yet; it exists so display code never re-derives the rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.media_assets_publishable AS
SELECT
  a.id,
  a.asset_type,
  a.scope,
  a.source_type,
  a.source_url,
  a.storage_url,
  a.embed_provider,
  a.embed_id,
  a.title,
  a.language,
  a.country,
  a.duration_seconds,
  a.routine_step,
  a.time_of_day,
  a.category_slug,
  a.concern_tags,
  a.body_area_tags,
  a.content_relationship,
  a.disclosure,
  a.verified_at,
  r.rights_status,
  r.rights_end_at
FROM public.media_assets a
JOIN public.media_rights r ON r.media_asset_id = a.id
WHERE a.verification_status = 'approved'
  AND a.is_accessible = true
  AND a.contains_medical_claim = false
  AND r.rights_status NOT IN ('unknown', 'expired', 'revoked')
  AND r.allows_embed = true
  AND (r.rights_start_at IS NULL OR r.rights_start_at <= now())
  AND (r.rights_end_at IS NULL OR r.rights_end_at > now());

-- ---------------------------------------------------------------------------
-- RLS + privileges. Nothing is public in this track: no anon / authenticated
-- grants. Display grants are a separate, later approval.
-- ---------------------------------------------------------------------------
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_usage_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_performance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_review_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.media_assets FROM PUBLIC;
REVOKE ALL ON TABLE public.media_assets FROM anon;
REVOKE ALL ON TABLE public.media_assets FROM authenticated;
REVOKE ALL ON TABLE public.media_rights FROM PUBLIC;
REVOKE ALL ON TABLE public.media_rights FROM anon;
REVOKE ALL ON TABLE public.media_rights FROM authenticated;
REVOKE ALL ON TABLE public.media_localizations FROM PUBLIC;
REVOKE ALL ON TABLE public.media_localizations FROM anon;
REVOKE ALL ON TABLE public.media_localizations FROM authenticated;
REVOKE ALL ON TABLE public.product_videos FROM PUBLIC;
REVOKE ALL ON TABLE public.product_videos FROM anon;
REVOKE ALL ON TABLE public.product_videos FROM authenticated;
REVOKE ALL ON TABLE public.routine_videos FROM PUBLIC;
REVOKE ALL ON TABLE public.routine_videos FROM anon;
REVOKE ALL ON TABLE public.routine_videos FROM authenticated;
REVOKE ALL ON TABLE public.creator_assets FROM PUBLIC;
REVOKE ALL ON TABLE public.creator_assets FROM anon;
REVOKE ALL ON TABLE public.creator_assets FROM authenticated;
REVOKE ALL ON TABLE public.video_usage_steps FROM PUBLIC;
REVOKE ALL ON TABLE public.video_usage_steps FROM anon;
REVOKE ALL ON TABLE public.video_usage_steps FROM authenticated;
REVOKE ALL ON TABLE public.video_performance_events FROM PUBLIC;
REVOKE ALL ON TABLE public.video_performance_events FROM anon;
REVOKE ALL ON TABLE public.video_performance_events FROM authenticated;
REVOKE ALL ON TABLE public.media_review_events FROM PUBLIC;
REVOKE ALL ON TABLE public.media_review_events FROM anon;
REVOKE ALL ON TABLE public.media_review_events FROM authenticated;

REVOKE ALL ON public.media_assets_publishable FROM PUBLIC;
REVOKE ALL ON public.media_assets_publishable FROM anon;
REVOKE ALL ON public.media_assets_publishable FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.media_assets TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.media_rights TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.media_localizations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.product_videos TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.routine_videos TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.creator_assets TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.video_usage_steps TO service_role;
GRANT SELECT, INSERT ON TABLE public.video_performance_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.media_review_events TO service_role;
GRANT SELECT ON public.media_assets_publishable TO service_role;

SELECT 'create_media_asset_library_v1' AS notice;
