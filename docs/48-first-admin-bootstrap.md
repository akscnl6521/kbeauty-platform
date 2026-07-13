# docs/48-first-admin-bootstrap.md — 첫 관리자 bootstrap 준비

최종 갱신: 2026-07-13  
상태: **준비·문서만** — **실제 INSERT 미실행**  
관련: `docs/43`~`docs/47`  
프로젝트: `rhfrmvkjsummaylpzmns`

---

## 0. 민감정보 규칙

문서·채팅에 다음을 **기록하지 않는다.**

- 실제 이메일 전체  
- 실제 UUID 전체  
- access / refresh token  
- password hash  
- service_role 키  

표시 허용: 마스킹 이메일 (`ab***@example.com`), UUID 앞 8자리 (`xxxxxxxx-****`)만.

---

## 1. Auth 사용자 상태 (읽기 전용 스냅샷)

조사일: 2026-07-13 (SELECT only)

| 항목 | 값 |
|------|-----|
| auth.users 수 | **3** |
| 이메일 확인 완료 | **1** |
| 현재 banned | **0** |
| deleted | **0** |
| id 타입 | **uuid** |
| admin_users rows | **0** |
| admin_role_history rows | **0** |

### 후보 목록 (마스킹)

| # | UUID 앞8 | 이메일(마스킹) | 이메일 확인 | banned | 생성(UTC) |
|---|----------|----------------|-------------|--------|-----------|
| 1 | `63b3e0f8-****` | `ak***@gmail.com` | **예** | 아니오 | 2026-03-10 06:34:49 |
| 2 | `f6deedd8-****` | `se***@gmail.com` | 아니오 | 아니오 | 2026-03-10 07:44:30 |
| 3 | `be2ab5c2-****` | `ak***@naver.com` | 아니오 | 아니오 | 2026-03-10 07:51:31 |

**bootstrap 적격(규칙상):** 이메일 확인 완료 + 비banned + admin_users 미등록 → **#1만**  
**실제 등록:** 사용자 계정이 **여러 개**이므로, 운영자가 대상이 **본인 운영 계정**임을 **명시 승인**하기 전까지 INSERT **중단**.

