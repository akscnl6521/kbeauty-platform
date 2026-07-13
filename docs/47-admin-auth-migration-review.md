# docs/47-admin-auth-migration-review.md — admin_users migration 사전 검토

최종 갱신: 2026-07-13  
상태: **로컬 migration 작성 완료 · 원격 미적용**  
Migration 파일: `supabase/migrations/20260713040000_create_admin_auth_tables.sql`  
MCP 적용 예정 name: `create_admin_auth_tables`  
관련: `docs/43`~`docs/46`

---

## 1. 현재 인증 BLOCKER

| 항목 | 상태 |
|------|------|
| 앱 관리자 세션 | 없음 |
| admin_users (원격) | **미존재** (본 migration으로 해소 예정) |
| `/api/admin` · middleware | 없음 |
| profiles.role 자가 UPDATE | 가능 — **관리자 판정에 사용 금지** |

관리자 UI/API는 **본 migration 적용 + bootstrap + 서버 가드** 이후에만 구현한다.

---

## 2. admin_users 구조

| 컬럼 | 타입 | 제약 |
|------|------|------|
| user_id | uuid | PK, FK auth.users ON DELETE **RESTRICT** |
| role | text | NOT NULL, CHECK 5종 |
| active | boolean | NOT NULL DEFAULT true |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |
| created_by | uuid | NULL, FK auth.users ON DELETE **SET NULL** |
| last_reviewed_at | timestamptz | NULL, CHECK ≥ created_at |
| notes | text | NULL 또는 non-empty trim |

**FK 선택 이유**
- `user_id` RESTRICT: Auth 사용자 삭제 전 admin 행을 먼저 비활성/정리하도록 강제 (감사·실수 삭제 방지)
- `created_by` SET NULL: 부여한 admin 계정 삭제 시에도 대상 admin_users 행 유지

---

## 3. admin_role_history 구조

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | uuid | PK DEFAULT gen_random_uuid() |
| target_user_id | uuid | NOT NULL, FK RESTRICT |
| old_role / new_role | text | NULL 또는 5종 CHECK |
| old_active / new_active | boolean | NULL 가능 |
| changed_by | uuid | **NOT NULL**, FK RESTRICT |
| reason | text | NOT NULL, trim <> '' |
| changed_at | timestamptz | NOT NULL DEFAULT now() |

추가 CHECK:
- 최소 한 차원(role 또는 active) 값 존재
- `IS DISTINCT FROM`으로 no-op 이력 거부

**request_id:** 향후 API idempotency용 nullable 후보. **이번 migration 미포함.**

---

## 4. 역할 CHECK

```text
admin | reviewer | researcher | catalog_manager | read_only
```

---

## 5. RLS · 권한

| 테이블 | RLS | 정책 | anon/auth GRANT |
|--------|-----|------|-----------------|
| admin_users | ENABLE | **0** | REVOKE ALL 후 GRANT **0** |
| admin_role_history | ENABLE | **0** | 동일 |

- service_role **REVOKE 금지**
- authenticated self-read 정책 **없음** (서버 service_role 조회만)
- public default ACL이 CREATE 직후 열릴 수 있으므로 **반드시 REVOKE ALL**

---

## 6. 인덱스

| 이름 | 정의 | 비고 |
|------|------|------|
| admin_users_role_active_idx | (role, active) | role 단독 인덱스 생략(좌측 접두) |
| admin_users_active_idx | (active) | active-only 목록 |
| admin_users_updated_at_idx | (updated_at) | |
| admin_role_history_target_changed_at_idx | (target_user_id, changed_at DESC) | target 단독 생략 |
| admin_role_history_changed_by_idx | (changed_by) | |
| admin_role_history_changed_at_idx | (changed_at DESC) | |

---

## 7. updated_at 전략 (선택: A)

| 안 | 내용 | 판정 |
|----|------|------|
| **A. 앱 서버 갱신** | UPDATE 시 `updated_at=now()` | **채택** — 단순, 함수/EXECUTE 이슈 없음 |
| B. DB trigger | 전용 함수 + search_path | 보류 — 이번 migration에 trigger/함수 **0** |

서버 미구현 전까지 Dashboard 수동 UPDATE 시 `updated_at`을 함께 갱신한다.

---

