# docs/55-admin-discovery-readonly.md — 관리자 discovery 목록 1차 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/38`, `docs/52`~`docs/54`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/discovery.ts` | `getAdminDiscoveryCandidates` |
| `src/app/api/admin/discovery/route.ts` | GET 목록 API |
| `src/app/admin/discovery/page.tsx` | 읽기 전용 UI |
| `src/app/admin/page.tsx` | Discovery 링크 활성화 |

쓰기·상태 변경·seed·migration·원격 schema 변경 **없음**.

## 2. 원격 스키마 (재확인)

### product_discovery_candidates
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | |
| discovered_name | text NOT NULL | 검색 대상 |
| discovered_brand | text | 검색 대상 |
| discovered_url | text | 검색 대상 · https만 외부 링크 |
| discovered_country | text | |
| source_type | text | CHECK 허용 목록 |
| workflow_status | text | discovered…needs_review |
| duplicate_check_status | pending/pass/fail | |
| linked_product_id | bigint FK → products | |
| assigned_to | text | **원문 미반환** (isAssigned만) |
| created_at / updated_at | timestamptz | |

### verification_queue
- entity_type=`candidate`, entity_id=후보 uuid 문자열
- open = status ∈ pending / in_review / needs_review
- 현재 **0행**

현재 discovery 후보 **0건**이 정상.

## 3. 필터 / 정렬

- search, workflowStatus, country, sourceType, linked, assigned
- sort: newest(기본), oldest, name_*, status_*
- pageSize 기본 20, 최대 100

## 4. API

`GET /api/admin/discovery` → `{ ok, data: { items, pagination, filters } }`  
미인증 401 · 전 관리자 역할 허용

## 5. UI / 빈 상태

- 「등록된 제품 발견 후보가 없습니다.」
- 「검색·검증 파이프라인이 시작되면…」
- 상세 `/admin/discovery/[id]` **미구현** → 「상세 준비 중」 (404 링크 없음)
- 승인/reject/publish/시드 버튼 **없음**

## 6. 보안

service_role 서버 전용 · SELECT만 · assigned_to/이메일/UID 비노출 · https만 외부 링크

## 7. 다음

읽기 전용 `/admin/discovery/[id]` 또는 ingredients 목록.
