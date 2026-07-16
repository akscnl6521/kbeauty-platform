-- Staging only: allow service_role to read ingredient_aliases
-- for createAdminProduct dictionary matching (SELECT only).
--
-- Idempotent: re-running GRANT SELECT is safe in Postgres.
-- Does NOT grant INSERT/UPDATE/DELETE/TRUNCATE.
-- Does NOT modify anon/authenticated, RLS policies, or Storage.

GRANT SELECT ON TABLE public.ingredient_aliases TO service_role;
