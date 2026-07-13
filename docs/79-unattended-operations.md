# 79 — Unattended Operations

## 역할 분리 (필수)

| 역할 | 담당 |
|------|------|
| Cursor Agent | 코드·문서·단위 테스트·build·commit/push |
| `KBeautyMatch-Pipeline` + worker | 실제 dry_run / 게이트 / 신규 candidate INSERT |
| 사람 | `needs_review`만 확인 |

Cursor는 **운영 worker / Task Scheduler / 운영 SQL을 세션 중 실행하지 않는다.**  
Pending approval 루프를 만들지 않는다.

## 고정 실행

- 스케줄러 명령: `node scripts/run-pipeline-worker.mjs` (가변 CLI 인자 금지)
- 설정: `config/pipeline-operation.json`
- 관리자 오버라이드: `data/pipeline/operation-overrides.json` (`/admin/pipeline/settings`)

## 허용 DB 쓰기 (worker만)

- 신규 `product_discovery_candidates` INSERT
- 신규 duplicate / ingredients `verification_queue` INSERT (needs_review만)
- pipeline batch/job/checkpoint
- provenance / quality / skin score
- audit INSERT
- **draft** `products` INSERT (`active=false` only, `allowDraftProductInsert`)
- `product_variants` (pending, inactive)
- `product_ingredients` (exact/alias match only)
- `product_offers` candidate (`unverified`) 및 게이트 통과 시 `verified` UPSERT

## 금지

- 자동 published · ungated offer insert · marketplace seller · DELETE · overwrite · unverified purchase recommendation

## Rollback SQL

`docs/81-pipeline-migration-rollback.sql` — 승인 전 자동 실행 금지
