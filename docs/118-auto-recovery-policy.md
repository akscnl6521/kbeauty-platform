# 118 — Auto Recovery Policy

허용: stale running job 재큐잉, stale batch lock 해제, due retry_wait 승격.

금지: DELETE, publish, verified 강등, bulk rewrite, marketplace 승인, 성분 충돌 자동 확정.

`monitoring.autoRecoveryEnabled` + hard lock 준수. idempotent.
