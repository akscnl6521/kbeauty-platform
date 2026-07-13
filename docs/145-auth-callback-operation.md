# 145 — Auth Callback Operation

최종 갱신: 2026-07-13

지원: `token_hash`+`signup|email|recovery` · PKCE `code`.
기본 next: recovery→`/reset-password`, signup/email→`/auth/link-local?next=/onboarding`, 그 외 `/my`.
실패: `/auth/error` (관리자 recovery는 admin 경로).
open redirect·토큰 로그 금지. Supabase 템플릿 type과 코드 일치 필요.
