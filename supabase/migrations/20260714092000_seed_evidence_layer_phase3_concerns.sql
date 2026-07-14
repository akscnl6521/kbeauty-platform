-- Staging ONLY: Evidence Layer phase-3 — pigmentation / antiaging / pores / uv
-- + acne reinforcement (salicylic-acid). Does NOT re-seed existing acne PMID 17147561.
-- Idempotent by concern code / ingredient slug / pmid.

BEGIN;

INSERT INTO public.skin_concerns (code, name_ko, name_en, category, active, review_status)
VALUES
  ('pigmentation', '색소침착', 'Pigmentation', 'cosmetic', true, 'approved'),
  ('antiaging', '주름', 'Wrinkles / Anti-aging', 'cosmetic', true, 'approved'),
  ('pores', '모공', 'Pores', 'cosmetic', true, 'approved'),
  ('uv', '자외선', 'UV / Photoprotection', 'cosmetic', true, 'approved')
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  active = true,
  review_status = 'approved';

INSERT INTO public.ingredients (slug, name_en, name_ko)
SELECT v.slug, v.name_en, v.name_ko
FROM (
  VALUES
    ('salicylic-acid', 'Salicylic Acid', '살리실산'),
    ('ascorbic-acid', 'Ascorbic Acid', '아스코르빈산'),
    ('retinol', 'Retinol', '레티놀'),
    ('adenosine', 'Adenosine', '아데노신'),
    ('zinc-oxide', 'Zinc Oxide', '징크옥사이드'),
    ('niacinamide', 'Niacinamide', '나이아신아마이드')
) AS v(slug, name_en, name_ko)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredients i WHERE i.slug = v.slug
);

INSERT INTO public.ingredient_evidence (
  ingredient_id, concern_id, evidence_type, study_design, population, concentration,
  formulation, study_duration, outcome_summary, evidence_level, pmid, doi, journal,
  publication_year, conflict_of_interest, source_url, reviewed_by, reviewed_at, review_status
)
SELECT
  i.id, c.id, v.evidence_type, v.study_design, v.population, v.concentration,
  v.formulation, v.study_duration, v.outcome_summary, v.evidence_level, v.pmid, v.doi,
  v.journal, v.publication_year, v.coi, v.source_url,
  'staging-evidence-phase3', now(), 'approved'
