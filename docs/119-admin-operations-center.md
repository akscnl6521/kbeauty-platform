# 119 — Admin Operations Center

- `/admin/operations` — 상태·지표·오늘/7일 요약
- `/admin/operations/alerts` — 알림 목록
- `/admin/operations/alerts/[code]` — 조치 안내 (관리자 링크 중심)
- API: `GET /api/admin/operations/health|alerts|alerts/[code]`

사용자는 PowerShell/SQL 대신 알림센터와 needs_review만 확인.
