-- =============================================================================
-- Production 알레르겐 노출 감사 — 읽기 전용
--
-- 대상    Production (rhfr***mns)
-- 작성일  2026-07-27
-- 실행    사람이 Supabase Dashboard → SQL Editor 에서 직접
--
-- -----------------------------------------------------------------------------
-- 이 파일이 하는 일
-- -----------------------------------------------------------------------------
-- 2026-07-27 에 알레르기·회피 필터를 고쳤다. 그 전 필터는 `key_ingredients`
-- (기능성 성분 사전 23종으로 골라낸 부분집합)만 봤기 때문에, 전성분에만 적힌
-- 향료·리모넨·리날룰 같은 알레르겐을 걸러내지 못했다. Staging 에서는 28건이
-- 이렇게 새어 나갔다. Production 카탈로그에도 같은 노출이 있었는지 센다.
--
-- -----------------------------------------------------------------------------
-- 안전성 — 실행 전에 확인할 것
-- -----------------------------------------------------------------------------
--   · **SELECT 만 있다.** INSERT / UPDATE / DELETE / DDL / GRANT 없음.
--   · 테이블·뷰·함수를 만들지 않는다. CTE(WITH) 만 쓴다.
--   · 몇 번을 실행해도 데이터가 바뀌지 않는다. 되돌릴 것이 없다.
--   · 읽는 테이블은 `products` 하나뿐이다. 사용자 테이블은 건드리지 않는다.
--   · 결과에 개인정보가 없다 — 제품 id·브랜드·제품명·성분명뿐이다.
--
--   직접 확인하는 법: 이 파일에서 아래 단어를 검색해 **주석 밖에 하나도 없으면**
--   안전하다.
--     insert   update   delete   drop   alter   create   truncate   grant
--
-- -----------------------------------------------------------------------------
-- 실행 방법
-- -----------------------------------------------------------------------------
-- 쿼리가 4개다. Dashboard 는 마지막 결과만 보여주므로 **하나씩 따로** 실행한다.
-- 각 쿼리는 `-- 쿼리 N` 주석으로 시작해서 세미콜론으로 끝난다. 그 구간만
-- 드래그해서 Run 하면 된다.
--
--   쿼리 1  요약   — 알레르겐별로 몇 건이 노출됐었나          ← 이것부터
--   쿼리 2  상세   — 노출됐던 제품 목록 (근거 성분 포함)
--   쿼리 3  참고   — key_ingredients·category 미채움 현황
--   쿼리 4  참고   — 얼굴 트랙 밖 제품이 추천 후보에 있는지
--
-- 결과는 표를 그대로 복사해서 주면 된다. 건수만 있어도 판단할 수 있다.
--
-- -----------------------------------------------------------------------------
-- 판정 규칙 — 코드(src/lib/recommend/allergenMatch.ts)와 맞춰 놓았다
-- -----------------------------------------------------------------------------
--   · 성분명을 소문자로 바꾸고 숫자·기호·공백을 지운 뒤 비교한다.
--   · 한글 표기와 영문 표기를 같은 것으로 본다 (리모넨 = Limonene).
--     쌍은 전부 식약처 화장품 원료성분정보에서 확인한 것만 넣었다.
--   · 「새 필터」는 **접두 관계**일 때만 같은 계열로 본다:
--         Centella Asiatica ⊂ Centella Asiatica Extract → 매칭 (센텔라 유래)
--         Alcohol           ⊄ Cetearyl Alcohol          → 매칭 안 함 (별개 성분)
--     이 구분이 없으면 세테아릴알코올 같은 지방 알코올(유화제)이 «변성알코올»
--     로 잘못 걸린다. Staging 에서 실제로 15건 발생했다.
--   · 「옛 필터」는 그때 쓰던 **부분 문자열 포함** 규칙을 그대로 재현한다.
--     즉 옛 필터가 잡던 오탐까지 «잡은 것» 으로 세므로, 「노출됐던 건수」가
--     실제보다 부풀지 않는다(보수적).
--
-- 한계: 전성분이 한 칸에 통짜로 저장돼 있고 그 안에 광고 문구가 섞인 경우
-- (§35.7 파서 잔여물), 쉼표 분리만으로는 성분 토큰이 안 나올 수 있다.
-- Staging 에서는 이런 미검출이 2건이었다. 즉 실제 노출은 이 결과보다 조금
-- 많을 수 있고, 적지는 않다.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 1 — 요약: 알레르겐별로 몇 건이 노출됐었나
--
--   「옛 필터가 잡음」  수정 전에도 걸러지던 것
--   「새 필터가 잡음」  수정 후 걸러지는 것
--   「노출됐던 건수」   그 차이 = 그 알레르기를 신고한 사용자에게 나갔을 수 있는 것
--
-- 노출이 하나도 없으면 결과가 빈 표로 나온다. 그게 정상이고, 좋은 결과다.
-- ─────────────────────────────────────────────────────────────────────────────
WITH allergen AS (
  SELECT * FROM (VALUES
    ('Fragrance',                   ARRAY['fragrance','parfum','perfume','향료']),
    ('Alcohol Denat',               ARRAY['alcohol','alcoholdenat','ethanol','변성알코올','에탄올']),
    ('Essential Oil',               ARRAY['essentialoil','에센셜오일']),
    ('Limonene',                    ARRAY['limonene','리모넨']),
    ('Linalool',                    ARRAY['linalool','리날룰']),
    ('Citronellol',                 ARRAY['citronellol','시트로넬올']),
    ('Geraniol',                    ARRAY['geraniol','제라니올']),
    ('Citral',                      ARRAY['citral','시트랄']),
    ('Eugenol',                     ARRAY['eugenol','유제놀']),
    ('Coumarin',                    ARRAY['coumarin','쿠마린']),
    ('Farnesol',                    ARRAY['farnesol','파네솔']),
    ('Cinnamal',                    ARRAY['cinnamal','신남알']),
    ('Hexyl Cinnamal',              ARRAY['hexylcinnamal','헥실신남알']),
    ('Cinnamyl Alcohol',            ARRAY['cinnamylalcohol','신나밀알코올']),
    ('Benzyl Alcohol',              ARRAY['benzylalcohol','벤질알코올']),
    ('Benzyl Benzoate',             ARRAY['benzylbenzoate','벤질벤조에이트']),
    ('Benzyl Salicylate',           ARRAY['benzylsalicylate','벤질살리실레이트']),
    ('Hydroxycitronellal',          ARRAY['hydroxycitronellal','하이드록시시트로넬알']),
    ('Butylphenyl Methylpropional', ARRAY['butylphenylmethylpropional','부틸페닐메틸프로피오날']),
    ('Alpha-Isomethyl Ionone',      ARRAY['alphaisomethylionone','알파아이소메틸아이오논']),
    ('Niacinamide',                 ARRAY['niacinamide','나이아신아마이드']),
    ('Centella Asiatica',           ARRAY['centellaasiatica','madecassoside','마데카소사이드'])
  ) AS t(display_name, forms)
),
-- 추천 후보가 되는 제품만 본다 (공개 화면과 같은 조건).
target AS (
  SELECT id, key_ingredients, key_ingredients_ja, full_ingredients
  FROM products
  WHERE active IS TRUE
    AND verified_at IS NOT NULL
),
-- 코드와 같은 정규화: 소문자 → 숫자 제거 → 영문/한글만 남김.
key_tokens AS (
  SELECT t.id,
         regexp_replace(
           regexp_replace(lower(tok), '[0-9]+(\.[0-9]+)?', '', 'g'),
           '[^a-z가-힣]', '', 'g'
         ) AS norm
  FROM target t,
       LATERAL unnest(
         COALESCE(t.key_ingredients, '{}'::text[]) || COALESCE(t.key_ingredients_ja, '{}'::text[])
       ) AS tok
),
-- 전성분은 한 칸에 통짜로 들어 있는 경우가 있어 쉼표·슬래시로 한 번 더 쪼갠다.
full_tokens AS (
  SELECT t.id,
         regexp_replace(
           regexp_replace(lower(part), '[0-9]+(\.[0-9]+)?', '', 'g'),
           '[^a-z가-힣]', '', 'g'
         ) AS norm
  FROM target t,
       LATERAL unnest(COALESCE(t.full_ingredients, '{}'::text[])) AS tok,
       LATERAL regexp_split_to_table(tok, '[,;/|·]') AS part
),
-- 옛 필터: key_ingredients 만 보고, 부분 문자열 포함 규칙.
match_old AS (
  SELECT DISTINCT a.display_name, k.id
  FROM allergen a
  JOIN key_tokens k ON EXISTS (
    SELECT 1 FROM unnest(a.forms) AS f
    WHERE k.norm = f
       OR (length(f) >= 4 AND length(k.norm) >= 4
           AND (position(f in k.norm) > 0 OR position(k.norm in f) > 0))
  )
),
-- 새 필터: 전성분까지 보고, 접두 관계 규칙.
match_new AS (
  SELECT DISTINCT a.display_name, x.id
  FROM allergen a
  JOIN (
    SELECT id, norm FROM key_tokens
    UNION ALL
    SELECT id, norm FROM full_tokens
  ) x ON EXISTS (
    SELECT 1 FROM unnest(a.forms) AS f
    WHERE x.norm = f
       OR (length(f) >= 4 AND length(x.norm) >= 4
           AND (left(x.norm, length(f)) = f OR left(f, length(x.norm)) = x.norm))
  )
),
-- 성분 정보가 아예 없는 제품은 옛 필터에서도 incomplete_info 로 빠졌다.
-- 노출된 적이 없으므로 집계에서 뺀다.
has_key AS (
  SELECT DISTINCT id FROM key_tokens WHERE norm <> ''
)
SELECT a.display_name                              AS "알레르겐",
       (SELECT count(*) FROM has_key)              AS "검사 대상 제품수",
       count(DISTINCT o.id)                        AS "옛 필터가 잡음",
       count(DISTINCT n.id)                        AS "새 필터가 잡음",
       count(DISTINCT n.id) - count(DISTINCT o.id) AS "노출됐던 건수"
