-- Production 에 `catalog_product_media` 를 만든다 — 제품 이미지를 담을 곳.
--
-- ## 왜 필요한가
--
-- 2026-08-04 실측: 추천 화면에 제품 이미지가 **한 번도 뜬 적이 없다.**
-- 부품은 다 있었다 — `resolveVerifiedProductImageUrls()` · `/api/catalog/product-images`
-- 라우트 · 카드의 렌더 코드. 그런데 **이 테이블이 Production 에 없고**, 라우트를
-- 부르는 곳도 없었다. 배선은 코드에서 고쳤고, 남은 것이 이 테이블이다.
--
-- ## 원본 마이그레이션과 다른 점
--
-- `20260714040000_beauty_taxonomy_media_variants.sql` 의 정의를 따르되,
-- `catalog_staging_products` · `catalog_sources` 로 가는 **외래키를 뺐다.**
-- 그 두 테이블은 Staging 자동화용이라 Production 에 없을 수 있고, 이 컬럼들은
-- 원래도 nullable 이라 이미지 저장·조회에 쓰이지 않는다. 없는 테이블을 참조하면
-- 마이그레이션 자체가 실패한다.
--
-- 컬럼 이름·CHECK 값은 원본과 **똑같이** 둔다 — `createAdminProduct` 와
-- `collect-product-images` 가 그 값을 그대로 쓴다.
--
-- 되돌리기: DROP TABLE public.catalog_product_media;

CREATE TABLE IF NOT EXISTS public.catalog_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id uuid,
  product_id bigint,
  source_id uuid,
  media_type text NOT NULL CHECK (media_type IN (
    'product_front', 'product_back', 'packaging', 'texture', 'swatch',
    'shade_swatch', 'application', 'ingredient_label', 'size_reference', 'other'
  )),
  variant_key text,
  shade_name text,
  image_url text NOT NULL,
  canonical_image_url text,
  thumbnail_url text,
  source_page_url text NOT NULL,
  source_domain text NOT NULL,
  source_type text NOT NULL,
  source_tier integer NOT NULL DEFAULT 3 CHECK (source_tier BETWEEN 1 AND 4),
  is_official_source boolean NOT NULL DEFAULT false,
  usage_rights_status text NOT NULL DEFAULT 'unknown'
    CHECK (usage_rights_status IN (
      'official_remote_use', 'licensed_copy_allowed', 'external_link_only', 'unknown', 'prohibited'
    )),
  rights_notes text,
  width integer,
  height integer,
  mime_type text,
  content_length bigint,
  content_hash text,
  perceptual_hash text,
  http_status integer,
  is_accessible boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  validation_status text NOT NULL DEFAULT 'discovered'
    CHECK (validation_status IN (
      'discovered', 'verified', 'broken', 'mismatched', 'needs_review', 'prohibited'
    )),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 제품별 조회가 주 경로다 (`resolveVerifiedProductImageUrls` 가 id 묶음으로 조회한다).
CREATE INDEX IF NOT EXISTS catalog_product_media_product_idx
  ON public.catalog_product_media (product_id);
CREATE INDEX IF NOT EXISTS catalog_product_media_validation_idx
  ON public.catalog_product_media (validation_status);

-- 제품당 대표 이미지는 하나다. 중복 적재를 DB 가 막는다 —
-- 스크립트의 «이미 있으면 건너뛴다» 는 동시 실행에서 새는 구멍이 있다.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_product_media_primary_uidx
  ON public.catalog_product_media (product_id)
  WHERE is_primary AND product_id IS NOT NULL;

-- 이미지는 공개 화면에 쓰이지만 **읽기는 service role 경로**(`resolveVerifiedProductImageUrls`)
-- 로만 한다. anon 에 직접 열지 않는다 — 서명 URL 재발급을 서버가 통제해야 한다.
ALTER TABLE public.catalog_product_media ENABLE ROW LEVEL SECURITY;
