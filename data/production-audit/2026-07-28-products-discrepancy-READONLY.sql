-- =============================================================================
-- Production products 건수 불일치 진단 — 읽기 전용
--
-- 작성일  2026-07-28
-- 실행    사람이 Supabase Dashboard → SQL Editor 에서 직접
--
-- -----------------------------------------------------------------------------
-- 무엇을 확인하려는 건가
-- -----------------------------------------------------------------------------
-- 2026-07-26 기록: Production 공개 제품 **191건** (DASHBOARD.md §26).
-- 2026-07-28 실측: 활성 제품 **2건**, 전성분 있는 것 0건.
--
-- 189건 차이의 원인을 확정한다. 가능한 설명이 여러 개고, 어느 것인지에 따라
-- 대응이 완전히 달라지므로 **추측하지 말고 순서대로 확인한다.**
--
--   (A) 다른 프로젝트에 접속해 있다
--       — 지금 Supabase 대시보드에서 Production ref 가 안 보인다는 문제와
--         이어진다. SQL Editor 를 연 프로젝트가 실제 서비스가 쓰는 프로젝트와
--         다르면, 텅 빈 결과가 나오는 게 당연하다. **이것부터 배제한다.**
--   (B) 191 을 잰 조건과 지금 조건이 다르다
--       — 예: 그때는 anon(RLS) 경로로 셌고 지금은 service_role 로 센다든지,
--         verified_at 조건 유무가 다르다든지.
--   (C) 실제로 행이 사라졌다 (삭제·비활성화)
--       — 가장 나쁜 경우. 이 경우에만 복구를 논한다.
--
-- -----------------------------------------------------------------------------
-- 안전성
-- -----------------------------------------------------------------------------
--   · SELECT 만 있다. INSERT / UPDATE / DELETE / DDL / GRANT 없음.
--   · 테이블·뷰·함수를 만들지 않는다.
--   · 몇 번을 실행해도 데이터가 바뀌지 않는다.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 A — **지금 어느 프로젝트에 접속해 있는가** (가설 A 배제용, 이것부터)
--
-- 2026-07-26 에 Production 으로 병원 데이터 1,917행을 이관하고 검증까지 마쳤다.
-- 그 테이블의 행 수가 곧 이 프로젝트의 신원 확인이 된다.
--
--   dermatology_institution_candidates = 1917  → 서비스가 쓰는 그 Production 이 맞다
--   0 또는 테이블 없음                          → **다른 프로젝트다.** 여기서 멈추고
--                                                 올바른 프로젝트를 먼저 찾아야 한다
--
-- 함께: 브라우저 주소창의 /project/<여기> 값이 Vercel 의
-- NEXT_PUBLIC_SUPABASE_URL 에 있는 ref 와 같은지도 눈으로 대조할 것.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT current_database()                                   AS "DB 이름",
       (SELECT count(*) FROM products)                      AS "products 전체",
       (SELECT count(*) FROM dermatology_institution_candidates)
                                                            AS "병원 데이터 (기대 1917)",
       (SELECT count(*) FROM ingredients)                   AS "ingredients",
       (SELECT count(*) FROM product_offers)                AS "product_offers";


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 B — products 건수를 조건별로 따로 센다 (가설 B 확인)
--
-- 「191」이 어떤 조건으로 센 값이었는지 모르므로 조건을 분해해서 전부 본다.
-- 어느 칸이 191 에 가까운지가 곧 그때의 조건이다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                                      AS "전체 행",
       count(*) FILTER (WHERE active IS TRUE)                        AS "active = true",
       count(*) FILTER (WHERE active IS FALSE)                       AS "active = false",
       count(*) FILTER (WHERE active IS NULL)                        AS "active = null",
       count(*) FILTER (WHERE verified_at IS NOT NULL)               AS "verified_at 있음",
       count(*) FILTER (WHERE verified_at IS NULL)                   AS "verified_at 없음",
       count(*) FILTER (WHERE active IS TRUE AND verified_at IS NOT NULL)
                                                                     AS "active + verified (추천 풀 조건)"
FROM products;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 C — active × verified_at 교차표
--
-- 예를 들어 「active=true 인데 verified_at 이 없는」 행이 189건쯤 나오면,
-- 데이터가 사라진 게 아니라 verified_at 조건 때문에 안 잡히는 것이다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COALESCE(active::text, 'null')                        AS "active",
       CASE WHEN verified_at IS NULL THEN '없음' ELSE '있음' END
                                                             AS "verified_at",
       count(*)                                              AS "건수"
FROM products
GROUP BY 1, 2
ORDER BY 3 DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 D — 행이 언제 만들어졌나 (가설 C 확인)
--
-- 남아 있는 행이 옛날 것이면 «원래 이만큼이었다», 최근 것뿐이면 «옛 행이
-- 사라지고 새로 몇 개만 들어왔다» 는 뜻이다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT date_trunc('day', created_at)::date                   AS "생성일",
       count(*)                                              AS "건수",
       count(*) FILTER (WHERE active IS TRUE)                AS "그중 active",
       left(string_agg(name, ' · ' ORDER BY id), 100)        AS "예시"
FROM products
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 E — 남아 있는 행이 실제로 무엇인가
--
-- 2건뿐이라면 그게 진짜 제품인지, 아니면 테스트·probe 행인지 눈으로 본다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, brand, left(name, 50) AS name, slug, category,
       active, verified_at, created_at,
       COALESCE(array_length(key_ingredients, 1), 0)  AS "key 성분수",
       COALESCE(array_length(full_ingredients, 1), 0) AS "전성분수"
FROM products
ORDER BY created_at DESC NULLS LAST
LIMIT 50;


-- ─────────────────────────────────────────────────────────────────────────────
-- 쿼리 F — 삭제·비활성화 흔적이 감사 로그에 남아 있는가
--
-- `product_change_history` 는 우리 코드가 제품 변경을 기록하는 테이블이다.
-- 사람이 대시보드에서 직접 지웠다면 여기에는 안 남는다 — 비어 있다고 해서
-- 삭제가 없었다는 뜻은 아니다.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT date_trunc('day', created_at)::date AS "일자",
       action                              AS "동작",
       count(*)                            AS "건수"
FROM product_change_history
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC
LIMIT 40;
