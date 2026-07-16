# 76 — Pipeline Worker

## 로컬 워크스테이션

- `scripts/run-pipeline.ps1` → `scripts/run-pipeline-worker.mjs`
- `.env.local` 로드 (내용 미출력) · **관리자 쿠키 불필요**
- `server-only`/`@/` shim: `scripts/register-server-only.mjs`
- 기본 `dry_run` · commit은 `--allowCommit=true` 필요

## Task Scheduler

- `install-pipeline-task.ps1` / `check-pipeline-task.ps1` / `uninstall-pipeline-task.ps1`
- Task name: `KBeautyMatch-Pipeline`
- 등록 시 UAC(관리자) 필요할 수 있음

## Logs

`data/pipeline/logs/`
