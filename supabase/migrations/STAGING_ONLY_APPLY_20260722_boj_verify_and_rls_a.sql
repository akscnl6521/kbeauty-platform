-- =============================================================================
-- STAGING ONLY — project ref must be jfnjufmldiqlgvgyugfd
-- Production (rhfr***mns) 이면 즉시 중단.
-- B 예외안 포함하지 않음. ROUND LAB / 타 offer 변경 없음.
-- =============================================================================
-- Part 1) BOJ offer 1건만 verification_status: unverified → verified
--   - stock_status / price / url / seller / active 불변
-- Part 2) A 엄격 RLS 적용
-- Part 3) 확인 SELECT
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) BOJ verify (exactly 1 row expected)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.product_offers
  SET verification_status = 'verified'
  WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01'
    AND product_id = 25
    AND verification_status = 'unverified'
    AND stock_status = 'out_of_stock'
    AND is_official = true
    AND retailer_country = 'KR'
    AND price = 18000
    AND currency = 'KRW'
    AND active = true
    AND purchase_url LIKE 'https://beautyofjoseon.co.kr/%'
    AND purchase_url LIKE '%/31%';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'BOJ verify expected 1 row, got % — rolling back', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) A strict RLS (verified official KR OOS/unknown; NO unverified public)
-- ---------------------------------------------------------------------------
ALTER POLICY "Allow anon read all product_offers"
  ON public.product_offers
  TO anon, authenticated
  USING (
    active = true
    AND (
      (
        verification_status = 'verified'
        AND stock_status = 'in_stock'
      )
      OR (
        is_official = true
        AND verification_status = 'verified'
        AND retailer_country = 'KR'
        AND stock_status IN ('out_of_stock', 'unknown')
        AND price IS NOT NULL
        AND price > 0
        AND currency = 'KRW'
        AND purchase_url LIKE 'https://%'
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.product_offers FROM anon, authenticated;
GRANT SELECT ON public.product_offers TO anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- 3) Post-checks (run after commit; read-only)
-- ---------------------------------------------------------------------------
-- Expect: verification_status=verified, stock_status=out_of_stock, price=18000
SELECT id, product_id, retailer_name, verification_status, stock_status, price, currency, active
FROM public.product_offers
WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01';

-- Expect: ROUND LAB still unverified (not publicly exposed by A)
SELECT id, verification_status, stock_status
FROM public.product_offers
WHERE id = '2fcb8bde-d3f6-482f-8eca-f0908378bff3';

-- Expect: anon/authenticated have SELECT only
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'product_offers'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
