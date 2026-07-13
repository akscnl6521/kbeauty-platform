# docs/60-admin-verification-detail-readonly.md — 관리자 검증 큐 상세 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **구현 완료**  
관련: `docs/59`

---

## 1. 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/verification-detail.ts` | `getAdminVerificationDetail` |
| `src/app/api/admin/verification/[id]/route.ts` | GET 상세 |
| `src/app/admin/verification/[id]/page.tsx` | 읽기 전용 UI |

## 2. 연결 규칙 (존재하는 FK/테이블만)

| entity_type | 조회 테이블 | 관리 링크 |
|-------------|-------------|-----------|
| candidate | product_discovery_candidates | `/admin/discovery/[id]` |
| product | products | `/admin/products/[id]` |
| ingredient | ingredients | `/admin/ingredients/[id]` |
| offer | product_offers | 제품 상세 |
| variant | product_variants | 제품 상세 |
| brand | brands | (전용 페이지 없음) |
| evidence | ingredient_evidence | 성분 상세 |

entity_id 형식 불일치·행 없음 → `linked.found=false`.

## 3. 보안

- `assigned_to` 원문 비노출
- https URL만 활성 링크
- 승인·반려·상태변경 버튼 **생성 금지**
- SELECT only

## 4. API

- `GET /api/admin/verification/[id]`
- 미인증 401 · 잘못된 uuid 400 · 없음 404
