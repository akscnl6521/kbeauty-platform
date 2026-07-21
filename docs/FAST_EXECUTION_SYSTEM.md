# Fast Execution System v1

에이전트·운영자가 **한 작업씩** 안전하게 진행하기 위한 로컬 오케스트레이션.

## Doc read order

1. `PROJECT_STATUS.md` — 현재 완료·차단
2. `ROADMAP.md` — 중기 목표
3. `WORK_QUEUE.md` — 실행 큐 (active 1개)
4. `docs/APPROVAL_POLICY.md` — 승인 경계
5. `docs/NEXT_TASK_PREVIEW_VALIDATION.md` — Preview 검증 (해당 시)

## npm commands

| Command | 설명 |
|---------|------|
| `npm run project:status` | 브랜치·커밋·active/next task·보호 상태 |
| `npm run project:next` | 다음 queued → active |
| `npm run project:verify` | active task 테스트 + safe gate + secret scan |
| `npm run project:complete` | verify 통과 후 completed 기록 |
| `npm run project:continue` | status → (next) → verify; Dashboard 차단 시 exit 2 |
| `npm run test:work-queue` | WORK_QUEUE 파서 selftest |
| `npm run test:safe-command-gate` | 명령/SQL 게이트 selftest |
| `npm run test:project-orchestrator` | 오케스트레이터 selftest |

## Agent rules

1. **active task 하나만** — `WORK_QUEUE.md`의 `status: active`
2. complete 전 **반드시** `npm run project:verify`
3. Production(`rhfr***mns`)·main merge·live email send **금지** — `safe-command-gate`가 차단
4. Staging Dashboard SQL은 **한국어 one-shot 안내** 후 exit 2; 에이전트가 SQL 실행하지 않음
5. commit은 에이전트가 `--commit` 없이는 자동하지 않음
6. complete 후 `PROJECT_STATUS.md` 한 줄 갱신은 **사람/에이전트 수동** (orchestrator는 reminder만)

## Files

- `WORK_QUEUE.md` — task 큐
- `scripts/lib/work-queue.mjs` — 파서·상태 갱신
- `scripts/safe-command-gate.mjs` — 위험 명령 차단
- `scripts/project-state-summary.mjs` — 상태 요약
- `scripts/verify-current-task.mjs` — active task 검증
- `scripts/project-orchestrator.mjs` — CLI 진입점
