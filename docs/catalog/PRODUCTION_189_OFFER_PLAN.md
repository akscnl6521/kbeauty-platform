# Production 189건 오퍼 확보 계획 (2026-07-28)

Production `products` 191건 중 **189건이 `verified_at IS NULL` · `product_offers` 0건**으로
확인됐다. 데이터 실종이 아니라 파이프라인이 «판매처 없음» 에서 멈춘 상태다.

**이 문서는 계획만이다. Production 에는 아무것도 쓰지 않았다.**

---

## 1. 로드맵 상 위치

[ROADMAP.md](../../ROADMAP.md) **제품 데이터 자동화** 의 유일한 미완 항목에 걸려 있다:

> `[~]` 실공식 출처 live verify · **verified 구매 SKU 풀**

앞뒤 단계는 이미 끝나 있다 — 후보 수집·정규화, 전성분 검증 구조, 중복 검사,
갱신 정책, 검수 큐, 자동 게시 차단까지 `[x]`. 즉 **막힌 곳은 한 지점**이고,
그것이 정확히 이 189건이다.

왜 여기서 멈추면 노출이 안 되는가:

| 게이트 | 위치 | 요구 |
|---|---|---|
| 활성화 | `verifyAndActivateProduct` | verified · in_stock · 가격>0 · 통화 · 배송국 있는 오퍼 **1건 이상** |
| 추천 후보 | `fetchCandidateProducts` | `active=true AND verified_at IS NOT NULL` |
| 구매 CTA | `productOffer.ts` | in_stock verified 오퍼만 |

189건은 첫 관문을 못 넘어 `verified_at` 이 안 찍혔고, 그래서 추천 풀에도 안 들어간다.
**현재 상태 자체는 안전하다** — 가짜 판매처를 만들지 않고 정직하게 막혀 있는 것이다.

---

## 2. 단계 0 — 파악 (읽기 전용, 먼저 해야 함)

계획의 나머지가 전부 여기 결과에 달려 있다. 특히 **레거시 구매 링크 컬럼**
(`link_oliveyoung` · `link_coupang` 등)이 채워져 있는지가 수율을 크게 가른다.
채워져 있으면 «브랜드몰을 뒤져 제품을 찾는» 일이 아니라 «이미 아는 URL 을 검증하는»
일이 되어 난이도가 완전히 달라진다.

```sql
-- (가) 브랜드 분포 — 어느 브랜드에 몰려 있나
SELECT brand, count(*) AS 건수,
       count(*) FILTER (WHERE verified_at IS NULL) AS 미검증
FROM products
GROUP BY brand
ORDER BY 2 DESC;

-- (나) 레거시 구매 링크가 있나  ← 수율을 가르는 핵심
SELECT count(*)                                                        AS 전체,
       count(*) FILTER (WHERE link_oliveyoung IS NOT NULL)             AS 올리브영,
       count(*) FILTER (WHERE link_coupang    IS NOT NULL)             AS 쿠팡,
       count(*) FILTER (WHERE link_amazon_us  IS NOT NULL)             AS 아마존US,
       count(*) FILTER (WHERE link_qoo10      IS NOT NULL)             AS 큐텐,
       count(*) FILTER (WHERE link_yesstyle   IS NOT NULL)             AS 예스스타일,
       count(*) FILTER (WHERE COALESCE(link_oliveyoung, link_coupang,
                                       link_amazon_us, link_qoo10,
                                       link_yesstyle) IS NOT NULL)     AS "링크 하나라도 있음"
FROM products
WHERE verified_at IS NULL;

-- (다) 카테고리·가격 분포 — 얼마나 오래된 시드인지
SELECT COALESCE(category, '(없음)') AS 카테고리, count(*) AS 건수,
       count(*) FILTER (WHERE price_usd IS NOT NULL) AS "price_usd 있음",
       min(created_at)::date AS 최초생성, max(created_at)::date AS 최종생성
FROM products
WHERE verified_at IS NULL
GROUP BY 1 ORDER BY 2 DESC;

-- (라) Staging 과 겹치는가 (brand+name 기준으로 볼 수 있게 목록만)
SELECT brand, left(name, 50) AS name, slug
FROM products
WHERE verified_at IS NULL
ORDER BY brand, name;
```

