# 136 — Care Worker Operation

최종 갱신: 2026-07-13

## Tick

기존 고정 `run-pipeline-worker.mjs` 경로에서 `runCareWorkerTick`:

- scheduled → due / expired
- due 알림 fingerprint `checkin_due|{id}` (중복 금지)
- completed 재알림 금지
- audit event (이벤트 타입만, 건강 원문 없음)

## 금지

루틴 강제 변경 · 외부 이메일/push · DELETE · 진단 · Cursor 운영 실행
