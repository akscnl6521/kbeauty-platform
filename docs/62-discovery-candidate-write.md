# docs/62-discovery-candidate-write.md — Discovery 후보 쓰기

최종 갱신: 2026-07-13

## API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/discovery` | 후보 생성 → 201 |
| PATCH | `/api/admin/discovery/[id]` | 화이트리스트 수정 |

## 생성 초기값

- `workflow_status=discovered`
- 모든 `*_check_status=pending`
- `linked_product_id=null`, `assigned_to=null`
- verified/published로 생성 **금지**

## 검증

- name 필수, URL은 https만
- source_type은 CHECK 값만
- 중복: 동일 URL 또는 동일 name+brand → `409 DUPLICATE_CANDIDATE`

## PATCH 허용

discovered_name/brand/url/country, source_type, notes, duplicate_check_status, linked_product_id

## 금지

- 연결 해제
- 연결 교체: admin만
- published/rejected 수정
- assigned_to / id / created_at

## UI

- `/admin/discovery/new` — 수동 등록
- `/admin/discovery/import` — **URL/CSV 빠른 등록** (`docs/66`~`68`)
- 목록 「후보 등록」·「URL로 빠른 등록」버튼 (권한 역할만)
