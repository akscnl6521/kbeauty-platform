-- STAGING ONLY rollback — restore pre-A state for this change set.
-- 1) BOJ verification_status back to unverified
-- 2) RLS back to verified + in_stock only
-- Does NOT touch ROUND LAB / other offers beyond policy restore.

BEGIN;

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
    AND is_official = true
    AND retailer_country = 'KR';

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
