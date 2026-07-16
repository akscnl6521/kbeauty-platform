# 153 — Domain & Auth Validation

최종 갱신: 2026-07-13

## Domain

- Canonical: `https://kbeautymatch.com`
- `www` → apex 301
- HTTPS 필수 · HSTS는 `ENABLE_HSTS=true`일 때만 앱 헤더 적용

## Supabase Auth

- Site URL = 현재 환경 origin
- Redirect URLs: `/auth/callback`, `/auth/callback?next=*`
- 이메일 템플릿 type: `signup`/`email`/`recovery` ↔ 코드 일치 (`docs/145`)

## 검증

- callback 성공 → link-local/onboarding 또는 reset-password
- 외부 URL `next` 차단
- 토큰·이메일을 로그/화면에 원문 노출 금지
