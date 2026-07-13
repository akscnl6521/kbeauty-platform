# 138 — User Authentication

최종 갱신: 2026-07-13

## Routes

- `/login` `/signup` `/forgot-password` `/reset-password` `/logout`
- `/auth/callback` — signup confirm · recovery · PKCE (admin next=/admin* 유지)

## Rules

- browser: anon client only
- server: `getUser()` · body.userId 무시
- open redirect: `sanitizeNextPath` / `sanitizeCustomerNextPath`
- `/admin`는 `admin_users` 별도 가드 유지
- 소셜 로그인: provider 없으면 UI 미제공
- 비밀번호·토큰·이메일 로그 금지

## Errors (user-facing)

이메일/비밀번호 오류 · 이메일 인증 필요 · 이미 가입 · 재설정 만료 · 네트워크 · 일반 실패
