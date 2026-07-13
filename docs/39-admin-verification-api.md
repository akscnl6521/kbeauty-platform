# docs/39-admin-verification-api.md — 관리자 검증 API 설계

최종 갱신: 2026-07-13  
상태: **설계 전용**  
관련: `docs/38`, `docs/40`, `docs/41`, `docs/42`

---

## 0. 전제

- 모든 `/api/admin/*`는 **서버 Route Handler** (`runtime = "nodejs"`)
- 브라우저에 `service_role` 키 노출 금지
- 관리자 인증·role 확인 **전** 조회/수정 금지
- 현재 코드: admin API **없음**, Zod **없음**, service_role client **없음**
- Validation: 도입 시 Zod 권장. 당분간은 `/api/analyze`식 수동 파서도 허용하되 스키마를 문서화

---

## 1. 공통 보안

| 항목 | 규칙 |
|------|------|
| 인증 | 세션/쿠키 기반 관리자 신원 확인 (선행 과제) |
| 권한 | role 매트릭스 (`docs/41`) |
| DB | 서버 전용 Supabase client (`SUPABASE_SERVICE_ROLE_KEY` env, 서버만) |
| Body 크기 | JSON 상한 (예: 256KB). 이미지 업로드 비대상 |
| URL | HTTPS만, 사설 IP/javascript: 거부 |
| 상태값 | CHECK enum과 동일한 allow-list |
| 전환 | `docs/40` 허용 그래프만 |
| 충돌 | `updated_at` If-Match 또는 body `expectedUpdatedAt` |
| 감사 | 모든 쓰기 → `product_change_history` (+ queue 완료 시 reviewer_notes) |
| 오류 | 표준 JSON. DB 원문 비노출 |
| CSRF | SameSite=Lax/Strict 쿠키 + Origin 검사 검토 |
| Rate limit | 쓰기 API IP/유저당 제한 검토 |

### 공통 응답 envelope

```json
{
  "ok": true,
  "data": {}
}
```

