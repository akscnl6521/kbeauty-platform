-- =============================================================================
-- SELECT-ONLY diagnosis for P0001 (BOJ verify). DO NOT run DML/DDL here.
-- Staging ref must be jfnj***gfd. Production이면 중단.
-- =============================================================================

-- 0) who am I / RLS bypass?
SELECT current_user, session_user,
       current_setting('role', true) AS role_setting;

-- 1) product by slug
SELECT id AS product_id, slug, name, name_ko, brand
FROM public.products
WHERE slug = 'beauty-of-joseon-green-plum-refreshing-toner';

-- 2) all offers for that product_id
SELECT
  o.id,
  o.product_id,
  o.retailer_name,
  o.retailer_country,
  o.purchase_url,
  o.price,
  o.currency,
  o.stock_status,
  o.verification_status,
  o.is_official,
  o.active,
  o.verified_at,
  o.last_checked_at AS checked_at
FROM public.product_offers o
JOIN public.products p ON p.id = o.product_id
WHERE p.slug = 'beauty-of-joseon-green-plum-refreshing-toner'
ORDER BY o.id;

-- 3) expected offer id row (may be same)
SELECT
  id, product_id, retailer_name, retailer_country, purchase_url,
  price, currency, stock_status, verification_status, is_official,
  active, verified_at, last_checked_at AS checked_at
FROM public.product_offers
WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01';

-- 4) Predicate-by-predicate counts (failed SQL WHERE)
WITH target AS (
  SELECT *
  FROM public.product_offers
  WHERE id = '13fe02a6-5519-41b7-afba-8505cad70c01'
)
SELECT 'id exists' AS step, COUNT(*)::int AS n FROM target
UNION ALL
SELECT 'product_id=25', COUNT(*)::int FROM target WHERE product_id = 25
UNION ALL
SELECT 'verification_status=unverified', COUNT(*)::int FROM target WHERE verification_status = 'unverified'
UNION ALL
SELECT 'stock_status=out_of_stock', COUNT(*)::int FROM target WHERE stock_status = 'out_of_stock'
UNION ALL
SELECT 'is_official=true', COUNT(*)::int FROM target WHERE is_official IS TRUE
UNION ALL
SELECT 'retailer_country=KR', COUNT(*)::int FROM target WHERE retailer_country = 'KR'
UNION ALL
SELECT 'price=18000', COUNT(*)::int FROM target WHERE price = 18000
UNION ALL
SELECT 'currency=KRW', COUNT(*)::int FROM target WHERE currency = 'KRW'
UNION ALL
SELECT 'active=true', COUNT(*)::int FROM target WHERE active IS TRUE
UNION ALL
SELECT 'url LIKE host%', COUNT(*)::int FROM target
 WHERE purchase_url LIKE 'https://beautyofjoseon.co.kr/%'
UNION ALL
SELECT 'url LIKE %/31%', COUNT(*)::int FROM target
 WHERE purchase_url LIKE '%/31%'
UNION ALL
SELECT 'FULL failed WHERE (same as old SQL)', COUNT(*)::int FROM target
 WHERE product_id = 25
   AND verification_status = 'unverified'
   AND stock_status = 'out_of_stock'
   AND is_official = true
   AND retailer_country = 'KR'
   AND price = 18000
   AND currency = 'KRW'
   AND active = true
   AND purchase_url LIKE 'https://beautyofjoseon.co.kr/%'
   AND purchase_url LIKE '%/31%';

-- 5) RLS policy still old? (expect verified+in_stock only after rollback)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.product_offers'::regclass
  AND polname = 'Allow anon read all product_offers';

-- 6) ROUND LAB untouched?
SELECT id, product_id, retailer_name, verification_status, stock_status, price, is_official, active
FROM public.product_offers
WHERE id = '2fcb8bde-d3f6-482f-8eca-f0908378bff3';

-- 7) If FULL WHERE count = 1 here but UPDATE was 0 earlier:
--    UPDATE likely ran under a role subject to RLS (unverified+OOS invisible).
SELECT c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'product_offers';
