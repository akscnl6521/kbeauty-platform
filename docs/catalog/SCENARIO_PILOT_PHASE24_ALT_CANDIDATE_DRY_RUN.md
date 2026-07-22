# Phase 2.4 Dry-Run — C 시나리오 대체 후보 최소 탐색

checked_at: 2026-07-22T20:00:00+09:00  
Staging ref: jfnj***gfd  
Decision: **STOP — write 금지** (공식 KR **in_stock** + 전조건 충족 후보 **0건**)

## C 현황 (변경 없음)

| 항목 | 값 |
|------|-----|
| verified_count | 2 (COSRX AHA/BHA, Anua Heartleaf) |
| Top N | 0 (match-evidence ≥3 필요) |
| Round Lab Dokdo | KR verified in_stock 있으나 key 교집합 부족 → match fail |
| BOJ / Haruharu | OOS·미확정 — **승격하지 않음** |
| D/E | insufficient 유지 |

C match keys: Heartleaf, Salicylic Acid, Glycolic Acid, Niacinamide, Hyaluronic Acid

## 탐색·기각 요약

| 후보 | 풀 외? | C match 예상 | 공식 KR | 재고 | 판정 |
|------|--------|--------------|---------|------|------|
| Abib 어성초 카밍 토너 200ml | Y | Heartleaf + HA | abib.com `#133` | **SOLDOUT** | 기각 |
| Isntree 그린티 프레쉬 토너 200ml | N(풀 내 incomplete) | HA | isntree.com `#177` | **품절** | 기각 |
| AXIS-Y 데일리 퓨리파잉 토너 200ml | Y | SA/GA/Heartleaf/HA | axis-y.co.kr `#45` | **Sold out** + KR INCI↔해외 INCI **불일치** | 기각 |
| Torriden 다이브인 HA 토너 300ml | Y | HA | torriden.com `goodsNo=90` | **구매 불가** | 기각 |
| Pyunkang 에센스 토너 100ml | N(풀 내) | 약함 | pyunkangyul.com `#39` | **SOLD OUT** | 기각 |
| Dr.G 레드블레미시 수딩 토너 300ml | Y | Niacinamide | dr-g.co.kr `/item/4242` | 재입고 알림 문구 → **in_stock 미확정/OOS 정황** | 기각(재고) |

일반 마켓(무신사·다나와·스트로베리넷) 단독 출처는 verified 금지로 사용하지 않음.

## 충족 후보 (write 가능)

**없음 (0)**

→ Staging write 계획 **제시하지 않음**.  
→ Production / migration / BOJ·Haruharu 상태 변경 **없음**.

## 재시도 우선순위 (재고 회복 시)

1. **Dr.G Red Blemish Clear Soothing Toner 300ml** — 풀 외, Niacinamide, 저자극 진정, 공식 INCI 확보됨. 공식몰 **구매 가능(in_stock)** 확인 시 1순위.
2. **AXIS-Y Daily Purifying Treatment Toner 200ml** — C fit 최상이나, 공식몰 재고 + **KR 전성분 페이지 정합성** 선해결 필수.
3. **Torriden Dive-In Low Molecular HA Toner 300ml** — HA match, 공식 전성분 확보. `구매 불가` 해제 시.

## Rollback

write 0 → 해당 없음
