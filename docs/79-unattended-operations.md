# 79 — Unattended Operations

## 현재 상태 (2026-07-13)

- DB 영구 저장 **적용됨** (`create_autonomous_pipeline_persistence` / remote `20260713084701`)
- 운영 기본: Supabase persistence
- 스케줄러 기본: dry_run
- 자동 published 금지
- Task Scheduler: 스크립트 준비 · UAC 시 관리자 PowerShell 1회 등록 필요 가능

## 운영 원칙

- 정상 항목 자동 저장 (범위 내)
- needs_review만 사람
- 단일 실패로 배치 중단 금지
- idempotent · resume · checkpoint
- DELETE 금지

## Rollback

`docs/81-pipeline-migration-rollback.sql` — 승인 전 자동 실행 금지