**판단 기준**

| (나) 결과 | 의미 | 경로 |
|---|---|---|
| 링크 있음 다수 | 판매처 URL 을 이미 안다 | **경로 A** — URL 검증만 하면 됨. 수율 높음 |
| 링크 거의 없음 | 브랜드몰부터 찾아야 함 | **경로 B** — 이번 세션 Staging 과 같은 방식. 수율 낮음 |

---

## 3. 단계 1 — Staging 에서 먼저 (Production 무접촉)

Production 에 쓰기 전에 **같은 브랜드를 Staging 에서 돌려 수율을 실측한다.**
이번 세션에서 확인된 대로, 브랜드마다 결과가 극단적으로 갈린다.

### 경로 A — 레거시 링크가 있을 때

기존 `refresh-offers-for-products.ts` 를 그대로 쓴다. 각 링크 URL 을 열어
가격·재고·판매처를 추출하고 게이트를 통과한 것만 오퍼로 만든다.

이미 있는 안전장치가 전부 적용된다:
- `offer-price.ts` — 100원짜리 placeholder 가격 차단 (`price_implausible_placeholder`)
- `offer-stock.ts` — Cafe24 품절 배지 판정 (요소 자체 + 부모 div `displaynone` 양쪽)
- `offer-source-class.ts` — `isSameProductPage` 로 엉뚱한 제품 페이지 연결 차단
- `offer-gate.ts` — 마켓플레이스 셀러 제외, 공식/공인 판매처만

### 경로 B — 링크가 없을 때

`collect-offers-from-brand-pages.ts` + `--host=<브랜드 도메인>` 으로 자사몰을 훑는다.
Cafe24 기반 자사몰은 이번 세션에서 검증된 경로다(플랫폼 감지 `xans-` · `/exec/front/` · `ec-base-`).

### 브랜드별 현실 전망 (이번 세션 Staging 실측 근거)

| 브랜드 유형 | 실측 결과 | 전망 |
|---|---|---|
| Cafe24 자사몰 (abib) | 100건 시도 → 활성 43건 | 40~50% |
| Cafe24 자사몰 (아로마티카) | 10건 시도 → 활성 2건 | 20% |
| 자사몰이나 성분이 이미지뿐 (sioris) | 24건 → **0건** | 0% |
| 봇 차단 브랜드 (Anua 등) | 커넥터 미대응 | 0% — 커넥터 개발 필요 |
| 오퍼 자체가 안 잡힘 (에스쁘아·미쟝센) | 12건 → 0건 | 0% |

로드맵 기록으로는 등록 브랜드 35개 중 **16개에서만** 실제 제품 추출에 성공했다.
**189건 전부가 오퍼를 얻는 결과는 기대하지 않는 것이 맞다.**

---

## 4. 단계 2 — 게이트 통과분만 선별

수집된 오퍼 중 활성화 조건을 만족하는 것만 남긴다. 조건을 낮추지 않는다(§5-6).

- `verification_status = verified`
- `stock_status = in_stock`
- `price > 0` · `currency` 있음 · `verified_at` 있음
- `purchase_url` 이 `https://`
- `ships_to_countries` 비어 있지 않음
- 마켓플레이스 셀러 아님

통과 못 한 제품은 **`needs_review` 로 남기고 활성화하지 않는다.**
이번 세션에서 게이트를 우회했다가 35/70 미매칭 제품이 활성화된 사고가 있었고,
14건을 되돌렸다. 같은 실수를 반복하지 않는다.

---

## 5. 단계 3 — Production 반영 (별도 승인 필요)

**여기서부터는 Production 쓰기다. 승인 없이 진행하지 않는다.**

