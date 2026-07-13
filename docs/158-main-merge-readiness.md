# 158 — Main Merge Readiness

최종 갱신: 2026-07-13

## 준비됨 (코드)

- 사용자 여정 · Care · Auth · smoke/security/responsive 검사
- UI header overlap 수정 · a11y 기본선
- backup 브랜치 최신

## main 병합 전 필수 (사용자)

1. Preview에서 Hero overlap 해소 확인
2. Staging HTTP smoke · `/api/health`
3. Auth redirect/domain production 값 확정
4. production `AI_PROVIDER` ≠ mock · Site URL ≠ localhost
5. **명시적 승인** 후에만 main 병합
6. Production 배포는 병합 후 별도

## Rollback

코드: 이전 backup 커밋 재배포 · DB: docs/152 · Care migration: docs/132
