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
- Admin: `/admin/catalog/labels` — 검수 대기 필터 · Staging 적용(예상/커밋)
- Apply API: `POST /api/admin/catalog/labels/apply` (Staging gate · 시트 JSON은 Git SSOT)

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

## 히어로 확장

시트에만 있고 Staging heroes에 없는 `applyReady` 항목:

```bash
npm run catalog:labels:upsert-heroes
# 또는 원샷
npm run catalog:labels:sync
```

## Open Beauty Facts (타 브랜드)

승인된 open_data 소스 (`catalog_sources` Open Beauty Facts).  
누락 INCI heroes를 검색해 **브랜드 매칭 + INCI-형태 목록**만 수집한다.

```bash
npm run catalog:labels:obf
npm run catalog:labels   # 병합된 시트 Staging 적용
```

- 마케팅 문구·빈 ingredients 제외 (`looksLikeInciListText`)
- 공식 브랜드페이지 출처가 있으면 OBF로 덮어쓰지 않음
- 군중 데이터(tier3)이므로 메모에 재검수 필요 표기
- `product_name_en` 깨짐/마케팅 문구보다 Latin `product_name_raw` 우선 (`pickSearchProductName`)
- nameSim &lt; 0.55 또는 제형 충돌 → `applyReady=false` (Admin Labels에서 검수)

### 2026-07-15 OBF 수확 결과

| 항목 | 값 |
|------|-----|
| searched | 73 |
| harvested | 1 (Banila Clean It Zero · foam 매칭 · **미적용**) |
| Staging with_inci | 9 유지 |

## 결과 요약

| 시점 | with_inci | official_matched | heroes |
|------|-----------|------------------|--------|
| 라벨시트 1차 | 3 | 3 | 76 |
| 히어로 upsert 후 | **9** | **9** | **82** |

Production / main 미변경.