## 8. 첫 admin bootstrap (실행 금지 — 형식만)

운영자가 Dashboard에서 Auth 사용자 UUID를 **직접** 확인한 뒤:

```sql
-- PLACEHOLDER only. Replace :admin_user_id locally. Do not commit real UUIDs.
BEGIN;

INSERT INTO public.admin_users (
  user_id, role, active, created_by, notes
) VALUES (
  ':admin_user_id'::uuid,
  'admin',
  true,
  NULL,  -- first bootstrap
  'bootstrap via dashboard'
);

INSERT INTO public.admin_role_history (
  target_user_id,
  old_role,
  new_role,
  old_active,
  new_active,
  changed_by,
  reason
) VALUES (
  ':admin_user_id'::uuid,
  NULL,
  'admin',
  NULL,
  true,
  ':admin_user_id'::uuid,  -- self as changed_by on first bootstrap
  'initial admin bootstrap'
);

COMMIT;
```

금지: 자동 승격, 공개 API, 클라이언트 이메일 비교, 채팅/문서에 실 UUID·이메일 기록.

이후 역할 변경은 서버 API + history 필수 (`docs/44`).

---

## 9. profiles.role 처리

- **이번 migration: profiles ALTER 0**
- 관리자 판정에 `profiles.role` **절대 사용 금지**
- 사용자가 profiles.role을 바꿔도 admin_users와 무관
- 향후 hardening 후보: UPDATE 시 role 컬럼 잠금, 과도 GRANT 축소, 컬럼 폐기/회원전용 제한

---

## 10. 원격 사전 검사 (2026-07-13 SELECT)

| 검사 | 결과 |
|------|------|
| admin_users 존재 | **아니오** |
| admin_role_history 존재 | **아니오** |
| 예정 객체 이름 충돌 | **0** (조회상 없음) |
| auth.users.id | **uuid** |
| gen_random_uuid() | **사용 가능** |
| 최신 원격 migration | `20260713034442` / `complete_search_to_verified_pipeline` |
| 로컬 파일 version | `20260713040000` → **원격 이후** OK |
| pgcrypto/uuid 확장 | 사용 가능 |

---

## 11. 적용 전 체크리스트

- [ ] GitHub 백업
- [ ] 사용자 승인
- [ ] SHA-256 재확인
- [ ] apply_migration name = `create_admin_auth_tables`
- [ ] **전체 SQL 1회** (발췌 금지)
- [ ] seed INSERT 없음 재확인
- [ ] 적용 직후 SELECT 검증 준비

## 12. 적용 후 검증 SQL (적용 후에만 실행)

```sql
-- existence + rls
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('admin_users','admin_role_history');

-- no client grants
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('admin_users','admin_role_history')
  AND grantee IN ('anon','authenticated');

-- no policies
SELECT * FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('admin_users','admin_role_history');

-- empty until bootstrap
SELECT
  (SELECT COUNT(*) FROM public.admin_users) AS admin_users_rows,
  (SELECT COUNT(*) FROM public.admin_role_history) AS history_rows;
```

## 13. 실패 시 대응

- 오류 원문 보존, **재적용 금지(성공 불명확 시)**
- DROP으로 “롤백” 금지
- 부분 생성 시 사용자와 Plan A/B 협의 (기존 Search-to-Verified 복구 교훈)

## 14. 적용 후에도 UI/API 전 필요 작업

1. Dashboard bootstrap (1 admin)  
2. `SUPABASE_SERVICE_ROLE_KEY` 로컬 설정 (커밋 금지)  
3. server/admin Supabase clients  
4. `requireAdmin*` + `/admin` layout (+ middleware)  
5. catalog-review 이중 보호  
6. 보호 테스트  

그 다음 `docs/38`~`42` 관리자 검증 UI/API.

---

## 15. 정적 검증 요약 (작성 시점 목표)

| 항목 | 기대 |
|------|------|
| CREATE TABLE | 2 |
| RLS ENABLE | 2 |
| REVOKE ALL | 2 |
| GRANT anon/auth | 0 |
| CREATE POLICY | 0 |
| service_role REVOKE | 0 |
| DROP/TRUNCATE/DELETE | 0 |
| profiles/auth ALTER | 0 |
| INSERT seed | 0 |
