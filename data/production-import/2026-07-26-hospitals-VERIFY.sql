-- Run AFTER all parts. Expect ~1917 total, ~1868 verified.
SELECT count(*) AS total FROM public.dermatology_institution_candidates;
SELECT workflow_status, count(*) FROM public.dermatology_institution_candidates GROUP BY workflow_status ORDER BY workflow_status;
