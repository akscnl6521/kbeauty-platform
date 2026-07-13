-- ROLLBACK for create_autonomous_pipeline_persistence
-- DO NOT AUTO-RUN. Requires explicit human approval.
-- Drops only pipeline persistence objects created by that migration.
-- Does NOT touch products, ingredients, offers, discovery, admin_users.

DROP FUNCTION IF EXISTS public.claim_pipeline_jobs(uuid, text, integer, integer);

DROP TABLE IF EXISTS public.product_change_candidates;
DROP TABLE IF EXISTS public.product_skin_match_scores;
DROP TABLE IF EXISTS public.product_quality_scores;
DROP TABLE IF EXISTS public.product_field_provenance;
DROP TABLE IF EXISTS public.brand_official_site_state;
DROP TABLE IF EXISTS public.pipeline_jobs;
DROP TABLE IF EXISTS public.pipeline_batches;

-- set_updated_at_timestamp may be shared; only drop if unused.
-- DROP FUNCTION IF EXISTS public.set_updated_at_timestamp();
