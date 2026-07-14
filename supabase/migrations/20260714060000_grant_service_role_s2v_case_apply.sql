-- Staging only: minimum service_role grants for Search-to-Verified case apply.
-- Idempotent GRANTs. No anon/authenticated changes. No RLS policy changes.
-- No DELETE/TRUNCATE. No products UPDATE (product body must stay immutable here).

GRANT SELECT, INSERT, UPDATE ON TABLE public.data_sources TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.product_discovery_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.verification_queue TO service_role;
GRANT SELECT, INSERT ON TABLE public.product_change_history TO service_role;
GRANT SELECT, INSERT ON TABLE public.product_field_provenance TO service_role;
GRANT SELECT, INSERT ON TABLE public.product_offers TO service_role;

-- Sequences used by bigserial provenance
GRANT USAGE, SELECT ON SEQUENCE public.product_field_provenance_id_seq TO service_role;
