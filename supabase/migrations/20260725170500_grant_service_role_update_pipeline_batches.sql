-- Staging only: allow service_role to UPDATE public.pipeline_batches rows.
-- SELECT+INSERT were granted earlier this session; the worker also needs
-- UPDATE to persist batch progress/status as it ticks. Confirmed via a
-- real run of scripts/run-pipeline-worker.mjs failing with
-- "pipeline batch update failed" only after the earlier grant let batch
-- creation succeed for the first time.
--
-- Idempotent: re-running GRANT is safe in Postgres.

GRANT UPDATE ON TABLE public.pipeline_batches TO service_role;
