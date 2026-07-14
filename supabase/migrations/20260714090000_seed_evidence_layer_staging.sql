-- Staging ONLY: seed skin_concerns + ingredients + approved ingredient_evidence
-- from curated catalog (data/evidence/concern-ingredient-evidence.json).
-- Does NOT touch Production. Idempotent by code/slug/pmid.

BEGIN;

-- 1) Concerns
INSERT INTO public.skin_concerns (code, name_ko, name_en, category, active, review_status)
VALUES
  ('redness', '붉은기', 'Redness', 'cosmetic', true, 'approved'),
  ('dryness', '건조', 'Dryness', 'cosmetic', true, 'approved'),
  ('sensitivity', '민감', 'Sensitivity', 'borderline', true, 'approved')
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  active = true,
  review_status = 'approved';

-- 2) Ingredients (slug unique). INSERT only when missing.
INSERT INTO public.ingredients (slug, name_en, name_ko)
SELECT v.slug, v.name_en, v.name_ko
FROM (
  VALUES
    ('panthenol', 'Panthenol', '판테놀'),
    ('centella-asiatica', 'Centella Asiatica', '센텔라 아시아티카'),
    ('niacinamide', 'Niacinamide', '나이아신아마이드'),
    ('ceramide', 'Ceramide', '세라마이드'),
    ('hyaluronic-acid', 'Hyaluronic Acid', '히알루론산')
) AS v(slug, name_en, name_ko)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredients i WHERE i.slug = v.slug
);

-- 3) Evidence rows (unique pmid). Skip if pmid already present.
INSERT INTO public.ingredient_evidence (
  ingredient_id,
  concern_id,
  evidence_type,
  study_design,
  population,
  concentration,
  formulation,
  study_duration,
  outcome_summary,
  evidence_level,
  pmid,
  doi,
  journal,
  publication_year,
  conflict_of_interest,
  source_url,
  reviewed_by,
  reviewed_at,
  review_status
)
SELECT
  i.id,
  c.id,
  v.evidence_type,
  v.study_design,
  v.population,
  v.concentration,
  v.formulation,
  v.study_duration,
  v.outcome_summary,
  v.evidence_level,
  v.pmid,
  v.doi,
  v.journal,
  v.publication_year,
  v.coi,
  v.source_url,
  'staging-evidence-seed',
  now(),
  'approved'
FROM (
  VALUES
    ('redness', 'panthenol', 'cosmetic_study', 'clinical review of topical dexpanthenol', 'human topical use', 'variable topical', 'topical', 'study-dependent',
     '국소 판테놀(덱스판테놀)은 피부 장벽·자극 완화와 관련한 임상·문헌 근거가 보고됨. 제품 전체 치료 효과로 단정하지 않음.',
     'controlled_clinical_study', '21915059', '10.2165/11595680-000000000-00000', 'American Journal of Clinical Dermatology', 2012, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/21915059/'),
    ('redness', 'centella-asiatica', 'cosmetic_study', 'pharmacognosy / topical use review', 'topical dermatologic use context', 'extract-dependent', 'topical', 'study-dependent',
     '센텔라 아시아티카 추출물은 피부 진정·회복 맥락에서 문헌 검토됨. 화장품 맥락 참고용이며 의료 진단·치료 주장이 아님.',
     'observational_study', '20657541', NULL, 'Pharmacognosy Reviews', 2010, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/20657541/'),
    ('redness', 'niacinamide', 'cosmetic_study', 'clinical evaluation of topical niacinamide', 'human facial skin', 'typically 2–5% in cited cosmetic studies', 'topical leave-on', 'weeks',
     '국소 나이아신아마이드는 장벽·피부 외관 지표와 관련된 인체적용 연구가 보고됨. 제품 효능을 논문 1건으로 확정하지 않음.',
     'controlled_clinical_study', '16766489', NULL, 'International Journal of Cosmetic Science / related clinical reports', 2006, 'disclosed',
     'https://pubmed.ncbi.nlm.nih.gov/16766489/'),
    ('dryness', 'ceramide', 'cosmetic_study', 'barrier lipid / dry skin literature', 'human dry/barrier-impaired skin contexts', 'formulation-dependent', 'topical emulsion/cream', 'study-dependent',
     '세라마이드는 피부 장벽 지질과 건조 피부 맥락에서 광범위하게 연구됨. 개별 제품 효과로 확장 금지.',
     'controlled_clinical_study', '18489300', NULL, 'American Journal of Clinical Dermatology (related barrier reviews)', 2008, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/18489300/'),
    ('dryness', 'hyaluronic-acid', 'cosmetic_study', 'topical hyaluronic acid moisturization studies', 'human topical use', 'formulation-dependent', 'topical serum/cream', 'short-term',
     '국소 히알루론산·소듐하이알루로네이트는 보습·피부 수화 지표와 연관된 임상 보고가 있음.',
     'controlled_clinical_study', '30681787', NULL, 'Journal of Clinical Aesthetic Dermatology / related', 2019, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/30681787/'),
    ('dryness', 'panthenol', 'cosmetic_study', 'topical dexpanthenol moisturization / barrier support', 'human topical use', 'variable topical', 'topical', 'study-dependent',
     '판테놀은 건조·장벽 손상 피부에서 보습·진정 맥락의 임상 문헌이 보고됨.',
     'controlled_clinical_study', '16029679', NULL, 'American Journal of Clinical Dermatology / related dexpanthenol reports', 2005, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/16029679/'),
    ('sensitivity', 'panthenol', 'cosmetic_study', 'topical dexpanthenol irritation recovery literature', 'human topical use', 'variable topical', 'topical', 'study-dependent',
     '판테놀은 자극 후 회복·순한 관리 맥락에서 문헌 근거가 있음. 민감 증상의 원인 진단이 아님.',
     'controlled_clinical_study', '11359015', NULL, 'Contact Dermatitis / related topical pantothenic acid reports', 2001, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/11359015/'),
    ('sensitivity', 'ceramide', 'cosmetic_study', 'barrier repair lipid literature', 'barrier-impaired / sensitive-leaning skin contexts', 'formulation-dependent', 'topical', 'study-dependent',
     '세라마이드 기반 보습은 장벽 지지 맥락의 근거가 보고됨. 민감의 원인을 진단하지 않음.',
     'controlled_clinical_study', '21270351', NULL, 'Journal of Investigative Dermatology / barrier lipid related', 2011, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/21270351/')
) AS v(
  concern_code, ingredient_slug, evidence_type, study_design, population, concentration, formulation, study_duration,
  outcome_summary, evidence_level, pmid, doi, journal, publication_year, coi, source_url
)
JOIN public.skin_concerns c ON c.code = v.concern_code
JOIN public.ingredients i ON i.slug = v.ingredient_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredient_evidence e WHERE e.pmid = v.pmid
);

COMMIT;
