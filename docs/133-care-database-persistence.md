# 133 — Care Database Persistence

최종 갱신: 2026-07-13

## Migration

| 항목 | 값 |
|------|-----|
| 원격 버전 | `20260713113851` `create_continuous_care_persistence` |
| 후속 | `revoke_care_delete_privileges` |
| 로컬 파일 | `supabase/migrations/20260713180000_create_continuous_care_persistence.sql` |
| Rollback | `docs/132-care-migration-rollback.sql` (수동, 자동 실행 금지) |

## Tables

- `care_analysis_sessions`
- `care_routines` / `care_routine_items`
- `care_check_ins` (UNIQUE session+day 3/7/15/30)
- `care_suggestions` (`requires_user_confirm=true` CHECK)
- `care_notifications` (UNIQUE fingerprint)
- `care_feedback`
- `care_progress_snapshots`
- `care_audit_events` (service_role only)

## Runtime

- 로그인 사용자: Supabase persistence (`CarePersistence`)
- 익명: localStorage fallback
- 계정 연결: `POST /api/care/analyses/attach` (사용자 확인 후)
- Worker: `runCareWorkerTick` (Cursor 미실행)
