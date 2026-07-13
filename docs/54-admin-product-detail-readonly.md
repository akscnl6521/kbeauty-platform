# docs/54-admin-product-detail-readonly.md — 관리자 제품 상세 1차 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/53`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/product-detail.ts` | `getAdminProductDetail` |
| `src/app/api/admin/products/[id]/route.ts` | GET 상세 API |
| `src/app/admin/products/[id]/page.tsx` | 상세 UI |
| `src/app/admin/products/page.tsx` | ID/제품명 → 상세 링크 |

쓰기·migration·원격 schema 변경 **없음**.

## 2. 원격 상세 스키마 (재확인)

### products
기존 목록과 동일 + `skin_concern`, `skin_tone`, `recommendation_reason`, `fragrance_free`, `alcohol_free`, `texture`, `usage_area`, legacy `price_usd` / `link_*` / `where_to_find_*`.  
`updated_at` / `pipeline_status` **없음**.

### product_ingredients
`verification_status` (review_status 아님), `ingredient_order`, `source_type`, `source_url`, `verified_at`.  
현재 **0행**.

### ingredients
`id`, `slug`, `name_en`, `name_ko` ( `name` 컬럼 없음 ).

### product_offers / product_variants
현재 **0행** (정상).

## 3. 상태 계산

| 플래그 | 조건 |
|--------|------|
| productVerified | `products.verified_at` 존재 |
| structuredIngredientsComplete | approved + verified_at + 공식 source_type + source_url 인 구조화 성분 ≥1 |
| hasVerifiedOffer | active + verification_status=verified + stock_status=in_stock + verified_at + https URL |
| recommendationEligible | active ∧ productVerified ∧ structuredIngredientsComplete ∧ hasVerifiedOffer |

레거시 `price_usd` / `link_*` 만으로 eligible **금지**.  
현재 offers=0 → 대부분 `recommendationEligible=false`가 정상.

## 4. API

`GET /api/admin/products/[id]`

- 잘못된 id → 400
- 없음 → 404
- 미인증 → 401
- 성공 → `{ ok, data: { product, variants, ingredients, offers, statusSummary } }`

## 5. UI / 레거시 / URL

- 섹션: 기본 · 검증 · 특성 · 성분 · 판매처 · 레거시 · variant
- 구조화 0건 → 「미구조화」 명시
- offers 0 → 「검증된 판매처 없음」
- https만 「판매처 열기」 (`target=_blank` `rel=noopener noreferrer`)
- http/javascript/data/빈값 → 클릭 금지
- 수정/저장/publish 버튼 없음

## 6. 다음

읽기 전용 ingredients 목록 또는 discovery 목록 (`docs/38`).
