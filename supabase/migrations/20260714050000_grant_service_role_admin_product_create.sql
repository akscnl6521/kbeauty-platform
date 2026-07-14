-- Staging: grant minimum table privileges for admin product registration
-- (createAdminProduct / POST /api/admin/products) using service_role.
--
-- Scope:
--   - service_role only
--   - SELECT + INSERT (no UPDATE/DELETE)
--   - tables: products, ingredients, product_ingredients, catalog_product_media
--   - sequences: IDENTITY for products.id, ingredients.id
--
-- Does NOT change:
--   - anon / authenticated grants
--   - Storage bucket/object policies
--   - DELETE privileges
--
-- Apply only when linked to Staging. Do not apply to Production intentionally.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT ON TABLE public.products TO service_role;
GRANT SELECT, INSERT ON TABLE public.ingredients TO service_role;
GRANT SELECT, INSERT ON TABLE public.product_ingredients TO service_role;
GRANT SELECT, INSERT ON TABLE public.catalog_product_media TO service_role;

-- IDENTITY sequences used by products.id / ingredients.id inserts
DO $$
BEGIN
  IF to_regclass('public.products_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.products_id_seq TO service_role';
  END IF;
  IF to_regclass('public.ingredients_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.ingredients_id_seq TO service_role';
  END IF;
END $$;
