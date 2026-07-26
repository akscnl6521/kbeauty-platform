# Scenario Pilot Phase 2.2 — Staging Missing Slug Enrichment

상태: Staging 비파괴 write 완료. Production 미변경. migration 없음.

## 목적

A/B/C Top 3을 위해 missing slug 6개만 Staging에 등록·보강한다.
전체 카탈로그 확장 / D·E 보강 / main·Production 금지.

## 안전

- Staging ref: `jfnj***gfd`
- Production write: 0
- Destructive SQL / truncate / delete / schema 변경: 없음
- 가짜 INCI·가격·이미지: 없음

## Dry-run 요약

| slug | products | media | KR offer |
|------|----------|-------|----------|
| aestura-atobarrier365-cream | insert | official CDN | **in_stock** 아모레몰 더블 52,800원 |
| round-lab-dokdo-cream | insert | official CDN | out_of_stock (공식몰 품절) |
| torriden-dive-in-serum | insert | official CDN | skip (구매 불가) |
| skin1004-madagascar-centella-ampoule | insert | official CDN | skip (KR 재고 URL 미확정) |
| beauty-of-joseon-green-plum-refreshing-toner | insert | official CDN | out_of_stock (공식몰 SOLD OUT) |
| haruharu-wonder-black-rice-hyaluronic-toner | insert | official CDN | skip (KR in-stock 미확정) |

## Apply 결과 (product id)

| slug | id | media | offer |
|------|----|-------|-------|
| aestura-atobarrier365-cream | 21 | verified | verified + in_stock |
| round-lab-dokdo-cream | 22 | verified | unverified + out_of_stock |
| torriden-dive-in-serum | 23 | verified | none |
| skin1004-madagascar-centella-ampoule | 24 | verified | none |
| beauty-of-joseon-green-plum-refreshing-toner | 25 | verified | unverified + out_of_stock |
| haruharu-wonder-black-rice-hyaluronic-toner | 26 | verified | none |

추가 코드: Heartleaf ↔ `Houttuynia Cordata Flower/Leaf/Stem Water` 별칭 보강.

## phase21 Staging 재검증

`npm run verify:recommendation-scenario-phase21-staging`

- **A**: ok, final **3** (snail96, snail92, aestura)
- **B**: ok, final **3** (snail96, snail92, aestura)
- **C**: insufficient — match-ready 2 (cosrx toner, anua). BOJ/Haruharu KR `in_stock` 미확보
- **D/E**: insufficient 유지

## Rollback (비파괴)

대상 id 21–26에 대해 `active=false`, `verified_at=null` (DELETE 금지).
Offer/media는 product_id 기준으로 비활성만.

## 스크립트

- `scripts/phase22-dry-run.mjs`
- `scripts/phase22-apply-staging-missing-slugs.mjs`
- `scripts/phase22-repair-links-offers.mjs`

## 남은 작업 (C)

조선미녀 청매실 토너 또는 하루하루원더 흑미 토너의 **KR verified + in_stock** 판매 URL이 확보되면 offer만 보강하면 C Top 3 가능.
