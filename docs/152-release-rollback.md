# 152 — Release Rollback

최종 갱신: 2026-07-13

## 코드 rollback

1. 문제 커밋 식별 (`git log`)
2. backup 브랜치에서 이전 안정 커밋으로 재배포 (force main 금지)
3. health + smoke 재확인

## Migration rollback

- Care 등 DB rollback은 `docs/132` 등 **수동 SQL** — 코드 rollback과 별개
- DELETE/TRUNCATE로 사용자 care 데이터를 지우지 않음 (별도 승인)

## 구분

| 대상 | 방법 |
|------|------|
| 앱 코드 | 이전 커밋 재배포 |
| Auth/URL 설정 | Supabase Dashboard 되돌리기 |
| Schema | migration rollback SQL (승인 후) |
| Worker | 스케줄 중지/이전 바이너리 (운영 PC) |
