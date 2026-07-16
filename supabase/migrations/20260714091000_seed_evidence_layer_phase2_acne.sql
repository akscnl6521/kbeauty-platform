-- Staging ONLY: Evidence Layer phase-2 concern/entry additions (acne).
-- Idempotent. Production forbidden via CLI linked-ref guard.

BEGIN;

INSERT INTO public.skin_concerns (code, name_ko, name_en, category, active, review_status)
VALUES ('acne', '여드름', 'Acne', 'cosmetic', true, 'approved')
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  active = true,
  review_status = 'approved';

INSERT INTO public.ingredients (slug, name_en, name_ko)
SELECT 'niacinamide', 'Niacinamide', '나이아신아마이드'
WHERE NOT EXISTS (SELECT 1 FROM public.ingredients WHERE slug = 'niacinamide');

INSERT INTO public.ingredient_evidence (
  ingredient_id, concern_id, evidence_type, study_design, population, concentration,
  formulation, study_duration, outcome_summary, evidence_level, pmid, doi, journal,
  publication_year, conflict_of_interest, source_url, reviewed_by, reviewed_at, review_status
)
SELECT
  i.id, c.id, 'cosmetic_study',
  'topical niacinamide facial appearance / sebum-related clinical reports',
  'human facial skin', 'typically 2–5% in cosmetic studies', 'topical leave-on', 'weeks',
  '국소 나이아신아마이드는 피부 외관·피지 관련 지표와 연관된 인체적용 보고가 있음. 여드름 치료 단정이 아님.',
  'controlled_clinical_study', '17147561', NULL,
  'British Journal of Dermatology / related clinical reports', 2005, 'disclosed',
  'https://pubmed.ncbi.nlm.nih.gov/17147561/',
  'staging-evidence-phase2', now(), 'approved'
FROM public.skin_concerns c
JOIN public.ingredients i ON i.slug = 'niacinamide'
WHERE c.code = 'acne'
  AND NOT EXISTS (
    SELECT 1 FROM public.ingredient_evidence e WHERE e.pmid = '17147561'
  );

COMMIT;
