# PRODUCTION_RELEASE_CHECKLIST.md

최종 갱신: 2026-07-18  
**이 문서는 실행 허가가 아니다.** Production 배포·main 병합·DB 변경은 명시 승인 후에만.

---

## A. 자동 완료 가능 (코드/CI)

| 항목 | 현재 상태 | 실행 주체 | 검증 | 실패 시 |
|------|-----------|-----------|------|---------|
| 브랜치 코드 Phase A–D | 완료 (`automation-mvp-completion`) | Agent | git log | 수정 커밋 |
| `check:mvp` 정적 게이트 | PASS | CI/로컬 | npm | 수정 후 재실행 |
| build / smoke / journey / quality | PASS | CI | npm | 수정 |
| recommendable / care / prod-safety | PASS | 로컬/CI | npm | 수정 |
| Production write 차단 스크립트 | PASS | test:prod-safety | npm | 가드 복구 |
| CI DB write 금지 | 설정됨 | `.github/workflows/ci.yml` | 리뷰 | 워크플로 수정 |
| 문서 감사 | 작성됨 | Agent | RELEASE_AUDIT 등 | 문서 수정 |
| Preview 자동 배포 | GitHub→Vercel(추정) | Vercel | 대시보드 URL | 재배포 |

---

## B. 사용자 대시보드 확인 필요

| 항목 | 현재 상태 | 실행 주체 | 검증 | 실패 시 |
|------|-----------|-----------|------|---------|
| Vercel Production `AI_PROVIDER` ≠ mock | 미확인 | 사용자 | Vercel env | mock 제거 |
| `NEXT_PUBLIC_SITE_URL` = 실제 도메인 | 미확인 | 사용자 | Vercel env | 도메인 수정 |
| Supabase Auth Site URL | 미확인 | 사용자 | Supabase Auth | URL 정합 |
| Supabase Auth Redirect URLs | 미확인 | 사용자 | callback 허용 | 로그인 실패 수정 |
| 도메인 연결 (kbeautymatch.com) | 문서상 라이브 이력 | 사용자 | DNS/Vercel | DNS |
| 이메일 provider | 미연결 (dry-run) | 사용자 | CARE_EMAIL_* | MVP는 앱내 알림으로 가능 |
| Production cron | **미등록** (vercel.json 없음) | 사용자 | Vercel cron | Phase 승인 후 |
| 모니터링/analytics | 선택 | 사용자 | — | MVP 비필수 |

---

## C. 명시 승인 필요

| 항목 | 현재 상태 | 실행 주체 | 검증 | 롤백 |
|------|-----------|-----------|------|------|
| main 병합 | **미실행** | 사용자 승인 후 | PR | revert |
| Production 앱 배포 | **0% 미배포** | 사용자 승인 후 | Vercel | 이전 배포 |
| Production DB migration | 미실행(본 브랜치) | 승인+confirm | supabase | rollback SQL |
| Production catalog 반영 | A안 5건만·확대 금지 중 | 승인 후 | DB | inactive |
| 이메일 live enable | 차단 | 승인 후 | adapter | provider off |
| Production care cron | 미등록 | 승인 후 | cron | disable |

**승인 문구 예:** 「Production 배포 진행」 / 「main 병합」
