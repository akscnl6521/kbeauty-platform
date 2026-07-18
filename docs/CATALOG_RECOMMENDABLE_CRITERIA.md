# CATALOG_RECOMMENDABLE_CRITERIA.md — 추천 가능 제품 SSOT

최종 갱신: 2026-07-18  
코드 SSOT: `src/lib/catalog/recommendableCriteria.ts`  
공개 Top5: `src/lib/pipeline/product-verify/recommendation-eligibility.ts` + `isOfferEligibleForCoreRecommendation`

---

## 원칙

1. **자동 `verified_at` 부여 금지**
2. 공식 출처 없는 전성분·효능·판매처 **생성 금지**
3. 리테일러 INCI를 공식 INCI처럼 **적용 금지**
4. Soft/Airy · shade · SKU 등 **variant 엄격 구분**
5. 숫자 목표를 위해 **게이트 완화 금지**

---

## Staging → recommendable 후보 풀

`evaluateStagingRecommendable()`

| 조건 | 실패 버킷 |
|------|-----------|
| 공식 INCI BLOCKED (verbatim 없음) | `BLOCKED` |
| 공식 출처 충돌 | `SOURCE_CONFLICT` |
| variant/shade 불일치 | `VARIANT_MISMATCH` |
| 중복 의심 | `DUPLICATE_SUSPECT` |
| rejected / discontinued | `BLOCKED` |
| INCI 상태 부족 | `MISSING_OFFICIAL_INCI` |
| 이미지 invalid / primary 없음 | `IMAGE_INVALID` |
| KR offer 후보 불명확 | `OFFER_INVALID` |
| needs_review / draftish | `READY_FOR_REVIEW` |
| 위 통과 + 필드 완비 | `READY_TO_RECOMMEND` |

최소 긍정 조건:

- 한국 화장품 후보 · 활성/비거절
- 자동 draft가 아님 (검수 후)
- 전성분 또는 검증된 주요 성분 근거 (`raw_collected` 이상)
- 피부 고민 매칭은 추천 엔진 단계에서 추가 검증
- 안전 필터는 기존 recommend 파이프라인 유지
- 유효 이미지 또는 명시적 missing
- 한국 판매처/공식몰 상태 명확
- 공식 출처 불명확 시 추천 제외

---

## 공개 코어 추천 (Top5)

`evaluatePublicCoreRecommendable()` → `evaluateRecommendationEligibility`

- `active === true`
- `verified_at` 존재 (자동 부여 아님)
- 승인된 구조화 성분 최소 건수
- KR 적격 offer (`isOfferEligibleForCoreRecommendation`)
- draft / review pending → **비공개** (PDP `notFound()`)

---

## 이미지 휴리스틱

`isTinyPlaceholderImage(contentLength)` — `contentLength > 0 && < 1000` → invalid

---

## 검수 버킷

`READY_FOR_REVIEW` · `MISSING_OFFICIAL_INCI` · `IMAGE_INVALID` · `OFFER_INVALID` · `DUPLICATE_SUSPECT` · `VARIANT_MISMATCH` · `SOURCE_CONFLICT` · `READY_TO_RECOMMEND` · `BLOCKED`

관리자 큐: `/admin/catalog/automation-queue`  
대량 Verified 승인 UI 없음.

---

## 테스트

```bash
npm run test:recommendable
```
