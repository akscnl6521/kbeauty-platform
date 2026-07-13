# docs/63-verification-queue-write.md — Verification 큐 쓰기

최종 갱신: 2026-07-13

## API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/verification` | 큐 생성 |
| PATCH | `/api/admin/verification/[id]` | 검토 action |

## POST

- entity_type/review_type: 실제 CHECK만
- entity 존재 확인
- 동일 entity+review_type에 pending/in_review 있으면 `409 QUEUE_ALREADY_OPEN`
- 초기 `status=pending`, assigned_to=null
- 후보 workflow **자동 변경 없음**

## PATCH actions

| action | from | to | notes |
|--------|------|-----|-------|
| start_review | pending | in_review | 선택 |
| approve | in_review | approved | 선택 |
| reject | in_review | rejected | **필수** |
| needs_review | in_review | needs_review | **필수** |

- pending→approve 직접 금지
- approved/rejected 재변경 금지
- reopen/delete 금지

## UI

`/admin/verification/[id]` — 상태에 맞는 버튼만 활성