오류:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "관리자 권한이 없습니다."
  }
}
```

### 오류 코드

| code | HTTP | 의미 |
|------|------|------|
| UNAUTHORIZED | 401 | 미인증 |
| FORBIDDEN | 403 | role 부족 |
| NOT_FOUND | 404 | 대상 없음 |
| VALIDATION_ERROR | 400 | body/query 형식 |
| INVALID_TRANSITION | 422 | 상태 전환 금지 |
| PUBLISH_GATE_FAILED | 422 | published 필수 조건 실패 |
| CONFLICT | 409 | updated_at 충돌 |
| DUPLICATE_UNRESOLVED | 422 | 중복 미해결 |
| RATE_LIMITED | 429 | 제한 |
| INTERNAL_ERROR | 500 | 내부 |

---

## 2. 읽기 API

모든 GET: 인증 필수. `read_only` 이상.

| Method | Path | 목적 | 주요 테이블 |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | 집계 위젯 | candidates, queue, history, offers |
| GET | `/api/admin/discovery` | 목록·필터 | product_discovery_candidates |
| GET | `/api/admin/discovery/[id]` | 상세+연관 | candidates + offers/ingredients/queue |
| GET | `/api/admin/products` | 제품 목록 | products + 집계 |
| GET | `/api/admin/products/[id]` | 제품 상세 | products, variants, offers, … |
| GET | `/api/admin/ingredients` | 성분 목록 | ingredients + 집계 |
| GET | `/api/admin/ingredients/[id]` | 성분 상세 | aliases, evidence, cautions |
| GET | `/api/admin/evidence` | 근거 목록 | ingredient_evidence |
| GET | `/api/admin/verification` | 큐 목록 | verification_queue |
| GET | `/api/admin/sources` | 출처 | data_sources |
| GET | `/api/admin/history` | 변경 이력 | product_change_history |

### Query 공통
- `page`, `pageSize` (상한 100)
- `q` 검색
- 상태/국가 필터는 각 리소스별 allow-list

### GET `/api/admin/discovery` 예시 응답 필드
`id, discovered_name, discovered_brand, discovered_url, discovered_country, source_type, workflow_status, sale_check_status, ingredient_check_status, evidence_check_status, safety_check_status, duplicate_check_status, linked_product_id, assigned_to, discovered_at, updated_at`

---

## 3. 쓰기 API

| Method | Path | 목적 | 최소 role |
|--------|------|------|-----------|
| POST | `/api/admin/discovery` | 후보 생성 | catalog_manager |
| PATCH | `/api/admin/discovery/[id]` | 기본 필드·notes·담당 | catalog_manager |
| POST | `/api/admin/discovery/[id]/sale-check` | 판매 확인 → sale_checked | catalog_manager |
| POST | `/api/admin/discovery/[id]/link-product` | 기존/신규 매핑·중복 | catalog_manager |
| POST | `/api/admin/discovery/[id]/ingredients` | 전성분 저장 → ingredients_checked | catalog_manager |
| POST | `/api/admin/discovery/[id]/evidence` | 근거 연결 → evidence_checked | researcher |
| POST | `/api/admin/discovery/[id]/safety-review` | 안전 → safety_checked | reviewer |
| POST | `/api/admin/discovery/[id]/submit-review` | queue 등록 | catalog_manager |
| POST | `/api/admin/discovery/[id]/approve` | → verified | reviewer |
| POST | `/api/admin/discovery/[id]/reject` | → rejected / needs_review | reviewer |
| POST | `/api/admin/discovery/[id]/publish` | → published | admin (또는 정책상 reviewer+admin dual) |
| POST | `/api/admin/verification/[id]/assign` | 담당 지정 | reviewer |
| POST | `/api/admin/verification/[id]/complete` | 큐 완료 | reviewer |

---

## 4. 요청 body 스케치

### POST `/api/admin/discovery`

```json
{
  "discovered_name": "string",
  "discovered_brand": "string|null",
  "discovered_url": "https://...|null",
  "discovered_country": "KR|US|JP|null",
  "source_type": "search_result|official_retailer|...",
  "search_query": "string|null",
  "notes": "string|null"
}
```

규칙: 이름 필수. URL 있으면 HTTPS. **가격/재고/논문 가짜값 금지** — 이 단계에서 offer/evidence 생성 안 함.  
초기: `workflow_status=discovered`, 모든 `*_check_status=pending`.

### POST `…/sale-check`

```json
{
  "expectedUpdatedAt": "ISO",
  "pass": true,
  "purchaseUrl": "https://...",
  "retailerName": "string",
  "retailerCountry": "KR",
  "shipsToCountries": ["KR"],
  "price": 23000,
  "currency": "KRW",
  "stockStatus": "in_stock",
  "isOfficial": true,
  "checkedAt": "ISO",
  "notes": "string|null"
}
```

서버:
1. 전환 가능 여부 (`discovered` 또는 `needs_review` 복귀 경로)
2. URL·가격·재고 실측 필드 검증 (null/unknown이면 pass=false만 허용)
3. `product_offers` 초안 upsert 가능 — 기본 `verification_status=unverified` 유지 가능, pass 시 운영 정책에 따라 `verified`로 올릴지는 **별도 명시적 플래그**로만
4. `sale_check_status=pass`, `workflow_status=sale_checked`
5. history 기록

**검색 노출만으로 pass=true 거부.**

### POST `…/link-product`

```json
{
  "expectedUpdatedAt": "ISO",
  "mode": "link_existing|mark_new_needed",
  "linkedProductId": 4,
  "duplicateCandidates": [4, 28],
  "duplicateCheckStatus": "pass|fail|pending",
  "notes": "string|null"
}
```

- `link_existing`: products.id 존재 확인, `linked_product_id` 설정  
- 신규 products INSERT는 **별도 승인 플로우** (이 API에서 즉시 대량 생성 금지). `mark_new_needed`는 notes/queue만.  
- 기존 186 자동 published 금지.

### POST `…/ingredients`

```json
{
  "expectedUpdatedAt": "ISO",
  "productId": 4,
  "variantId": null,
  "sourceUrl": "https://...",
  "sourceType": "official_brand_page|official_label|official_retailer",
  "items": [
    {
      "ingredientOrder": 1,
      "ingredientId": 10,
      "aliasText": "string|null",
      "isKeyIngredient": false,
      "declaredConcentration": null,
      "concentrationUnit": null,
      "concentrationDisclosed": false
    }
  ]
}
```

서버: 공식 source_type만 ingredients_checked 전진 허용. 행은 기본 `verification_status=pending` → 승인 단계에서 approved.  
승인 전 `approved` 대량 자동 세팅 금지.

### POST `…/evidence`

근거 행 ID 연결 또는 초안 생성(researcher). PMID/DOI/URL 중 하나 이상. 가짜 논문 금지.  
전진 조건: 핵심 성분에 대한 evidence_check 정책 (`docs/33`, `docs/40`).

### POST `…/safety-review`

```json
{
  "expectedUpdatedAt": "ISO",
  "pass": true,
  "unresolvedHighSeverityCautionIds": [],
  "medicalReferralRequired": false,
  "notes": "string|null"
}
```

`medicalReferralRequired=true`이면 publish 게이트 실패 또는 추천 엔진에서 피부과 안내 우선 플래그.

### POST `…/submit-review`

`verification_queue` INSERT (`entity_type=candidate`, `review_type=publish` 등).

### POST `…/approve` → verified

선행 workflow=`safety_checked`, 열린 high caution 없음, duplicate pass, queue in_review 가능.  
**published 아님.**

### POST `…/reject`

```json
{ "expectedUpdatedAt": "ISO", "mode": "rejected|needs_review", "reason": "string" }
```

### POST `…/publish`

Body 최소:

```json
{
  "expectedUpdatedAt": "ISO",
  "idempotencyKey": "uuid",
  "confirm": true
}
```

서버는 `docs/42` 트랜잭션·15항 게이트 수행.  
부분 성공 금지.

### POST `/api/admin/verification/[id]/assign`

```json
{ "assignedTo": "string" }
```

### POST `/api/admin/verification/[id]/complete`

```json
{
  "status": "approved|rejected|needs_review",
  "reviewerNotes": "string|null"
}
```

---

## 5. 트랜잭션 경계

| API | 트랜잭션 |
|-----|----------|
| sale-check | offer upsert + candidate update + history |
| ingredients | product_ingredients upsert + candidate + history |
| publish | **단일 트랜잭션/RPC** (`docs/42`) |
| reject/approve | candidate + queue + history |

실패 시 전체 롤백. 클라이언트에 “일부만 저장됨” 상태 남기지 않음.

---

## 6. 감사 로그

모든 쓰기 성공 시 `product_change_history`:
- `change_type`: name | ingredients | price | status | source | offer | other
- `old_value` / `new_value` jsonb
- `source_url`, `approved_by`, `detected_at=now()`, `reviewed_at` (승인 시)

candidate-only 변경도 `product_id=linked_product_id` 가능 시 채움. 미연결이면 `product_id=null`, new_value에 `candidateId` 포함.

---

## 7. 네이밍·충돌

| 기존 | 충돌 |
|------|------|
| `/api/analyze` | 없음 |
| `/admin/catalog-review` | 페이지만. API 경로 `/api/admin/*`와 분리 |

신규 파일 예상 위치: `src/app/api/admin/**/route.ts` (구현 단계).

---

## 8. 구현 금지 (현재 단계)

- route 파일 생성
- service_role 키 커밋
- seed / 제품 INSERT
- Supabase RPC 실제 배포
