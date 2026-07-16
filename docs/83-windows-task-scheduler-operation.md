# 83 — Windows Task Scheduler Operation

## Task

- Name: `KBeautyMatch-Pipeline`
- **Fixed** action: `powershell.exe` → `scripts\run-pipeline.ps1` → `node scripts/run-pipeline-worker.mjs`
- **No CLI knobs**: no `--brands`, `--products`, `--allowCommit`, `--mode`, secrets, cookies, emails, UUIDs
- Limits/mode: `config/pipeline-operation.json` (+ admin overrides)

## Operator scripts (not for Cursor agent loops)

- `scripts/install-pipeline-task.ps1` — one-time register
- `scripts/update-pipeline-task.ps1` — one-time rewrite to fixed command (elevated)
- `scripts/check-pipeline-task.ps1` — optional operator inspection

Agents must not register/update/poll the task during development sessions.

## Secrets

- `.env.local` inside project only
- Never in Task Scheduler arguments

## Logs / Lock

- Logs: `data/pipeline/logs/pipeline-*.log`
- Lock: `data/pipeline/runtime/worker.lock` + DB claim/heartbeat
