# docs/59-admin-verification-readonly.md — 관리자 검증 큐 목록 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **구현 완료**  
관련: `docs/60`

---

## 1. 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/verification.ts` | `getAdminVerificationQueue` |
| `src/app/api/admin/verification/route.ts` | GET 목록 |
| `src/app/admin/verification/page.tsx` | 읽기 전용 UI |

## 2. 원격 스키마 `verification_queue`

| 컬럼 | 비고 |
|------|------|
| id | uuid |
| entity_type | candidate/product/offer/ingredient/evidence/variant/brand |
| entity_id | text |
| review_type | sale/ingredients/evidence/safety/publish/duplicate/other |
| priority | integer |
| status | pending/in_review/approved/rejected/needs_review |
| assigned_to | **원문 비노출** → `isAssigned`만 |
| reason, reviewer_notes | 검색 가능 |
| created_at, reviewed_at | |

현재 원격 행 수: **0** (빈 목록 정상 · seed 금지).

## 3. 필터

entityType · reviewType · status · assigned · search(entity_id/reason/notes) · sort · page

## 4. API / UI

- `GET /api/admin/verification`
- `/admin/verification`
- 승인·반려·상태변경 **없음**