FROM (
  VALUES
    ('acne', 'salicylic-acid', 'cosmetic_study',
     'randomized clinical comparison of salicylic acid–based dermocosmetic vs BPO in mild–moderate acne',
     'adults with mild to moderate acne vulgaris',
     'salicylic acid–containing dermocosmetic (study formulation)', 'topical cream', '56 days',
     '살리실산 기반 더모코스메틱은 경·중등도 여드름에서 BPO와 비교한 임상 개선이 보고됨. 개별 완치·처방 대체가 아님.',
     'controlled_clinical_study', '37941097', NULL,
     'Journal of the European Academy of Dermatology and Venereology / related', 2023, 'disclosed',
     'https://pubmed.ncbi.nlm.nih.gov/37941097/'),
    ('pigmentation', 'niacinamide', 'cosmetic_study',
     'clinical evaluation of topical niacinamide on facial hyperpigmentation',
     'human facial hyperpigmentation / tanning contexts', '2–5% topical in cited trials',
     'topical leave-on moisturizer', 'weeks',
     '국소 나이아신아마이드는 멜라노솜 전달 억제·색소 외관 완화와 연관된 인체적용 근거가 보고됨. 기미 진단·치료 단정이 아님.',
     'controlled_clinical_study', '12100180', '10.1046/j.1365-2133.2002.04834.x',
     'British Journal of Dermatology', 2002, 'disclosed',
     'https://pubmed.ncbi.nlm.nih.gov/12100180/'),
    ('pigmentation', 'ascorbic-acid', 'cosmetic_study',
     'topical L-ascorbic acid photoprotection / pigmentation-related literature',
     'human topical use', 'formulation-dependent (often acidic leave-on)', 'topical serum', 'study-dependent',
     '국소 아스코르빈산은 광손상·색소 관련 지표와 연관된 임상·문헌 근거가 있음. 민감 피부에서는 자극 주의.',
     'controlled_clinical_study', '10417566', NULL,
     'Dermatologic Surgery / related topical vitamin C reports', 1999, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/10417566/'),
    ('antiaging', 'retinol', 'cosmetic_study',
     'clinical improvement of naturally aged skin with topical retinol',
     'naturally aged human skin', 'study-dependent topical retinol', 'topical cream', 'months',
     '국소 레티놀은 자연 노화 피부의 외관·조직학 지표 개선과 연관된 임상 근거가 보고됨. 자극·광민감 주의 · 치료 단정 금지.',
     'controlled_clinical_study', '17456614', NULL,
     'Archives of Dermatology', 2007, 'disclosed',
     'https://pubmed.ncbi.nlm.nih.gov/17456614/'),
    ('antiaging', 'adenosine', 'cosmetic_study',
     'randomized placebo-controlled FOITS evaluation of adenosine anti-wrinkle products',
     'women with periorbital lines / glabellar frowns', 'adenosine-containing cream / film',
     'topical leave-on', 'up to 8 weeks',
     '아데노신 함유 제형은 눈가·미간 주름 매끄러움 지표 개선과 연관된 대조 임상 보고가 있음. 제품 전체 주름 치료로 단정하지 않음.',
     'controlled_clinical_study', '18489289', '10.1111/j.1467-2494.2006.00349.x',
     'International Journal of Cosmetic Science', 2006, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/18489289/'),
    ('pores', 'niacinamide', 'cosmetic_study',
     'topical niacinamide + N-acetyl glucosamine facial appearance context',
     'adult women facial skin', 'niacinamide-containing moisturizer regimen', 'topical leave-on', 'weeks',
     '나이아신아마이드 함유 보습 요법은 안면 외관(반점·균일도) 개선 맥락의 대조 임상 근거가 있음. 모공 축소 치료로 단정하지 않음.',
     'controlled_clinical_study', '19845667', NULL,
     'British Journal of Dermatology', 2009, 'disclosed',
     'https://pubmed.ncbi.nlm.nih.gov/19845667/'),
    ('pores', 'salicylic-acid', 'cosmetic_study',
     'salicylic acid as keratolytic / peeling agent literature',
     'dermatologic / cosmetic peel contexts', 'formulation-dependent', 'topical / peel', 'study-dependent',
     '살리실산은 각질 용해·표면 정돈 맥락에서 문헌 근거가 있음. 모공 축소·여드름 완치 주장이 아님 · 과사용 자극 주의.',
     'observational_study', '14756523', NULL,
     'Dermatologic Surgery / related peeling agent reviews', 2004, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/14756523/'),
    ('uv', 'zinc-oxide', 'guideline',
     'review of available photoprotection options',
     'general topical sunscreen use', 'sunscreen-label dependent', 'topical sunscreen', 'n/a',
     '광범위 자외선 차단(물리적·화학적 필터 포함)은 광손상 예방의 핵심 수단으로 문헌에서 정리됨. 세럼 성분만으로 SPF를 대체하지 않음.',
     'systematic_review', '21665869', NULL,
     'American Journal of Clinical Dermatology / photoprotection reviews', 2011, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/21665869/'),
    ('uv', 'ascorbic-acid', 'cosmetic_study',
     'topical vitamin C adjunct photoprotection literature',
     'human topical use', 'formulation-dependent', 'topical serum under / with sunscreen', 'study-dependent',
     '국소 비타민 C는 광보호 보조 맥락의 근거가 보고되나, 자외선 차단제를 대체하지 않음.',
     'controlled_clinical_study', '15729863', NULL,
     'Dermatologic Surgery / related topical ascorbate photoprotection reports', 2005, 'unknown',
     'https://pubmed.ncbi.nlm.nih.gov/15729863/')
) AS v(
  concern_code, ingredient_slug, evidence_type, study_design, population, concentration,
  formulation, study_duration, outcome_summary, evidence_level, pmid, doi, journal,
  publication_year, coi, source_url
)
JOIN public.skin_concerns c ON c.code = v.concern_code
JOIN public.ingredients i ON i.slug = v.ingredient_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredient_evidence e WHERE e.pmid = v.pmid
);

-- Staging-only: align active KR product key_ingredients / skin_concern so ranking diverges by concern.
-- Does not change active/verified flags. Skips inactive / unverified rows.
UPDATE public.products p
SET
  key_ingredients = CASE
    WHEN p.slug ILIKE '%niacinamide%' THEN ARRAY['Niacinamide', 'Zinc PCA', 'Allantoin']::text[]
    WHEN p.slug ILIKE '%retinol%' THEN ARRAY['Retinol', 'Adenosine', 'Panthenol']::text[]
    WHEN p.slug ILIKE '%aha%bha%' OR p.slug ILIKE '%clarifying%' THEN ARRAY['Salicylic Acid', 'Glycolic Acid', 'Panthenol']::text[]
    WHEN p.slug ILIKE '%snail%' OR p.slug ILIKE '%mucin%' THEN ARRAY['Snail Secretion Filtrate', 'Sodium Hyaluronate', 'Panthenol']::text[]
    ELSE COALESCE(p.key_ingredients, ARRAY[]::text[])
  END,
  skin_concern = CASE
    WHEN p.slug ILIKE '%niacinamide%' THEN ARRAY['acne', 'pores', 'pigmentation']::text[]
    WHEN p.slug ILIKE '%retinol%' THEN ARRAY['antiaging', 'wrinkle']::text[]
    WHEN p.slug ILIKE '%aha%bha%' OR p.slug ILIKE '%clarifying%' THEN ARRAY['pores', 'acne']::text[]
    WHEN p.slug ILIKE '%snail%' OR p.slug ILIKE '%mucin%' THEN ARRAY['dryness', 'redness']::text[]
    ELSE COALESCE(p.skin_concern, ARRAY[]::text[])
  END
WHERE p.active IS TRUE
  AND p.verified_at IS NOT NULL
  AND (
    p.slug ILIKE '%niacinamide%'
    OR p.slug ILIKE '%retinol%'
    OR p.slug ILIKE '%aha%bha%'
    OR p.slug ILIKE '%clarifying%'
    OR p.slug ILIKE '%snail%'
    OR p.slug ILIKE '%mucin%'
  );

COMMIT;
