-- Bootstrap core tables for empty Staging databases.
-- Production already has these tables outside the migrations folder history.
-- Staging-only prerequisite: must run BEFORE 20250316+ incremental migrations.
-- Safe: CREATE IF NOT EXISTS only. No DROP / DELETE / TRUNCATE. No Production apply required
-- (Production already has these objects; IF NOT EXISTS is a no-op there).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- products (remote Production: bigint IDENTITY ALWAYS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL,
  category text,
  skin_concern text[],
  skin_tone text[],
  key_ingredients text[],
  price_usd numeric,
  recommendation_reason text,
  where_to_find_us text,
  where_to_find_jp text,
  slug text,
  created_at timestamp without time zone DEFAULT now(),
  name_ko text,
  recommendation_reason_ko text,
  recommendation_reason_ja text,
  name_ja text,
  key_ingredients_ja text[],
  link_sephora text,
  link_amazon_us text,
  link_amazon_jp text,
  link_qoo10 text,
  link_oliveyoung text,
  link_coupang text,
  link_yesstyle text,
  full_ingredients text[],
  usage_area text,
  texture text,
  fragrance_free boolean,
  alcohol_free boolean,
  verified_at timestamptz,
  data_confidence text,
  active boolean DEFAULT true
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ingredients (remote Production: bigint IDENTITY ALWAYS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredients (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL,
  name_en text NOT NULL,
  name_ko text,
  name_ja text,
  effects text[],
  mechanism text,
  caution text DEFAULT '본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.',
  paper_1_title text,
  paper_1_year text,
  paper_1_journal text,
  paper_1_url text,
  paper_2_title text,
  paper_2_year text,
  paper_2_journal text,
  paper_2_url text,
  created_at timestamp without time zone DEFAULT now(),
  mechanism_ko text,
  mechanism_ja text,
  caution_ko text,
  caution_ja text,
  effects_ko text[],
  effects_ja text[]
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_slug_key'
  ) THEN
    ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles (auth.users FK — available on hosted Supabase)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  invite_code text,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  phone text,
  district text,
  address text
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- invite_codes
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.invite_codes_id_seq;

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id integer PRIMARY KEY DEFAULT nextval('public.invite_codes_id_seq'::regclass),
  code text NOT NULL,
  used_by uuid,
  used_at timestamptz,
  max_uses integer DEFAULT 1,
  use_count integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invite_codes_code_key'
  ) THEN
    ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_code_key UNIQUE (code);
  END IF;
END $$;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
