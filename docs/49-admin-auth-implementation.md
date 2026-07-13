# docs/49-admin-auth-implementation.md — 관리자 인증 최소 구현

최종 갱신: 2026-07-13  
상태: **코드 구현됨 · commit/push 안 함**  
관련: `docs/43`~`docs/48`

---

## 1. 생성 파일

| 경로 | 역할 |
|------|------|
| `src/lib/supabase/browser.ts` | anon browser client |
| `src/lib/supabase/server.ts` | anon + cookies session |
| `src/lib/supabase/admin.ts` | service_role, `server-only` |
| `src/lib/auth/roles.ts` | AdminRole / capabilities |
| `src/lib/auth/errors.ts` | 401/403/500 오류 타입 |
| `src/lib/auth/admin.ts` | getUser / getAdminSession / require* |
| `src/lib/auth/withAdminAuth.ts` | API wrapper |
| `src/proxy.ts` | Next.js 16 cookie refresh (얕은 가드) |
| `src/app/admin/layout.tsx` | requireAdminUser (unauthorized/forbidden 제외) |
| `src/app/admin/page.tsx` | 인증 확인 랜딩 |
| `src/app/admin/catalog-review/page.tsx` | 기존 UI + admin layout 보호 + prod 404 |
| `src/app/admin/unauthorized/page.tsx` | 미로그인 안내 |
| `src/app/admin/forbidden/page.tsx` | 비관리자 안내 |
| `src/app/api/admin/auth-check/route.ts` | GET 테스트 API |
| `.env.example` | 변수명만 |
| `docs/49-admin-auth-implementation.md` | 본 문서 |

## 2. 수정 파일

- `src/lib/supabase.ts` — legacy anon 유지 (기존 pages 호환)
- `.gitignore` — `!.env.example`
- `package.json` / `package-lock.json` — `@supabase/ssr`, `server-only`
- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md`

## 3. 인증 흐름

```text
Request /admin/* or /api/admin/*
  → proxy: Supabase cookie refresh (no admin_users query)
  → (guarded) layout or withAdminAuth:
       getUser() via server session client
       admin_users via service_role admin client
       active + valid role
  → ok | redirect unauthorized/forbidden | JSON 401/403
```

**profiles.role은 사용하지 않음.**

## 4. Proxy 역할

- 파일: `src/proxy.ts` (Next.js 16, `middleware.ts` 대신)
- matcher: `/admin/:path*`, `/api/admin/:path*`
- `getUser()`로 세션 쿠키 갱신만
- **role DB 판정 금지**

## 5. server layout / API

- 최종 권한: `(guarded)/layout.tsx` + `withAdminAuth`
- unauthorized / forbidden은 layout 밖 (무한 리다이렉트 방지)

## 6. 환경변수

| 이름 | 필수 | 비고 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 예 | 기존 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 예 | 기존 |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 경로 | **서버 전용**, 호출 시에만 검사 |

`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 금지.

## 7. 로그인 페이지

- **없음** (앱에 Auth 로그인 UI 미구현)
- 미로그인 → `/admin/unauthorized` 안내
- BLOCKER: 세션을 브라우저에 넣는 최소 로그인 페이지 필요

## 8. 테스트 결과 (구현 시점)

| 항목 | 결과 |
|------|------|
| `npm run build` | 실행·보고 |
| 무세션 `/api/admin/auth-check` | 401 기대 |
| 무세션 `/admin` | unauthorized 리다이렉트 |
| SERVICE_ROLE 미설정 시 admin 조회 | configuration → forbidden |
| 원격 DB 변경 | 없음 |
| profiles.role 참조 | 코드상 권한 경로 0 |

## 9. 남은 BLOCKER

1. **관리자 로그인 UI 없음** → 실제 admin 세션 E2E 어려움  
2. 로컬 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 관리자 가드가 configuration 오류  
3. 제품 관리 UI / discovery API는 의도적으로 미구현  

## 10. 다음 작업

**관리자 로그인 페이지 최소 구현** (이메일/비밀번호 또는 매직링크) → 세션 쿠키 확보 후 `/admin`·`auth-check` E2E.
