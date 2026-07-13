# 76 — Pipeline Worker

## 로컬 워크스테이션

- `scripts/run-pipeline.ps1` / `run-pipeline.mjs`
- `PIPELINE_BASE_URL` + `PIPELINE_ADMIN_COOKIE` (비밀 커밋 금지)
- `src/lib/pipeline/worker.ts` — tick 루프, pause/resume/retry
- 기본 `dry_run`

## Task Scheduler

`install-pipeline-task.ps1`은 **명령만 출력**, 자동 등록하지 않음.

## 대안

GitHub Actions / cloud cron — 쿠키·키 시크릿 스토어 필요. 문서만 준비.
