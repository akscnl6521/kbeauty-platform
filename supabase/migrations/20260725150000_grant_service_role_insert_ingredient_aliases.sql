-- Staging only: allow service_role to INSERT ingredient_aliases rows
-- so the ingredient dictionary expansion pipeline can attach alias
-- spellings (Korean/English INCI variants) to existing/new ingredient
-- rows without going through a separate admin API.
--
-- Idempotent: re-running GRANT is safe in Postgres.
-- Does NOT grant UPDATE/DELETE/TRUNCATE, and does not touch RLS,
-- anon/authenticated roles, or Storage.

GRANT INSERT ON TABLE public.ingredient_aliases TO service_role;
