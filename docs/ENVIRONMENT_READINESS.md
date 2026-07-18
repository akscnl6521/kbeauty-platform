# ENVIRONMENT_READINESS.md

생성: 2026-07-18T09:20:23.614Z

**비밀키 값은 기록하지 않음.**

판정: **LOCAL_OK_WITH_MANUAL_PROD_CHECKS**

## 변수 존재 여부

| 변수 | 범위 | 상태 |
|------|------|------|
| `AI_PROVIDER` | REQUIRED_PROD | MISSING |
| `NEXT_PUBLIC_SITE_URL` | REQUIRED_PROD | MISSING |
| `NEXT_PUBLIC_SUPABASE_URL` | REQUIRED | PRESENT |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | REQUIRED | PRESENT |
| `SUPABASE_SERVICE_ROLE_KEY` | OPTIONAL_LOCAL_SERVER | MISSING |
| `CARE_EMAIL_PROVIDER` | OPTIONAL | MISSING |
| `RESEND_API_KEY` | OPTIONAL | MISSING |
| `SMTP_HOST` | OPTIONAL | MISSING |
| `OPENAI_API_KEY` | OPTIONAL | PRESENT |
| `ANTHROPIC_API_KEY` | OPTIONAL | MISSING |
| `VERCEL_CRON_SECRET` | OPTIONAL | MISSING |

## Findings

- **WRONG_SCOPE_SUSPECTED** `LOCAL_ENV_POINTS_AT_PRODUCTION_REF`: Local .env URL host matches Production ref — DB write scripts must stay blocked
- **WARN** `SITE_URL_MISSING_LOCAL`: NEXT_PUBLIC_SITE_URL missing locally — Production dashboard must set canonical domain

## Production blockers (if deployed with current local semantics)

- 로컬에서 AI_PROVIDER=mock / NEXT_PUBLIC service role 은 감지되지 않음

## 수동 확인 (대시보드)

- Vercel Production `AI_PROVIDER` ≠ mock
- `NEXT_PUBLIC_SITE_URL` = 실제 도메인
- Supabase Auth Site URL / Redirect URL
- Staging vs Production ref 혼동 금지
