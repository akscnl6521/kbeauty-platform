# Master Execution Queue — legacy pointer

**Canonical 문서 (2026-07-23~):**

- 계약: `docs/autopilot/EXECUTION_CONTRACT.md`
- 큐: `docs/autopilot/MASTER_EXECUTION_QUEUE.md`
- Self-test: `npm run test:autopilot-queue`

이 파일은 이전 경로 호환용 포인터이다. 작업 상태·다음 작업은 autopilot 큐만 갱신한다.

## 스냅샷 (참고 · 2026-07-23 Master 번들)

| ID | 상태 |
|----|------|
| Q01–Q15, Q19–Q21 | done → `verified_complete` |
| Q16–Q17 | blocked_external → `external_only` |
| Q18 | deferred |

상세 분류·`next_task`는 canonical 큐를 본다.
