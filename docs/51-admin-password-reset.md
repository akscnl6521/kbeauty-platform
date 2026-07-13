# docs/51-admin-password-reset.md — 관리자 비밀번호 재설정 최소 구현

최종 갱신: 2026-07-13  
상태: **PKCE callback 수정 · commit/push 안 함**  
관련: `docs/50`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/app/auth/callback/route.ts` | PKCE `code` → cookie 세션 교환 |
| `src/app/admin/forgot-password/page.tsx` | 재설정 요청 + recovery_failed 안내 |
| `src/app/admin/forgot-password/AdminForgotPasswordForm.tsx` | `resetPasswordForEmail` (callback redirectTo) |
| `src/app/admin/reset-password/page.tsx` | 새 비밀번호 설정 페이지 |
| `src/app/admin/reset-password/AdminResetPasswordForm.tsx` | cookie 세션 `getUser` + `updateUser` |
| `src/app/admin/login/AdminLoginForm.tsx` | 「비밀번호를 잊으셨나요?」 링크 |
| `src/app/admin/layout.tsx` | 가드 제외 경로 |
| `src/proxy.ts` | matcher에 `/auth/callback` 포함 |

## 2. 비밀번호 재설정 흐름 (PKCE SSR)

```text
/admin/forgot-password
  → resetPasswordForEmail(email, {
      redirectTo: origin + /auth/callback?next=/admin/reset-password
    })
  → 메일 링크 클릭 (Supabase Auth)
  → GET /auth/callback?code=…&next=/admin/reset-password
  → server exchangeCodeForSession(code) → Set-Cookie
  → 302 /admin/reset-password
  → browser getUser() 로 recovery 세션 확인
  → updateUser({ password })
  → signOut → /admin/login
```

실패 시: `/admin/forgot-password?error=recovery_failed`  
`reset-password` client에서 `exchangeCodeForSession` **하지 않음** (callback 전담).

## 3. 가드 / proxy

Public admin paths (layout):

- `/admin/login`
- `/admin/forgot-password`
- `/admin/reset-password`
- …

`/auth/callback`은 `/admin` 밖 → admin layout 가드 대상 아님.  
proxy matcher: `/admin/:path*`, `/api/admin/:path*`, `/auth/callback`

## 4. Dashboard Redirect URL (수동 · 자동 변경 안 함)

**필수 추가:**

```text
http://localhost:3000/auth/callback
```

**기존 유지 가능 (당장 삭제 불필요):**

```text
http://localhost:3000/admin/reset-password
```

새 메일은 callback URL을 쓰므로, Redirect URLs에 **callback이 없으면** 링크가 실패한다.

## 5. 보안

| 항목 | 상태 |
|------|------|
| `next` open redirect | `/` 시작 · `//` · `://` · `\` 차단 |
| code/token 로그 | 없음 |
| service_role 비밀번호 변경 | 미사용 |
| auth.users 직접 수정 | 없음 |
| Supabase 오류 원문 UI | 없음 |

## 6. 테스트 체크리스트 (수동)

| ID | 시나리오 | 기대 |
|----|----------|------|
| A | 재설정 요청 | 일반화 성공 메시지 |
| B | 새 메일 링크 | `/auth/callback?code=…` |
| C | code 교환 | 세션 쿠키 |
| D | redirect | `/admin/reset-password` |
| E | 폼 | 새 비밀번호 입력 가능 |
| F | updateUser | 성공 |
| G | signOut | `/admin/login` |
| H | 새 비밀번호 로그인 | `/admin` |
| I | auth-check | 200 |

코드 수정 후 A–I는 **수동 재검증 필요** (이전 메일 링크는 구 redirectTo일 수 있음 → **새 요청**).

## 7. BLOCKER

1. Dashboard에 `http://localhost:3000/auth/callback` 미등록 시 메일 redirect 거부  
2. 구 redirectTo로 발송된 메일은 재요청 필요  
3. `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 로그인 후 admin E2E 차단 가능  

## 8. 다음

Dashboard에 `/auth/callback` 추가 후 **새** 재설정 메일로 A–I E2E.