FROM allergen a
LEFT JOIN match_new n
       ON n.display_name = a.display_name
      AND n.id IN (SELECT id FROM has_key)
LEFT JOIN match_old o
       ON o.display_name = a.display_name
      AND o.id IN (SELECT id FROM has_key)
GROUP BY a.display_name
HAVING count(DISTINCT n.id) - count(DISTINCT o.id) > 0
ORDER BY 5 DESC, 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 2 — 상세: 노출됐던 제품 목록 (어느 성분 때문인지 근거 포함)
--
-- CTE 정의가 다시 필요해 같은 블록을 반복한다. 이 구간만 따로 Run 하면 된다.
-- ─────────────────────────────────────────────────────────────────────────────
WITH allergen AS (
  SELECT * FROM (VALUES
    ('Fragrance',                   ARRAY['fragrance','parfum','perfume','향료']),
    ('Alcohol Denat',               ARRAY['alcohol','alcoholdenat','ethanol','변성알코올','에탄올']),
    ('Essential Oil',               ARRAY['essentialoil','에센셜오일']),
    ('Limonene',                    ARRAY['limonene','리모넨']),
    ('Linalool',                    ARRAY['linalool','리날룰']),
    ('Citronellol',                 ARRAY['citronellol','시트로넬올']),
    ('Geraniol',                    ARRAY['geraniol','제라니올']),
    ('Citral',                      ARRAY['citral','시트랄']),
    ('Eugenol',                     ARRAY['eugenol','유제놀']),
    ('Coumarin',                    ARRAY['coumarin','쿠마린']),
    ('Farnesol',                    ARRAY['farnesol','파네솔']),
    ('Cinnamal',                    ARRAY['cinnamal','신남알']),
    ('Hexyl Cinnamal',              ARRAY['hexylcinnamal','헥실신남알']),
    ('Cinnamyl Alcohol',            ARRAY['cinnamylalcohol','신나밀알코올']),
    ('Benzyl Alcohol',              ARRAY['benzylalcohol','벤질알코올']),
    ('Benzyl Benzoate',             ARRAY['benzylbenzoate','벤질벤조에이트']),
    ('Benzyl Salicylate',           ARRAY['benzylsalicylate','벤질살리실레이트']),
    ('Hydroxycitronellal',          ARRAY['hydroxycitronellal','하이드록시시트로넬알']),
    ('Butylphenyl Methylpropional', ARRAY['butylphenylmethylpropional','부틸페닐메틸프로피오날']),
    ('Alpha-Isomethyl Ionone',      ARRAY['alphaisomethylionone','알파아이소메틸아이오논']),
    ('Niacinamide',                 ARRAY['niacinamide','나이아신아마이드']),
    ('Centella Asiatica',           ARRAY['centellaasiatica','madecassoside','마데카소사이드'])
  ) AS t(display_name, forms)
),
target AS (
  SELECT id, brand, name, key_ingredients, key_ingredients_ja, full_ingredients
  FROM products
  WHERE active IS TRUE AND verified_at IS NOT NULL
),
key_tokens AS (
  SELECT t.id, tok AS raw,
         regexp_replace(
           regexp_replace(lower(tok), '[0-9]+(\.[0-9]+)?', '', 'g'),
           '[^a-z가-힣]', '', 'g'
         ) AS norm
  FROM target t,
       LATERAL unnest(
         COALESCE(t.key_ingredients, '{}'::text[]) || COALESCE(t.key_ingredients_ja, '{}'::text[])
       ) AS tok
),
full_tokens AS (
  SELECT t.id, part AS raw,
         regexp_replace(
           regexp_replace(lower(part), '[0-9]+(\.[0-9]+)?', '', 'g'),
           '[^a-z가-힣]', '', 'g'
         ) AS norm
  FROM target t,
       LATERAL unnest(COALESCE(t.full_ingredients, '{}'::text[])) AS tok,
       LATERAL regexp_split_to_table(tok, '[,;/|·]') AS part
),
match_old AS (
  SELECT DISTINCT a.display_name, k.id
  FROM allergen a
  JOIN key_tokens k ON EXISTS (
    SELECT 1 FROM unnest(a.forms) AS f
    WHERE k.norm = f
       OR (length(f) >= 4 AND length(k.norm) >= 4
           AND (position(f in k.norm) > 0 OR position(k.norm in f) > 0))
  )
),
match_new AS (
  SELECT a.display_name, x.id, min(btrim(x.raw)) AS evidence_token
  FROM allergen a
  JOIN (
    SELECT id, raw, norm FROM key_tokens
    UNION ALL
    SELECT id, raw, norm FROM full_tokens
  ) x ON EXISTS (
    SELECT 1 FROM unnest(a.forms) AS f
    WHERE x.norm = f
       OR (length(f) >= 4 AND length(x.norm) >= 4
           AND (left(x.norm, length(f)) = f OR left(f, length(x.norm)) = x.norm))
  )
  GROUP BY a.display_name, x.id
),
has_key AS (SELECT DISTINCT id FROM key_tokens WHERE norm <> '')
SELECT t.id                        AS "제품 id",
       t.brand                     AS "브랜드",
       left(t.name, 60)            AS "제품명",
       string_agg(DISTINCT n.display_name, ', ' ORDER BY n.display_name)
                                   AS "노출된 알레르겐",
       left(min(n.evidence_token), 60)
                                   AS "근거 성분 (원문 표기)"
