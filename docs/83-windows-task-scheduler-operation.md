# 83 — Windows Task Scheduler Operation

## Task

- Name: `KBeautyMatch-Pipeline`
- Mode: **dry_run**
- Script: `scripts/run-pipeline.ps1`
- Install: `scripts/install-pipeline-task.ps1`
- Check: `scripts/check-pipeline-task.ps1`
- Uninstall: `scripts/uninstall-pipeline-task.ps1`

## Secrets

- `.env.local`만 사용 (존재 여부만 확인, 내용 미출력)
- Task arguments에 service role/cookie 금지
- Worker: `scripts/pipeline-worker-direct.ts` (쿠키 불필요)

## Logs

`data/pipeline/logs/pipeline-*.log` (최근 40개 유지)

## Lock

로컬 `data/pipeline/runtime/worker.lock` + DB claim/heartbeat
