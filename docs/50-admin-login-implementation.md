# docs/50-admin-login-implementation.md — 관리자 로그인 최소 구현

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/49`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/app/admin/login/page.tsx` | 로그인 서버 페이지 |
| `src/app/admin/login/AdminLoginForm.tsx` | email/password client form |
| `src/app/admin/logout/route.ts` | POST signOut → /admin/login |
| `src/app/admin/AdminLogoutButton.tsx` | logout form button |
| `src/app/admin/unavailable/page.tsx` | 설정 누락 안내 |
| `src/app/admin/layout.tsx` | 미로그인→login, config→unavailable |
| `src/app/admin/page.tsx` | role + logout + catalog-review 링크 |
| `src/app/admin/forbidden/page.tsx` | 권한 없음 + logout |
| `src/app/admin/unauthorized/page.tsx` | → /admin/login redirect |

## 2. 로그인 흐름

```text
/admin/login
  → (optional) already admin_users active → /admin
  → signInWithPassword (browser anon client)
  → router.refresh + /admin
  → layout requireAdminUser (admin_users)
     → ok | forbidden | unavailable
```

로그인 성공 ≠ 관리자. **admin_users 서버 검증 필수.**  
`profiles.role` 미사용.

## 3. 로그아웃 흐름

```text
POST /admin/logout
  → createSupabaseServerClient().auth.signOut()
  → 303 /admin/login
```

GET logout 거부(405).

## 4. 경로 역할

| 경로 | 역할 |
|------|------|
| `/admin/login` | 로그인 폼 (가드 제외) |
| `/admin/forbidden` | 세션 있음·admin 아님 |
| `/admin/unavailable` | SERVICE_ROLE 등 설정 오류 |
| `/admin/unauthorized` | legacy → login redirect |

비밀번호 재설정: `docs/51-admin-password-reset.md`  
(`/admin/forgot-password`, `/admin/reset-password`)

## 5. 환경변수 (이름만 · 값 비공개)

| 이름 | 구현 시점 상태 |
|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | set |
| `SUPABASE_SERVICE_ROLE_KEY` | **missing** |

`.env.example`은 이름만 유지.

## 6. 테스트 결과

- `npm run build`: 실행·보고
- 무세션 `/admin` → `/admin/login` 기대
- SERVICE_ROLE missing 시 `/admin` → `/admin/unavailable` (E2E admin 200은 BLOCKER)

## 7. BLOCKER

1. `SUPABASE_SERVICE_ROLE_KEY` 로컬 미설정 → admin_users 조회 불가  
2. 실계정 E2E는 키 설정 후 수동 확인 필요  

## 8. 다음

비밀번호 재설정은 `docs/51`. 로컬 SERVICE_ROLE 설정 후 로그인·auth-check E2E.
