# 88 — Scheduled Catalog Operation

## Task

이름: `KBeautyMatch-Pipeline`

## 목표 기본값 (update-pipeline-task.ps1)

- Mode: `autonomous`
- Brands: 10 / Products: 50
- Tick / MaxTicks: 5 / 60
- `-AllowCommit` (게이트 통과 candidate만)
- 반복: 약 6시간
- MultipleInstances: IgnoreNew
- ExecutionTimeLimit: 3h
- 인자·작업에 service role / 쿠키 / 이메일 / UUID 금지
- `.env.local`은 프로젝트 내부에서만 읽음

## autonomous 흐름

1. dry_run 배치
2. 품질 게이트 (`evaluateBatchCommitReadiness` — 성공≥1, 실패율≤0.6)
3. 통과 시 commit 배치 (candidate INSERT만)
4. 불확실 → job/candidate `needs_review`
5. 다음 브랜드 계속 · 부분 실패로 전체 중단 안 함

## 검증 스크립트

- `scripts/check-pipeline-task.ps1`
- `scripts/update-pipeline-task.ps1` (기존 작업 안전 업데이트, UAC 필요할 수 있음)
- `scripts/run-pipeline.ps1`

## 로그

`data/pipeline/logs/pipeline-*.log`
