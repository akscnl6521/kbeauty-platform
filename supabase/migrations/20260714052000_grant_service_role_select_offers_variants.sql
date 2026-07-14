-- Staging only: service_role SELECT for admin product detail reads.
-- getAdminProductDetail loads product_offers and product_variants (SELECT only).
-- Empty result sets are valid (no offers/variants yet).
--
-- Idempotent GRANT SELECT. Does NOT grant INSERT/UPDATE/DELETE/TRUNCATE.
-- Does NOT modify anon/authenticated, RLS policies, or Storage.

GRANT SELECT ON TABLE public.product_offers TO service_role;
GRANT SELECT ON TABLE public.product_variants TO service_role;
