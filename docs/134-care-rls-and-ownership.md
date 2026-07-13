# 134 — Care RLS and Ownership

최종 갱신: 2026-07-13

## RLS

모든 care_* 테이블 `ENABLE ROW LEVEL SECURITY`.

- authenticated: `user_id = auth.uid()` SELECT/INSERT/UPDATE
- routine_items: parent routine ownership
- anon: REVOKE ALL (테이블 직접 접근 불가)
- DELETE policy 없음 · DELETE privilege REVOKE
- `care_audit_events`: 클라이언트 정책 없음 (service_role)

## Ownership

- API는 `auth.getUser()`만 신뢰 · body.userId 무시
- 타인 리소스 → 404/403
- 관리자 집계는 service_role count만 · PII/메모/사진 비노출
