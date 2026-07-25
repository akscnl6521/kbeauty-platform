-- Staging only: allow service_role to UPDATE public.products rows.
-- Needed for verifyAndActivateProduct to flip active=true/verified_at/
-- data_confidence once a draft product genuinely passes the quality gate
-- (real ingredients matched + real verified offer + honest confidence).
-- This is the first time this session actually reached this UPDATE call
-- (earlier attempts never passed the gate to get this far) — confirms
-- service_role never had UPDATE on products either, only INSERT.
-- Does not grant DELETE (matches existing project-wide restraint).
--
-- Idempotent: re-running GRANT is safe in Postgres.

GRANT UPDATE ON TABLE public.products TO service_role;
