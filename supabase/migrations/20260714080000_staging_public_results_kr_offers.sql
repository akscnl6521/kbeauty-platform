-- Staging ONLY. Abort if applied to Production.
-- Allowed scope:
--   1) deactivate HTTP API / alias / 검증용 test products
--   2) repair name_ko only when Hangul syllables are missing (mojibake)
--   3) ensure minimum KR verified+in_stock offers for display (insert-if-missing;
--      do not rewrite existing verified offers' URLs/prices for products 4/6/10)
-- Does NOT: touch active/verified/ingredients/name/EN for healthy rows 4/6/10.

DO $$
BEGIN
  -- Guard: refuse Production project (Supabase host check via current_setting is unavailable;
  -- operator must only run when CLI --linked ref = jfnjufmldiqlgvgyugfd).
  NULL;
END $$;

BEGIN;

-- 1) Test / probe products only (narrow patterns — avoid bare '%probe%' on real catalog names)
UPDATE public.products
SET active = false,
    verified_at = NULL
WHERE active IS TRUE
  AND (
    name ILIKE '%HTTP API%'
    OR name ILIKE '%Alias Probe%'
    OR name ILIKE '%Alias SELECT%'
    OR coalesce(name_ko, '') ILIKE '%검증용%'
    OR coalesce(name_ko, '') ILIKE '%권한 검증%'
    OR coalesce(name_ko, '') ILIKE '%HTTP API%'
  );

-- 2) Repair name_ko only if row lacks Hangul syllables (깨진 경우만)
--    Products 4 / 6 / 10: skip UPDATE when name_ko already has Hangul (정상 데이터 보존)
UPDATE public.products p
SET name_ko = v.name_ko
FROM (
  VALUES
    (4::bigint, '약산성 굿모닝 젤 클렌저'::text),
    (5, 'AHA BHA 클라리파잉 트리트먼트 토너'),
    (6, '하이드리움 워터리 토너'),
    (7, '더 나이아신아마이드 15 세럼'),
    (8, '어드밴스드 더 비타민C 23 세럼'),
    (9, '더 6 펩타이드 스킨 부스터 세럼'),
    (10, '어드밴스드 스네일 92 올인원 크림'),
    (11, '더 레티놀 0.1 크림')
) AS v(id, name_ko)
WHERE p.id = v.id
  AND p.brand = 'COSRX'
  AND (
    p.name_ko IS NULL
    OR length(trim(p.name_ko)) = 0
    OR p.name_ko !~ '[\uAC00-\uD7A3]'  -- no Hangul syllable → treat as broken
  );

-- 3a) Existing KR offers that are still unverified/unknown → promote ONLY when product
--     is active+verified COSRX seed. Do NOT change purchase_url.
--     Skip rewrite of price when price already > 0.
UPDATE public.product_offers o
SET
  verification_status = 'verified',
  stock_status = 'in_stock',
  verified_at = coalesce(o.verified_at, now()),
  last_checked_at = now(),
  active = true,
  currency = coalesce(nullif(o.currency, ''), 'KRW'),
  price = CASE WHEN o.price IS NOT NULL AND o.price > 0 THEN o.price ELSE 23000 END,
  ships_to_countries = CASE
    WHEN o.ships_to_countries @> ARRAY['KR']::text[] THEN o.ships_to_countries
    ELSE ARRAY['KR']::text[]
  END,
  updated_at = now()
WHERE o.retailer_country = 'KR'
  AND o.product_id IN (4, 5, 6, 7, 8, 9, 10, 11)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = o.product_id
      AND p.active IS TRUE
      AND p.verified_at IS NOT NULL
      AND p.brand = 'COSRX'
  )
  AND (
    o.verification_status IS DISTINCT FROM 'verified'
    OR o.stock_status IS DISTINCT FROM 'in_stock'
    OR o.verified_at IS NULL
    OR o.active IS NOT TRUE
  );

-- 3b) Insert missing KR verified+in_stock offers only (no overwrite of existing verified rows)
INSERT INTO public.product_offers (
  product_id,
  retailer_name,
  retailer_country,
  ships_to_countries,
  purchase_url,
  price,
  currency,
  stock_status,
  verification_status,
  is_official,
  verified_at,
  last_checked_at,
  active,
  source
)
SELECT
  v.product_id,
  v.retailer_name,
  'KR',
  ARRAY['KR']::text[],
  v.purchase_url,
  v.price,
  'KRW',
  'in_stock',
  'verified',
  true,
  now(),
  now(),
  true,
  'preview-results-minimal-2026-07-14'
FROM (
  VALUES
    (4::bigint, 'COSRX Official', 'https://www.cosrx.com/products/low-ph-good-morning-gel-cleanser', 15000::numeric),
    (5, 'COSRX Official', 'https://www.cosrx.com/products/aha-bha-clarifying-treatment-toner', 18000),
    (6, 'COSRX Official', 'https://www.cosrx.com/products/hydrium-watery-toner', 22000),
    (7, 'COSRX Official', 'https://www.cosrx.com/products/the-niacinamide-15-serum', 23000),
    (8, 'COSRX Official', 'https://www.cosrx.com/products/cosrx-advanced-the-vitamin-c-23-serum', 35000),
    (9, 'COSRX Official', 'https://www.cosrx.com/products/the-6-peptide-skin-booster-serum', 28000),
    (10, 'COSRX Official', 'https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202', 23000),
    (11, 'COSRX Official', 'https://www.cosrx.com/products/the-retinol-0-1-cream', 28000)
) AS v(product_id, retailer_name, purchase_url, price)
WHERE EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = v.product_id
    AND p.active IS TRUE
    AND p.verified_at IS NOT NULL
    AND p.brand = 'COSRX'
)
AND NOT EXISTS (
  SELECT 1 FROM public.product_offers o
  WHERE o.product_id = v.product_id
    AND o.retailer_country = 'KR'
    AND o.verification_status = 'verified'
    AND o.stock_status = 'in_stock'
    AND o.active IS TRUE
);

COMMIT;
