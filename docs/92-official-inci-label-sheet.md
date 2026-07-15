# docs/92-official-inci-label-sheet.md — 공식 전성분 라벨시트 채널

최종 갱신: 2026-07-15

## 목적

공개 HTML/JSON-LD만으로는 전성분을 거의 확보하지 못한다.  
이 채널은 **공식 페이지·라벨에서 사람이 복사한 INCI만** Staging에 반영한다.  
추측·AI 합성·부분 리스트 패딩은 금지한다.

## 데이터

- 시트: `data/catalog/labels/official-inci-sheet.v1.json`
- 빌드: `npm run catalog:labels:build` (COSRX seed CSV + Staging snail-96 스냅샷)
- 적용: `npm run catalog:labels` (Staging linked only)
- 검증: `npm run test:labels`
- Admin 읽기: `/admin/catalog/labels`

## 규칙

1. `applyReady=true` 이려면 `sourceUrl`(https) + `labelCheckedAt` + 성분 ≥3 필수
2. 빈 성분 / invent → 적용 거부
3. Staging에 `product_attributes.fullIngredients`가 이미 있으면 기본 skip (`--force`만 덮어씀)
4. Production / main 미사용

## Staging 반영 필드

- `product_attributes.fullIngredients` / `keyIngredients` / `curatedLabelSource`
- `ingredients_status = raw_collected`
- `evidence_ingredient_slugs` (정확 매칭만)
- `catalog_staging_ingredients` 행 INSERT

## 2026-07-15 1차 결과

| 항목 | 값 |
|------|-----|
| 시트 entries | 11 |
| applyReady | 9 |
| Staging 적용 | **3** (snail 96/92, retinol 0.1) |
| skippedMissing | 6 (heroes에 없는 seed SKU) |
| with_inci | **3** |
| Production | 미변경 |
