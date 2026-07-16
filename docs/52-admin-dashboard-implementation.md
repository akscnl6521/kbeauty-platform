# docs/52-admin-dashboard-implementation.md — 관리자 대시보드 1차 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/38`, `docs/49`~`docs/51`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/dashboard.ts` | `getAdminDashboardData()` — service_role count |
| `src/app/api/admin/dashboard/route.ts` | `GET` + `withAdminAuth(ADMIN_ROLES)` |
| `src/app/admin/page.tsx` | 읽기 전용 대시보드 UI |

쓰기·migration·seed·원격 schema 변경 **없음**.

## 2. 조회 테이블 (SELECT / count만)

| 영역 | 테이블 |
|------|--------|
| catalog | `products`, `ingredients`, `product_offers`, `brands`, `product_variants` |
| verification | `product_discovery_candidates` (`workflow_status`) |
| queue | `verification_queue` (`status`) |
| quality | `ingredient_evidence`, `ingredient_cautions`, `product_ingredients` (approved), `product_offers` (verified) |
| system | `admin_users` (총계·active만) |

참고(미표시 집계 가능 대상): `ingredient_aliases`, `skin_concerns`, `data_sources`, `product_change_history`, `admin_role_history` — 1차 UI에는 미포함.

## 3. API 응답 구조

`GET /api/admin/dashboard`

```json
{
  "ok": true,
  "data": {
    "catalog": { "products": 0, "ingredients": 0, "offers": 0, "brands": 0, "variants": 0 },
    "verification": {
      "discovered": 0,
      "sale_checked": 0,
      "ingredients_checked": 0,
      "evidence_checked": 0,
      "safety_checked": 0,
      "verified": 0,
      "published": 0,
      "needs_review": 0,
      "rejected": 0
    },
    "queue": {
      "pending": 0,
      "in_review": 0,
      "approved": 0,
      "rejected": 0,
      "needs_review": 0
    },
    "quality": {
      "ingredientEvidence": 0,
      "ingredientCautions": 0,
      "verifiedProductIngredients": 0,
      "verifiedOffers": 0
    },
    "system": { "adminCount": 0, "activeAdminCount": 0 }
  }
}
```

- 숫자 하드코딩 금지 — 원격 count
- 미인증: 401 / 비관리자: 403
- 조회 실패: 503 + `DASHBOARD_UNAVAILABLE` (SQL 원문 비노출)
- user id / email / token **미반환**

## 4. UI 구성 (`/admin`)

- ADMIN 라벨 + 「관리자 대시보드」
- 현재 role · 로그아웃
- 운영 현황 / 검증 파이프라인 / 검토 큐 / 데이터 품질 / 시스템
- 빠른 이동: catalog-review(활성) · discovery/products/ingredients/verification(**준비 중**, 404 링크 없음)
- 0건·조회 실패 상태 메시지
- 기존 products 자동 published 금지 안내

## 5. 권한

허용: `admin`, `reviewer`, `researcher`, `catalog_manager`, `read_only`  
`profiles.role` 미사용. `admin_users` SSOT.

## 6. 보안

| 항목 | 상태 |
|------|------|
| browser / anon으로 대시보드 조회 | 금지 |
| service_role | 서버 전용 |
| INSERT/UPDATE/DELETE | 0 |
| 민감정보 응답 | 없음 |

## 7. 테스트

| 항목 | 기대 |
|------|------|
| `npm run build` | 성공 |
| 로그인 후 `/admin` | count 표시 |
| `GET /api/admin/dashboard` | 200 + ok |
| 로그아웃 후 API | 401 |
| DB 쓰기 | 없음 |

## 8. 구현 시점 원격 count (참고 · UI는 실시간 조회)

구현 직전 확인용 (하드코딩 아님):

| 항목 | count |
|------|-------|
| products | 186 |
| ingredients | 40 |
| product_offers | 0 |
| brands / variants / pipeline / queue | 0 |
| admin_users | 1 |
| active admins | 1 |

## 9. 다음

읽기 전용 discovery/products 목록 UI (`docs/38`) — 여전히 쓰기 금지.
