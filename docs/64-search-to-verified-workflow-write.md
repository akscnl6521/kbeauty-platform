# docs/64-search-to-verified-workflow-write.md — Workflow 전환

최종 갱신: 2026-07-13  
구현: `src/lib/admin/workflow.ts`

## review_type → approve 목표

| review_type | 결과 |
|-------------|------|
| duplicate | duplicate_check_status=pass (workflow 유지/재개) |
| sale | workflow=sale_checked, sale_check=pass |
| ingredients | ingredients_checked |
| evidence | evidence_checked |
| safety | safety_checked |
| other (from safety_checked) | **verified** (최종 검증) |
| publish | **published** (admin만) |

## 선행 조건

- sale 전: duplicate=pass, workflow=discovered
- 각 단계는 직전 workflow 완료 필요
- verified: 모든 check + duplicate = pass
- published: verified + linked_product_id + 모든 check pass + admin
- product_offers 없어도 published 가능하나, 추천 적격은 별도 (offers 0이면 실질 판매 검증 부족 — UI 경고)

## reject / needs_review

- reject: workflow=rejected (duplicate는 fail + needs_review)
- needs_review: workflow=needs_review

## 실패 코드

`INVALID_WORKFLOW_TRANSITION` (409), `PRECONDITION_FAILED` (422)

## 원자성

queue UPDATE → candidate UPDATE. candidate 실패 시 queue 보상 롤백 시도.  
DB RPC/트랜잭션 migration **없음** (현재 구조로 충분).
