# docs/53-admin-products-readonly.md — 관리자 제품 목록 1차 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/31`, `docs/38`, `docs/52`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/products.ts` | `getAdminProducts` — SELECT/count |
| `src/app/api/admin/products/route.ts` | `GET` + `withAdminAuth(ADMIN_ROLES)` |
| `src/app/admin/products/page.tsx` | 읽기 전용 목록 UI |
| `src/app/admin/page.tsx` | Products 빠른 이동 활성화 |

쓰기·migration·seed·원격 schema 변경 **없음**.

## 2. 원격 products 구조 (재확인)

| 컬럼 | 타입 | nullable |
|------|------|----------|
| id | bigint | NO |
| name | text | NO |
| brand | text | NO |
| category | text | YES |
| skin_concern / skin_tone | ARRAY | YES |
| key_ingredients / full_ingredients | ARRAY | YES |
| slug | text | YES |
| verified_at | timestamptz | YES |
| data_confidence | text | YES |
| active | boolean | YES (default true) |
| price_usd / link_* | legacy | YES |
| created_at | timestamp | YES |

`updated_at` / `pipeline_status` **없음** — 추측 사용 금지.

`product_offers`: `product_id bigint` FK, 현재 **0행** (정상).  
`brands` / `product_variants`: 0행, products와 직접 FK 연결 없음.

## 3. 조회 구조

`getAdminProducts(params)`:

- page 기본 1, pageSize 기본 20 (최대 100)
- search: `name` / `brand` / `slug` ilike OR
- brand / category exact
- active: true|false
- verified: `verified_at` IS NOT NULL | IS NULL
- sort: `id_desc`(기본), `id_asc`, `name_asc`, `name_desc`, `verified_desc`
- offer count: 현재 페이지 product_id에 대해 `product_offers` 1회 `.in()` (N+1 방지)

item: id, name, slug, brand, category, active, verifiedAt, dataConfidence, key/full ingredient counts, offerCount, verifiedOfferCount

## 4. API

`GET /api/admin/products?...`

```json
{
  "ok": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 186, "totalPages": 10 },
    "filters": { "search": "", "brand": "", "…": "", "brands": [], "categories": [] }
  }
}
```

미인증 401 · 비관리자 403 · 실패 503 (`PRODUCTS_UNAVAILABLE`)

## 5. UI

`/admin/products` — GET form 필터, 테이블, 페이지 이전/다음, 대시보드 링크  
상세 `/admin/products/[id]` **미구현** → 링크 없음 («상세 준비 중»)

## 6. 권한 / 보안

전 관리자 역할 조회 가능 (`read_only` 포함).  
service_role 서버 전용 · SELECT만 · profiles.role 미사용 · UID/이메일 비반환

## 7. 테스트

| 항목 | 기대 |
|------|------|
| build | 성공 |
| 총계 | 186 (원격) |
| pageSize | 20 |
| offer | 전원 0 정상 |
| API 로그아웃 | 401 |

## 8. 다음

읽기 전용 `/admin/products/[id]` 상세 (offers·성분 배열 표시, 쓰기 금지).