1. 반영 전 백업 (`data/backups/YYYY-MM-DD/`)
2. dry-run 으로 «몇 건이 오퍼를 얻고 몇 건이 활성화되는지» 먼저 보고
3. 승인 후 `product_offers` INSERT → `verifyAndActivateProduct` 로 활성화
4. 감사 로그 기록 · 반영 후 읽기 검증
5. 실패·미달분은 `verification_queue` 에 `offer_missing` 으로 남김

---

## 6. 하지 않을 것

- **가격·재고·판매처를 만들어 내지 않는다.** 확인 안 되면 빈 상태로 둔다(§5-3).
- `price_usd` 시드값을 오퍼 가격으로 승격하지 않는다 — 검증된 판매처 가격이 아니다.
- 게이트 기준을 낮춰 통과시키지 않는다.
- 마켓플레이스 셀러를 공식 판매처로 취급하지 않는다.
- `published` 자동 전환 없음 — 사람 검수 유지.

---

## 7. 확정된 결정 (2026-07-28)

1. **전수 189건 대상.** 상위 N개로 임의로 자르지 않는다.
2. **오퍼를 끝내 못 얻은 것은 삭제하지 않고 표시만 한다** — `unavailable` / `discontinued`.
   표시할 자리가 없어 컬럼을 신설해야 한다(아래 §8).
3. **Production 쓰기는 아직 승인되지 않았다.** Staging 게이트 통과분 목록까지만 보고한다.
4. **`price_usd` 는 오퍼 가격으로 쓰지 않는다.** 검증된 판매처 가격이 아니다.

## 8. 결정 2 를 위해 필요한 스키마 (미적용)

표시할 자리가 없다는 것을 확인했다:

| 후보 | 왜 안 되는가 |
|---|---|
| `product_offers.stock_status` | `in_stock` / `out_of_stock` / `unknown` 만 허용. 게다가 **189건은 오퍼가 0건**이라 표시할 행 자체가 없다 |
| 없는 오퍼를 `out_of_stock` 으로 생성 | 판매처를 지어내는 것 — §5-3 위반. `purchase_url` 도 가격도 없다 |
| `products.active` | 노출 여부일 뿐 «왜» 를 담지 못한다 |

그래서 제품에 상태 컬럼을 둔다:
[`DRAFT_DO_NOT_APPLY_20260728_products_availability_status.sql`](../../supabase/migrations/DRAFT_DO_NOT_APPLY_20260728_products_availability_status.sql)

- `availability_status` — `NULL`(미판단) · `unknown`(재시도 대상) · `unavailable`(현재 판매처 미확인) · `discontinued`(단종 확인)
- `availability_checked_at` · `availability_evidence` — **근거 없이 status 만 채우지 않는다**
- **노출 판단에는 쓰지 않는다.** 노출은 지금처럼 `active` + `verified_at` + verified 오퍼로만 결정한다

`unavailable` 과 `discontinued` 를 나누는 이유: 전자는 재시도 큐에 남기고 후자는 뺀다.
합치면 단종 제품을 영원히 재크롤하게 된다.

## 9. 사람 결정이 필요한 것

1. **단계 0 쿼리 실행** — (나) 결과에 따라 경로 A/B 가 갈린다. **이것부터.**
   에이전트 세션에 Production 자격증명이 없어 실행하지 못한다. 사람이 SQL Editor
   에서 돌리거나, `.env.local` 에 `PRODUCTION_SUPABASE_URL` + `PRODUCTION_SUPABASE_ANON_KEY`
   를 넣어 주면 이후로는 에이전트가 계속 조회한다.
2. **`availability_status` 마이그레이션 적용 승인** — §8. 결정 2 를 실행하려면 필요하다.
   Staging 먼저 적용하고, Production 은 단계 3 승인 시 함께.
3. **Production 쓰기 승인** — 단계 3 진입 시점. 아직 보류 상태.
