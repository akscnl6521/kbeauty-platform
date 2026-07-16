# docs/46-admin-auth-implementation-plan.md — 관리자 인증 구현 계획

최종 갱신: 2026-07-13  
상태: **설계 전용 — 코드·migration·환경변수 미적용**  
선행 승인 문서: `docs/43`~`docs/45`

---

## 1. 예상 파일 구조 (생성 예정, 지금은 안 만듦)

```text
src/lib/supabase/browser.ts      # anon + 브라우저
src/lib/supabase/server.ts       # anon + 쿠키 세션
src/lib/supabase/admin.ts        # service_role 전용
src/lib/auth/roles.ts            # role union, allow-lists
src/lib/auth/permissions.ts      # 작업→role 매트릭스
src/lib/auth/admin.ts            # getAdminSession, require*
src/lib/auth/withAdminAuth.ts    # API wrapper
src/app/admin/layout.tsx         # requireAdminUser
src/app/admin/login/page.tsx     # 로그인 UI (최소)
middleware.ts                    # /admin, /api/admin 얕은 가드
.env.example                     # 이름만 (SERVICE_ROLE 포함)
```

의존성 후보 (구현 시): `@supabase/ssr` (세션 쿠키). Zod는 validation 단계에서 선택.

기존 `src/lib/supabase.ts`: browser re-export로 점진 이전.

---

## 2. 구현 순서 (검토·확정)

사용자 제시 순서를 약간 보강한 권고:

| # | 단계 | 비고 |
|---|------|------|
| 1 | 인증 설계 승인 (`43`~`46`) | **현재** |
| 2 | GitHub 문서 백업 (commit/push는 사용자 지시 시) | |
| 3 | `admin_users` / `admin_role_history` migration **작성** | 원격 미적용 |
| 4 | migration 사전 검사 (SHA, REVOKE, DROP 0) | |
| 5 | GitHub 백업 | |
| 6 | Supabase `apply_migration` (사용자 승인 후 1회) | |
| 7 | 첫 admin Dashboard SQL bootstrap | 민감값 채팅 금지 |
| 8 | env: `SUPABASE_SERVICE_ROLE_KEY` 로컬만 | 커밋 금지 |
| 9 | server/browser/admin clients | |
| 10 | `requireAdmin*` + permissions | |
| 11 | `admin/layout` + middleware | |
| 12 | `/admin/catalog-review` 이중 보호 | |
| 13 | 보호 테스트 | |
| 14 | 이후 `/api/admin`·검증 UI (`38`~`42`) | 인증 완료 후 |

순서 적절성: **적합.** UI/API를 migration·bootstrap보다 앞에 두지 말 것.

---

## 3. /admin 보호 구현 요지

1. `middleware`: `/admin/*` 쿠키 없음 → login 리다이렉트 (role DB는 여기서 필수는 아님)  
2. `admin/layout.tsx`: `requireAdminUser()` — 미등록/inactive → 403  
3. 민감 하위 페이지: `requireAdminRole([...])`  
4. catalog-review: `NODE_ENV===development` **그리고** admin session  

---

## 4. /api/admin 보호 구현 요지

```text
export const POST = withAdminAuth(async (req, ctx, session) => { ... }, ['admin']);
```

- 401 / 403 / 400 / 409 / 422 / 500  
- 업무 쓰기는 admin client  
- DB 오류 원문 비노출  

---

## 5. 테스트 항목

### 기능
- [ ] 미로그인 /admin → 로그인 또는 차단  
- [ ] 로그인·비관리자 → 403  
- [ ] active=false → 403  
- [ ] read_only GET 성공, POST 403  
- [ ] researcher publish 403  
- [ ] catalog_manager evidence 승인 403  
- [ ] admin publish 경로만 통과(게이트는 이후)  

### 보안
- [ ] 클라이언트 번들에 service_role 문자열 없음  
- [ ] admin_users를 브라우저 supabase로 SELECT 불가  
- [ ] profiles.role을 admin으로 바꿔도 /admin 403  
- [ ] production catalog-review 404  
- [ ] URL/쿼리로 승격 불가  

### 회귀
- [ ] `npm run build`  
- [ ] `/api/analyze` 동작  
- [ ] 소비자 페이지 회귀  

---

## 6. 완료 기준 (인증 스프린트)

1. admin_users에 active admin ≥ 1  
2. 서버 가드로 /admin·/api/admin 차단 확인  
3. profiles.role 변조로 우회 불가  
4. service_role은 admin.ts만  
5. 문서·CHANGELOG·STATUS 갱신  
6. **관리자 검증 UI는 아직 없어도 됨** — 다음 스프린트  

---

## 7. 구현하지 않는 범위 (본 인증 스프린트)

- discovery/publish API 본체  
- Search-to-Verified UI  
- products.pipeline_status 등 스키마 확장  
- profiles hardening (별도)  
- seed·제품 등록  
- Zod 전면 도입(선택)  
- SSO/MFA (추후)

---

## 8. 최종 권고 요약 (체크리스트)

| 항목 | 결정 |
|------|------|
| profiles.role 사용 | **아니오** (관리자 SSOT 아님) |
| admin_users | **예** |
| app_metadata | **아니오** |
| 첫 admin | **Dashboard SQL 수동** |
| middleware | **예** (얕은 가드) |
| server layout guard | **예** (최종 권한) |
| API wrapper | **예** `withAdminAuth` |
| service_role 파일 | `src/lib/supabase/admin.ts` |
| UI 구현 전 필수 | migration 적용 + bootstrap + clients + guards + 테스트 |

---

## 9. 이번 단계 금지

앱 코드, middleware 파일, API, migration 파일, Supabase 적용, 계정 생성, env 추가, commit/push.
