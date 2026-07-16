# docs/51-admin-password-reset.md — 관리자 비밀번호 재설정 최소 구현

최종 갱신: 2026-07-13  
상태: **token_hash + code callback · commit/push 안 함**  
관련: `docs/50`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/app/auth/callback/route.ts` | `verifyOtp(recovery)` + PKCE `code` fallback |
| `src/app/admin/forgot-password/page.tsx` | 재설정 요청 + recovery_failed 안내 |
| `src/app/admin/forgot-password/AdminForgotPasswordForm.tsx` | `resetPasswordForEmail` (callback redirectTo) |
| `src/app/admin/reset-password/page.tsx` | 새 비밀번호 설정 페이지 |
| `src/app/admin/reset-password/AdminResetPasswordForm.tsx` | cookie 세션 `getUser` + `updateUser` |
| `src/app/admin/login/AdminLoginForm.tsx` | 「비밀번호를 잊으셨나요?」 링크 |
| `src/app/admin/layout.tsx` | 가드 제외 경로 |
| `src/proxy.ts` | matcher에 `/auth/callback` 포함 |

## 2. 비밀번호 재설정 흐름

### 권장: 이메일 템플릿 `token_hash` 방식

```text
메일 Reset Password 링크
  → GET /auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/admin/reset-password
  → server verifyOtp({ token_hash, type: "recovery" }) → Set-Cookie
  → 302 /admin/reset-password
  → getUser → updateUser({ password }) → signOut → /admin/login
```

### fallback: PKCE `code` 방식

```text
resetPasswordForEmail({ redirectTo: origin/auth/callback?next=/admin/reset-password })
  → GET /auth/callback?code=…&next=/admin/reset-password
  → server exchangeCodeForSession(code) → Set-Cookie
  → 302 /admin/reset-password
```

우선순위: **token_hash+recovery → code → 실패**  
실패: `/admin/forgot-password?error=recovery_failed`  
`reset-password` client에서 code/token 재교환 **안 함**.

## 3. Supabase Email Template (수동)

Authentication → Email Templates → **Reset password**

링크를 아래 구조로 설정 (변수 그대로 · 실제 hash 기록 금지):

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/admin/reset-password">Reset Password</a>
```

Site URL이 `http://localhost:3000`인지 확인.

기본 `{{ .ConfirmationURL }}`만 쓰면 Supabase verify 엔드포인트를 거쳐 PKCE `code`로 돌아올 수 있고, 프로젝트/클라이언트 설정에 따라 `exchangeCodeForSession`이 실패할 수 있다. 이 경우 **token_hash 템플릿**이 안정적이다.

## 4. Dashboard Redirect URL (수동 · 자동 변경 안 함)

유지/허용:

```text
http://localhost:3000/auth/callback
http://localhost:3000/admin/reset-password
```

## 5. 가드 / proxy

Public admin: `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`, …  
`/auth/callback`은 `/admin` 밖.  
proxy matcher: `/admin/:path*`, `/api/admin/:path*`, `/auth/callback`

## 6. 보안

| 항목 | 상태 |
|------|------|
| `next` open redirect | `/` 시작 · `//` · `://` · `\` 차단 |
| type | `recovery`만 허용 (token_hash 경로) |
| code/token_hash/이메일/UUID 로그 | 없음 |
| Supabase 오류 원문 UI | 없음 |
| service_role / auth.users SQL | 미사용 |

## 7. 테스트 체크리스트 (수동)

| ID | 시나리오 | 기대 |
|----|----------|------|
| A | 이메일 템플릿 token_hash 링크 | callback → reset-password |
| B | verifyOtp 성공 | 세션 쿠키 |
| C | 새 비밀번호 설정 | updateUser 성공 |
| D | signOut → login | 새 비밀번호 로그인 |
| E | auth-check | 200 |
| F | (선택) code 링크 | exchangeCodeForSession fallback |

템플릿 변경 후 **새** 재설정 메일로 검증.

## 8. BLOCKER

1. Reset Password 이메일 템플릿이 아직 `{{ .ConfirmationURL }}`만 쓰면 token_hash 경로 미사용  
2. Dashboard Redirect URL에 `/auth/callback` 필요  
3. `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 로그인 후 admin E2E 차단 가능  

## 9. 다음

Email Template을 token_hash URL로 바꾼 뒤 **새** 메일로 A–E E2E.
