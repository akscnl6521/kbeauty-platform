# docs/11-product-retailer-offer.md — Product / Offer 데이터 분리

최종 갱신: 2026-07-13  
상위 문서: `MASTER_PLAN.md`, `docs/20-data-source-verification.md`

---

## 1. 목적

제품 자체와 판매 정보를 분리해, 검증·재고·가격·링크를 독립적으로 관리한다.

---

## 2. 엔티티 분리

| 엔티티 | 역할 | 예시 |
|--------|------|------|
| **Product** | 제품 자체 | COSRX Advanced Snail 96 Mucin Power Essence |
| **ProductVariant** | 용량·국가·리뉴얼 버전 | 100ml / KR / 리뉴얼 |
| **ProductOffer** | 판매처·가격·재고·구매 링크 | COSRX 공식몰, 23,000 KRW |
| **ProductIngredient** | 전체 전성분 | INCI 표준화 목록 |
| **IngredientEvidence** | 성분별 논문 근거 | PMID, 연구 유형, 근거 수준 |

제품 등록 시 위 분리를 반드시 유지한다.

---

## 3. ProductOffer 검증 필드 (개념)

한국 핵심 추천에 쓰기 위한 offer 조건:

- `retailerCountry === "KR"`
- `shipsToCountries`에 `"KR"`
- `currency === "KRW"`
- `price > 0`
- `stockStatus === "in_stock"`
- `verificationStatus === "verified"`
- `purchaseUrl` HTTPS
- `verifiedAt` 존재
- `active !== false`

`unverified` / `stock unknown`은 관리자 검토용이며 핵심 추천에 넣지 않는다.

원격 테이블 `product_offers`는 migration `20260713022607`로 적용됨.  
클라이언트 SELECT는 RLS로 verified + in_stock + active만 허용.

---

## 4. 판매 가능 판단 (페이지 확인)

- 실제 상품 상세 페이지 존재  
- HTTPS URL  
- 공식 또는 신뢰 판매처  
- 가격 표시  
- 구매 버튼 존재  
- 품절 아님  
- 배송 국가 가능  
- 최근 확인일 존재  

검색 노출만으로 재고를 단정하지 않는다.

---

## 5. 이중 저장

| 저장소 | 내용 |
|--------|------|
| GitHub | 카탈로그 JSON/CSV 원본, migration, 백업 |
| Supabase | 운영 Product / Offer / Ingredient / Evidence |

한쪽만 반영된 상태는 완료가 아니다. Supabase 쓰기는 사용자 승인 필수.

---

## 6. 현재 Sprint 14 사례

- 로컬 COSRX 3제품·3offer (`data/catalog/kr/`)
- 상태: 검증 대기 (`unverified` / `unknown`)
- 다음: Search-to-Verified-Product Pipeline으로 검증 후 `published` 전환
