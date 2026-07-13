# 79 — Unattended Operations

## 운영 원칙

- 정상 항목 자동 저장 (범위 내)
- needs_review만 사람
- 단일 실패로 배치 중단 금지
- idempotent · resume · checkpoint
- 자동 published 금지 · DELETE 금지

## 1차 한계 (BLOCKER)

파일 checkpoint는 단일 워크스테이션에는 적합하나  
다중 worker / 원격 감사 / 필드 provenance / quality·skin score 영구 저장에는 **DB 테이블 필요**.

### 필요 migration (승인 전 적용 금지)

신규 테이블 초안:

1. `pipeline_batches`
2. `pipeline_jobs`
3. `pipeline_checkpoints` (optional JSON blob)
4. `brand_official_sites` (또는 brands 확장)
5. `product_field_provenance`
6. `product_quality_scores`
7. `product_skin_match_scores`
8. `product_change_candidates`

상세 SQL: `docs/80-pipeline-migration-blocker.sql` (참고용, 미적용)

## Windows

1. `npm run build && npm run start`
2. 관리자 로그인 후 `/admin/pipeline` dry_run
3. worker: `.\scripts\run-pipeline.ps1`
4. Task Scheduler는 사용자가 수동 등록
