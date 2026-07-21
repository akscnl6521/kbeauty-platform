# Approval Policy — 승인 경계

K-Beauty Match Fast Execution System v1 승인 정책.

## Environment refs / 환경 식별자

| 환경 | ref (masked) | full ref (internal only) |
|------|--------------|--------------------------|
| Staging | `jfnj***gfd` | jfnjufmldiqlgvgyugfd |
| Production | `rhfr***mns` | rhfrmvkjsummaylpzmns |

에이전트·스크립트 출력에는 **masked ref만** 사용한다. full ref는 safe-command-gate 내부 검사용.

## Auto-allowed / 자동 허용 (반복 승인 불필요)

- feature 브랜치 코드·문서·테스트·dry-run
- `npm run test:*`, `npm run gate:*`, `npm run project:*` (orchestrator)
- Staging Preview 배포 (Production 아님)
- Staging migration **파일 작성** (Dashboard 적용 전 게이트·self-test)
- SELECT, Staging GRANT SELECT/INSERT/UPDATE TO service_role
- CREATE TABLE / INDEX / FUNCTION, RLS, REVOKE (Staging migration 범위)
- feature 브랜치 `git push` (main 아님)
- WORK_QUEUE / PROJECT_STATUS 문서 갱신
- probe·read-only Staging REST/RPC (키·값 출력 없음)

## Must-stop / 반드시 중단 (명시 승인 전 금지)

- Production ref (`rhfr***mns`) 대상 **모든** 쓰기·link·배포
- `git checkout main`, `git merge main`, main 직접 push
- `vercel --prod`, Production Supabase link/apply
- DROP, TRUNCATE, scope 밖 DELETE
- Resend / 이메일 provider **live send**
- .env·service_role·API 키 값 덤프·로그 출력
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 생성
- pipeline worker 운영 실행 (`run-pipeline-worker.mjs`)
- WORK_QUEUE task `approval_required: true` (예: WQ-G) 자동 complete

## Human-only / 사람만 (에이전트 exit 2)

- Staging Dashboard SQL Editor에서 migration 붙여넣기·Run
- Production 배포·DB·환경변수
- main 병합

## Task-level approval

`WORK_QUEUE.md` 필드 `approval_required: true` → `project:complete`는 `--force-docs-only` 없이 verify만으로 complete 불가; 사용자 승인 후 진행.
