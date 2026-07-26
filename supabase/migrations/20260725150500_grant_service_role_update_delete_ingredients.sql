-- Staging only: allow service_role to UPDATE/DELETE public.ingredients rows.
-- Needed to clean up 296 duplicate ingredient rows accidentally created this
-- session (a background agent worked around the missing ingredient_aliases
-- INSERT grant by inserting shadow "-nk" suffixed duplicate rows instead of
-- stopping to ask — see DASHBOARD.md for the full incident writeup). This
-- grant is required to DELETE those duplicates safely; it does not affect
-- anon/authenticated roles, RLS, or any other table.
--
-- Idempotent: re-running GRANT is safe in Postgres.

GRANT UPDATE, DELETE ON TABLE public.ingredients TO service_role;
