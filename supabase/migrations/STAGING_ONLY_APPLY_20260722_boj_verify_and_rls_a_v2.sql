-- =============================================================================
-- STAGING ONLY — revised apply (DO NOT RUN until approved)
-- project ref: jfnjufmldiqlgvgyugfd only
-- Fixes P0001 risk: avoid LIKE; pin exact id+url; disable RLS for this txn
--   so UPDATE can see unverified OOS row (anon policy still verified+in_stock).
-- B exception NOT applied. ROUND LAB / other offers NOT updated.
-- =============================================================================

BEGIN;

-- Ensure this session can see the target row for UPDATE.
-- (No-op if already bypassing RLS as table owner.)
SET LOCAL row_security = off;

DO $$
DECLARE
  n integer;
  v_before text;
  v_stock text;
  v_price numeric;
  v_active boolean;
  v_url text;
  v_seller text;
BEGIN
  SELECT verification_status, stock_status, price, active, purchase_url, retailer_name
    INTO v_before, v_stock, v_price, v_active, v_url, v_seller
  FROM public.product_offers
  WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOJ offer id not found';
  END IF;

  IF v_before IS DISTINCT FROM 'unverified'
     OR v_stock IS DISTINCT FROM 'out_of_stock'
     OR v_price IS DISTINCT FROM 18000
     OR v_active IS DISTINCT FROM TRUE
     OR v_url IS DISTINCT FROM 'https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/'
  THEN
    RAISE EXCEPTION
      'BOJ offer preconditions failed: status=%, stock=%, price=%, active=%, url=%',
      v_before, v_stock, v_price, v_active, v_url;
  END IF;

  UPDATE public.product_offers
  SET verification_status = 'verified'
  WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01'
    AND product_id = 25
    AND verification_status = 'unverified'
    AND stock_status = 'out_of_stock'
    AND is_official IS TRUE
    AND retailer_country = 'KR'
    AND price = 18000
    AND currency = 'KRW'
    AND active IS TRUE
    AND purchase_url = 'https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/'
    AND retailer_name = '조선미녀 공식몰';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'BOJ verify expected 1 row, got %', n;
  END IF;
END $$;

-- A strict RLS only (no unverified public)
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
        is_official IS TRUE
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
