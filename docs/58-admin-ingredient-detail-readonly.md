# docs/58-admin-ingredient-detail-readonly.md — 관리자 성분 상세 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **구현 완료**  
관련: `docs/57`

---

## 1. 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/ingredient-detail.ts` | `getAdminIngredientDetail` |
| `src/app/api/admin/ingredients/[id]/route.ts` | GET 상세 |
| `src/app/admin/ingredients/[id]/page.tsx` | 읽기 전용 UI |

쓰기·승인·검증 버튼 **없음**.

## 2. 원격 스키마 기준

- `ingredients`: active/verified_at **없음** → `ingredientVerified` 항상 false
- aliases / evidence / cautions / product_ingredients: SELECT only
- evidence `reviewed_by` **비노출** (`isReviewed`만)
- paper_* / evidence `source_url`: https만 활성 링크

## 3. 상태 구분

| 개념 | 의미 |
|------|------|
| ingredient verified | ingredients.verified_at 없음 → 항상 unverified |
| hasEvidence | ingredient_evidence 행 존재 |
| approvedEvidenceCount | review_status=approved 건수 |

evidence 존재 ≠ ingredient verified.

## 4. API

- `GET /api/admin/ingredients/[id]`
- 미인증 401 · 잘못된 id 400 · 없음 404
- 내부 DB 오류 원문 비노출

## 5. UI 섹션

기본 정보 · 상태 요약 · 레거시 효과/기전 · 논문 · aliases · evidence · cautions · 연결 제품
