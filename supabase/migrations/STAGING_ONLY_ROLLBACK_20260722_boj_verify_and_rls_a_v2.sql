-- STAGING ONLY rollback for v2 apply (DO NOT RUN unless rolling back)

BEGIN;
SET LOCAL row_security = off;

DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.product_offers
  SET verification_status = 'unverified'
  WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01'
    AND product_id = 25
    AND verification_status = 'verified'
    AND stock_status = 'out_of_stock'
    AND price = 18000
    AND is_official IS TRUE
    AND retailer_country = 'KR'
    AND purchase_url = 'https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'BOJ rollback expected 1 row, got %', n;
  END IF;
END $$;

ALTER POLICY "Allow anon read all product_offers"
  ON public.product_offers
  TO anon, authenticated
  USING (
    active = true
    AND verification_status = 'verified'
    AND stock_status = 'in_stock'
  );

REVOKE INSERT, UPDATE, DELETE ON public.product_offers FROM anon, authenticated;
GRANT SELECT ON public.product_offers TO anon, authenticated;

COMMIT;
