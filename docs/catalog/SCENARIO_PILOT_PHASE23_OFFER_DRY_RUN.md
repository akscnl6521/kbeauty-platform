# Phase 2.3 Dry-Run — C시나리오 KR verified in_stock offer 보강

checked_at: 2026-07-22T10:40:00+09:00  
Staging ref: jfnj***gfd  
Production write: 0  
Decision: **STOP — write 금지** (공식 KR verified + in_stock 충족 후보 0건)

## 대상 제품 (Staging SELECT)

| slug | product_id | 기존 offer |
|------|------------|------------|
| beauty-of-joseon-green-plum-refreshing-toner | 25 | 1건: 공식몰 18,000 KRW / out_of_stock / unverified |
| haruharu-wonder-black-rice-hyaluronic-toner | 26 | 0건 |

## BOJ offer 후보

| 항목 | 값 |
|------|-----|
| KR SKU / 제품명 | 청매실 AHA BHA 토너 (Green Plum Refreshing Toner AHA+BHA) |
| 용량 | 150ml |
| 리뉴얼 | 미확인 변경 없음 (동일 PDP) |
| 출처 | 공식 브랜드 KR 몰 `https://beautyofjoseon.co.kr/product/.../31/` |
| 판매자 | 조선미녀 공식몰 (주식회사구다이글로벌) |
| 가격 | 18,000 KRW (페이지 표시가, 추정 없음) |
| 재고 | **SOLD OUT** (live 재확인) |
| 공식 여부 | 공식 브랜드 KR 몰 = 우선순위 1 |
| verified+in_stock 충족 | **아니오** |
| 중복 | 기존 offer `13fe02a6-…` 와 동일 URL·가격·OOS — update로 in_stock 승격 **금지** |
| 기타 출처 | 이마트몰/NS/다나와 등 = 일반 판매자 단독 → verified **금지** |

## Haruharu offer 후보

| 항목 | 값 |
|------|-----|
| Pool identity | Black Rice Hyaluronic Toner (INCI에 Lavender Oil) / 이미지 150ml |
| KR 무향 150ml `#517` | 공식몰 19,000/20,000 KRW — **SOLD OUT** + **무향=별 SKU** → 연결 금지 |
| EN 일반 150ml `#519` | `en.haruharu.com/.../519/` — identity 일치 후보이나 **SOLD OUT** + KRW 아님 |
| KR 일반 150ml PDP | 카테고리/검색에 노출되나, 확인한 SEO URL(`...토너-150ml/{n}`)은 다수 404. **in_stock 공식 KR PDP 미확정** |
| 300ml / 세트 | 용량 혼합 금지; 확인된 세트 `#563`도 SOLD OUT |
| Staging offer | 없음 |
| verified+in_stock 충족 | **아니오** |

## 충족 판정

- verified + in_stock 조건을 충족하는 제품: **0**
- insert/update 예정: **없음**
- C 최종 verified_count 예상: **2 유지** (Top 0 유지)
- A/B/D/E: write 없음 → 회귀 없음

## Rollback

write 0건이므로 rollback 불필요.  
(만약 이후 write 시) Staging `product_offers` 해당 row의 `verification_status`/`stock_status`를 이전 스냅샷으로 되돌리거나 신규 insert row만 `active=false`.

## 금지 준수

- OOS→in_stock 임의 변경 안 함
- 가격 추정 안 함
- 일반 판매자 단독 verified 안 함
- 무향/300ml/지역 SKU 혼합 안 함
- D/E·Production·migration·delete 안 함