임의 `auth.users` INSERT 금지. 미확인 계정(#2,#3)은 확인 완료 전 bootstrap 금지.

---

## 2. bootstrap 대상 검증 규칙

모두 충족해야 한다.

1. `auth.users`에 실제 존재  
2. `email_confirmed_at IS NOT NULL`  
3. `banned_until` 활성 밴 아님 (`NULL` 또는 과거)  
4. `admin_users`에 해당 `user_id` 없음  
5. 운영자가 “이 계정이 첫 admin”임을 **명시 확인**  
6. UUID는 Dashboard/Auth에서 복사 — 이메일로 추측 생성 금지  
7. **`profiles.role`은 판정에 사용하지 않음**  

---

## 3. 적용 방법 비교 · 최종 권고

| 방식 | 장점 | 단점 | 판정 |
|------|------|------|------|
| **A. Dashboard SQL Editor** | SQL 전체 육안 확인, UUID Auth UI에서 복사, BEGIN/ROLLBACK, 공개 API·앱 env 불필요 | 수동 | **권고** |
| B. Cursor MCP `execute_sql` | 자동화 | 실수 시 에이전트 경로, 승인 UX 약함 | 비권고(첫 bootstrap) |
| C. 로컬 service_role 스크립트 | 재현 가능 | env·키 유출 위험, 코드 추가 | 비권고 |

**최종 권고: A — Supabase Dashboard SQL Editor 수동 실행**  
(기존 `docs/43`/`docs/47` 결정 유지)

---

## 4. bootstrap SQL 구조 (템플릿 — 실행 금지)

원칙:
- 이메일 문자열이 아니라 **`id = '<AUTH_USER_UUID>'`** 만 사용  
- `admin_users` + `admin_role_history`를 **동일 트랜잭션**  
- 대상 0행이면 예외 → **전체 ROLLBACK**  
- UUID PK 조건상 admin_users INSERT는 최대 1행  
- 첫 bootstrap: `created_by = NULL`  
- history: `changed_by =` 동일 admin UUID (self)

`<AUTH_USER_UUID>` 자리에 **전체 UUID**를 Dashboard에서만 붙인다.  
이 문서·Git·채팅에 실 UUID를 넣지 않는다.

```sql
-- First admin bootstrap (Dashboard SQL Editor only).
-- Replace <AUTH_USER_UUID> locally. Do not commit real UUIDs.
-- Expected: 1 admin_users row + 1 admin_role_history row, else ROLLBACK.

BEGIN;

WITH target AS (
  SELECT u.id
  FROM auth.users u
  WHERE u.id = '<AUTH_USER_UUID>'::uuid
    AND u.email_confirmed_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_users au WHERE au.user_id = u.id
    )
),
ins_admin AS (
  INSERT INTO public.admin_users (
    user_id,
    role,
    active,
    created_by,
    last_reviewed_at,
    notes
  )
  SELECT
    t.id,
    'admin',
    true,
    NULL,
    now(),
    'Initial administrator bootstrap'
  FROM target t
  RETURNING user_id
),
ins_hist AS (
  INSERT INTO public.admin_role_history (
    target_user_id,
    old_role,
    new_role,
    old_active,
    new_active,
    changed_by,
    reason
  )
  SELECT
    a.user_id,
    NULL,
    'admin',
    NULL,
    true,
    a.user_id,
    'Initial administrator bootstrap'
  FROM ins_admin a
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM ins_admin) AS admin_inserted,
  (SELECT COUNT(*) FROM ins_hist) AS history_inserted;

-- Manual gate in Dashboard:
-- If admin_inserted <> 1 OR history_inserted <> 1 → ROLLBACK;
-- Else → COMMIT;
```

### 안전 장치 설명

| 조건 | 동작 |
|------|------|
| UUID 없음 / 미확인 / banned / 이미 admin | `target` 0행 → INSERT 0 → **ROLLBACK** |
| UUID 1개 매칭 | admin 1 + history 1 → **COMMIT** |
| 2행 이상 admin INSERT | PK(`user_id`)상 불가 |

Dashboard에서 SELECT 결과의 `admin_inserted`/`history_inserted`를 본 뒤 COMMIT 여부를 결정한다.  
한 문장으로 강제하려면 아래 변형(예외)을 쓸 수 있다.

```sql
-- Optional stricter variant (still replace UUID locally only):
BEGIN;

WITH target AS (
  SELECT u.id
  FROM auth.users u
  WHERE u.id = '<AUTH_USER_UUID>'::uuid
    AND u.email_confirmed_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_users au WHERE au.user_id = u.id
    )
),
ins_admin AS (
  INSERT INTO public.admin_users (
    user_id, role, active, created_by, last_reviewed_at, notes
  )
  SELECT t.id, 'admin', true, NULL, now(), 'Initial administrator bootstrap'
  FROM target t
  RETURNING user_id
),
ins_hist AS (
  INSERT INTO public.admin_role_history (
    target_user_id, old_role, new_role, old_active, new_active, changed_by, reason
  )
  SELECT a.user_id, NULL, 'admin', NULL, true, a.user_id, 'Initial administrator bootstrap'
  FROM ins_admin a
  RETURNING id
),
checked AS (
  SELECT
    (SELECT COUNT(*) FROM ins_admin) AS n_admin,
    (SELECT COUNT(*) FROM ins_hist) AS n_hist
)
SELECT
  CASE
    WHEN n_admin = 1 AND n_hist = 1 THEN 'OK_READY_TO_COMMIT'
    ELSE 'FAIL_ROLLBACK'
  END AS status,
  n_admin,
  n_hist
FROM checked;

-- If status = FAIL_ROLLBACK → ROLLBACK;
-- If status = OK_READY_TO_COMMIT → COMMIT;
```

DO 블록보다 **단일 트랜잭션 + CTE**를 우선한다 (가독성·Dashboard 확인 용이).

---

## 5. 감사 이력

| 필드 | 값 |
|------|-----|
| target_user_id | 첫 admin UUID |
| old_role | NULL |
| new_role | `admin` |
| old_active | NULL |
| new_active | true |
| changed_by | 첫 admin UUID (self) |
| reason | `Initial administrator bootstrap` |

`admin_users` INSERT와 **동일 트랜잭션**에서만 커밋.

---

## 6. 실행 전 체크리스트

- [ ] 프로젝트 URL이 `https://rhfrmvkjsummaylpzmns.supabase.co` 인지  
- [ ] 대상 이메일 마스킹이 의도한 계정과 일치하는지 (본인 확인)  
- [ ] UUID 앞 8자리가 Dashboard Auth와 일치하는지  
- [ ] 이메일 인증 완료  
- [ ] banned / deleted 아님  
- [ ] `admin_users` rows = 0  
- [ ] `admin_role_history` rows = 0  
- [ ] SQL의 `<AUTH_USER_UUID>`를 **로컬에서만** 실 UUID로 교체  
- [ ] BEGIN 포함, COMMIT은 결과 확인 후  
- [ ] 예상 INSERT: admin 1 + history 1  
- [ ] **사용자 명시 승인** (다계정 환경에서 대상 확정)  
- [ ] Git/채팅에 실 UUID·이메일 붙여넣지 않음  

---

## 7. 실행 후 검증 SQL (실행은 bootstrap 승인 후)

결과에서 이메일·UUID 전체를 SELECT하지 않는다.

```sql
SELECT
  (SELECT COUNT(*)::int FROM public.admin_users) AS admin_users_rows,
  (SELECT COUNT(*)::int FROM public.admin_role_history) AS history_rows,
  (SELECT COUNT(*)::int FROM public.admin_users
     WHERE role = 'admin' AND active = true AND created_by IS NULL) AS bootstrap_admin_shape,
  (SELECT COUNT(*)::int FROM public.admin_role_history
     WHERE new_role = 'admin'
       AND new_active = true
       AND old_role IS NULL
       AND changed_by = target_user_id) AS bootstrap_history_shape,
  (SELECT relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='admin_users') AS admin_users_rls,
  (SELECT COUNT(*)::int FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('admin_users','admin_role_history')) AS policy_count,
  (SELECT COUNT(*)::int FROM information_schema.role_table_grants
     WHERE table_schema='public'
       AND table_name IN ('admin_users','admin_role_history')
       AND grantee IN ('anon','authenticated')) AS anon_auth_grants;
```

기대:
- admin_users_rows = 1  
- history_rows = 1  
- bootstrap_admin_shape = 1  
- bootstrap_history_shape = 1  
- RLS ON, policy_count = 0, anon_auth_grants = 0  

마스킹 확인(선택):

```sql
SELECT
  left(user_id::text, 8) || '-****' AS uuid_prefix,
  role,
  active,
  (created_by IS NULL) AS created_by_null
FROM public.admin_users;
```

---

## 8. bootstrap 성공 이후 구현 순서

1. Supabase Auth 로그인 구조 확인 (앱 세션)  
2. browser / server / admin client 구현  
3. 서버 세션 검증  
4. `requireAdminUser`  
5. `admin/layout` 서버 가드  
6. `/api/admin` `withAdminAuth`  
7. `/admin/catalog-review` 보호  
8. 인증·권한 테스트  
9. 이후 관리자 검증 UI/API (`docs/38`~`42`)  

---

## 9. 보안 위험

| 위험 | 완화 |
|------|------|
| 잘못된 계정을 admin으로 등록 | 다계정 시 명시 승인 + UUID 앞8 대조 |
| 미확인 이메일 계정 | SQL에서 `email_confirmed_at` 필수 |
| 채팅에 UUID 유출 | 플레이스홀더만 문서화 |
| MCP로 자동 INSERT | 첫 bootstrap은 Dashboard만 |
| profiles.role 혼동 | 판정 금지 |

---

## 10. 이번 단계 금지 (재확인)

- admin_users / admin_role_history **INSERT 실행**  
- auth.users / profiles 수정  
- migration·앱·env·commit/push  

승인 전에는 이 문서의 SQL을 **실행하지 않는다.**
