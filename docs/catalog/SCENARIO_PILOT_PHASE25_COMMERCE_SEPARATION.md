# Phase 2.5 — recommendation_ready ↔ commerce availability 분리

날짜: 2026-07-22  
범위: 로컬 코드·테스트·문서만 (DB write 0, migration 적용 0, Production 0)

## 문제

C 시나리오에서 BOJ/Haruharu는 성분·match evidence가 있어도  
공식 KR offer가 일시 품절/미확정이면 `isOfferEligibleForCoreRecommendation`의 `in_stock` 게이트에 걸려  
Organic Top이 꺼졌다 (`verified_count=2`, Top 0).

K-Beauty Match는 쇼핑몰이 아니라 피부 관리 추천 플랫폼이므로  
**추천 자격**과 **구매 가능 상태**를 분리한다.

## Dry-run 결과 (구현 전 고정)

### 변경 readiness gate

| Gate | 용도 | `in_stock` |
|------|------|------------|
| `isOfferEligibleForRecommendation` | Organic 랭킹 풀 | **불필요** (OOS/unknown 허용) |
| `isOfferEligibleForCoreRecommendation` / `isOfferPurchasableForCta` | 구매 CTA | **필수** (기존 KR 규칙 유지) |
| `filterCandidatesByOfferAvailability` | 후보 필터 | separation ON 시 ranking gate + offer 없음(`availability_unknown`) 허용 |

공식 KR OOS + unverified(sale-checked)도 랭킹 풀 유지.  
점수에 재고·affiliate/ad 가산 없음.

### Commerce 상태 모델

런타임 파생 (`src/lib/recommend/commerceStatus.ts`), 기존 `product_offers.stock_status` 활용:

- `in_stock` | `out_of_stock` | `availability_unknown` | `discontinued` | `region_unavailable`
- 필드: `commerce_status`, `seller`, `official_seller`, `price`, `currency`, `offer_url`, `checked_at`

### DRAFT migration

**불필요.** 새 컬럼 없이 offer에서 파생.  
(적용 금지 — 이번 단계 write 0)

### Feature flag rollback

`RECOMMEND_COMMERCE_SEPARATION` 기본 `1`.  
`0` / `false` / `off` → 레거시 KR `in_stock` 랭킹 게이트.

### C 재판정 (evidence 기준, DB 변경 없음)

| 제품 | recommendation_ready | commerce_status | 비고 |
|------|---------------------|-----------------|------|
| beauty-of-joseon-green-plum-refreshing-toner | 유지 | `out_of_stock` | 공식 KR identity/INCI 확정, 기존 OOS offer 보존 |
| haruharu-wonder-black-rice-hyaluronic-toner | 유지 (scented pool = Lavender) | `availability_unknown` | 무향(#517) 혼합 금지; KR offer 없음 |

### 예상 Top 3 (C, match evidence 통과 시)

1. cosrx-aha-bha-clarifying-treatment-toner (in_stock CTA 가능)
2. anua-heartleaf-77-soothing-toner (in_stock CTA 가능)
3. beauty-of-joseon-green-plum-refreshing-toner **또는** haruharu… (OOS / unknown, CTA 비활성)

Round Lab Dokdo는 match keys 약하면 Top 제외 가능 (기존과 동일).

### UI 변경 범위

`RecommendedProductCard` (`/results`):

- 추천 적합 · 구매 상태 라벨
- 현재 구매 가능 / 품절 / 판매 상태 확인 중
- 공식 판매처 확인 시각
- 품절·미확정 시 구매 CTA 비활성 + 안내 문구

### 캐시

`RECOMMENDATION_CACHE_VERSION` → `KR_SCENARIO_PILOT_PHASE25_COMMERCE_SEP_V1`  
(기존 Care snapshot 키 구조 유지, 버전만 상향)

## 안전

- Staging/Production DB write 금지
- OOS → in_stock 변경 금지
- 가짜 가격·재고 금지
- main/master 금지
