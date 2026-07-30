-- =============================================================================
-- products.availability_status 신설 — 오퍼를 끝내 못 얻은 제품을 «표시»하기 위한 것
--
-- DRAFT. 아직 적용하지 않는다. 사람 승인 후 적용한다.
--
-- -----------------------------------------------------------------------------
-- 왜 필요한가
-- -----------------------------------------------------------------------------
-- 2026-07-28 결정: 「오퍼가 끝내 안 생기는 항목은 삭제하지 말고 unavailable /
-- discontinued 로 표시만 한다」.
--
-- 그런데 표시할 자리가 없다:
--   · `product_offers.stock_status` 는 in_stock / out_of_stock / unknown 만 허용하고
--     (20260712000000_create_product_offers.sql), 애초에 이 189건은 **오퍼가 0건**
--     이라 표시할 행 자체가 없다.
--   · 없는 판매처를 out_of_stock 오퍼로 만들어 넣는 것은 «판매처를 지어내는» 것이라
--     §5-3 위반이다. purchase_url 도 가격도 없는 오퍼는 만들지 않는다.
--   · `products.active` 는 노출 여부이지 «왜 노출 안 되는지» 를 담지 못한다.
--
-- 그래서 제품 자체에 상태를 둔다. 이 값은 **노출 판단에 쓰지 않는다** — 노출은
-- 지금처럼 `active` + `verified_at` + verified 오퍼로만 결정한다. 이 컬럼은
-- «이 제품을 왜 더 안 쫓는가» 를 사람이 알 수 있게 남기는 기록이다.
--
-- -----------------------------------------------------------------------------
-- 값의 뜻
-- -----------------------------------------------------------------------------
--   NULL                아직 판단 안 함 (기본값). 수집 대상으로 남아 있다.
--   unknown             수집을 시도했으나 판매처를 확인하지 못함. 재시도 대상.
--   unavailable         현재 국내 판매처가 확인되지 않음. 재입고·재판매 가능성 있음.
--   discontinued        단종·판매종료가 확인됨. 더 쫓지 않는다.
--   blocked_by_policy   제품에는 문제가 없으나 **우리 정책상 대상이 아님**.
--                       2026-07-28 결정: §29 K-뷰티 스코프 밖 브랜드(The Ordinary·
--                       Clinique·Bioderma 등)는 수집하지 않는다. 판매 여부와 무관한
--                       사유라 unavailable/discontinued 와 반드시 구분한다 —
--                       섞으면 나중에 «판매처가 없어서» 인지 «안 하기로 해서» 인지
--                       알 수 없게 된다.
--
-- unavailable 과 discontinued 를 나누는 이유: 전자는 재시도 큐에 남기고 후자는
-- 빼기 위해서다. 둘을 합치면 단종 제품을 영원히 재크롤하게 된다.
--
-- 근거를 함께 남긴다 — 나중에 «왜 단종이라고 판단했나» 를 확인할 수 있어야 한다.
-- =============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS availability_status text
    CHECK (availability_status IN
      ('unknown', 'unavailable', 'discontinued', 'blocked_by_policy'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS availability_checked_at timestamptz;

-- 판단 근거(확인한 URL·응답·날짜). 지어낸 값이 들어가지 않도록 근거 없이
-- availability_status 만 채우는 것을 금지하는 것이 운영 규칙이다.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS availability_evidence text;

COMMENT ON COLUMN products.availability_status IS
  '수집 대상에서 빠진 사유. NULL=미판단, unknown=재시도 대상, unavailable=현재 판매처 미확인, discontinued=단종 확인, blocked_by_policy=K-뷰티 스코프 밖 등 정책상 제외. 노출 판단에는 쓰지 않는다(노출은 active+verified_at+verified offer).';
COMMENT ON COLUMN products.availability_evidence IS
  '위 판단의 근거(확인한 URL·응답 요약). 근거 없이 status 만 채우지 않는다.';

-- 재시도 대상을 빠르게 뽑기 위한 부분 인덱스.
CREATE INDEX IF NOT EXISTS products_availability_status_idx
  ON products (availability_status)
  WHERE availability_status IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 되돌리기
-- -----------------------------------------------------------------------------
--   DROP INDEX IF EXISTS products_availability_status_idx;
--   ALTER TABLE products DROP COLUMN IF EXISTS availability_evidence;
--   ALTER TABLE products DROP COLUMN IF EXISTS availability_checked_at;
--   ALTER TABLE products DROP COLUMN IF EXISTS availability_status;