FROM match_new n
JOIN target t ON t.id = n.id
WHERE n.id IN (SELECT id FROM has_key)
  AND NOT EXISTS (
    SELECT 1 FROM match_old o
    WHERE o.id = n.id AND o.display_name = n.display_name
  )
GROUP BY t.id, t.brand, t.name
ORDER BY count(DISTINCT n.display_name) DESC, t.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 3 — 참고: 추천에서 아예 빠지는 제품이 얼마나 되나
--
-- Staging 에서는 수집기가 key_ingredients 를 안 채워, 활성 106건 중 60건이
-- 추천에서 통째로 빠져 있었다. Production 도 같은 상태인지 본다.
-- 이건 안전 문제가 아니라 추천 품질 문제다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) FILTER (WHERE active IS TRUE AND verified_at IS NOT NULL)
         AS "활성 제품",
       count(*) FILTER (
         WHERE active IS TRUE AND verified_at IS NOT NULL
           AND COALESCE(array_length(key_ingredients, 1), 0) = 0
           AND COALESCE(array_length(key_ingredients_ja, 1), 0) = 0
       ) AS "key_ingredients 없음",
       count(*) FILTER (
         WHERE active IS TRUE AND verified_at IS NOT NULL
           AND COALESCE(array_length(key_ingredients, 1), 0) = 0
           AND COALESCE(array_length(key_ingredients_ja, 1), 0) = 0
           AND COALESCE(array_length(full_ingredients, 1), 0) > 0
       ) AS "전성분은 있어 채울 수 있음",
       count(*) FILTER (
         WHERE active IS TRUE AND verified_at IS NOT NULL AND category IS NULL
       ) AS "category 없음"
FROM products;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 4 — 참고: 얼굴 트랙 밖 제품이 추천 후보에 있는지
--
-- 향수·핸드크림·바디 제품은 §29 얼굴 트랙 밖인데, 브랜드 자사몰을 통째로
-- 수집하면 같이 들어온다. Staging 에서 8건 발견해 추천 풀에서 뺐다.
-- 결과가 빈 표로 나오면 Production 에는 해당 없음이라는 뜻이다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COALESCE(category, '(비어 있음)')              AS "카테고리",
       count(*)                                       AS "건수",
       left(string_agg(name, ' · ' ORDER BY id), 120) AS "예시"
FROM products
WHERE active IS TRUE
  AND verified_at IS NOT NULL
  AND category IN (
    'perfume','hand_cream','body_lotion','body_wash','body_oil','body_scrub','foot_cream'
  )
GROUP BY category
ORDER BY 2 DESC;
