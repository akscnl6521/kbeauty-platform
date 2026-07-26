-- Staging only: allow service_role to UPDATE public.product_offers rows.
-- Needed so discoverAndPersistOffers can refresh price/stock/verification
-- status on an already-existing offer row (idempotent re-collection).
-- INSERT already works (confirmed this session); UPDATE is the only gap.
-- Does not grant DELETE (matches existing project-wide restraint).
--
-- Idempotent: re-running GRANT is safe in Postgres.

GRANT UPDATE ON TABLE public.product_offers TO service_role;
