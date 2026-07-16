# docs/45-admin-auth-migration-plan.md — 관리자 인증 migration 계획

최종 갱신: 2026-07-13  
상태: **설계 전용 — migration 파일 생성·원격 적용 금지**  
권고안: **B — admin_users + admin_role_history**

---

## 1. 목표

- 관리자 권한을 profiles와 분리  
- anon/authenticated가 권한 테이블을 읽거나 쓰지 못함  
- 첫 admin은 Dashboard SQL로만 bootstrap  
- DROP/TRUNCATE 없이 롤백은 **비활성화** 원칙

---

## 2. 테이블 설계

### 2.1 `public.admin_users`

| 컬럼 | 타입 | NULL | 기본 | 설명 |
|------|------|------|------|------|
| user_id | uuid | NO | — | PK, FK → auth.users(id) ON DELETE CASCADE |
| role | text | NO | — | CHECK 5종 |
| active | boolean | NO | true | 즉시 차단 |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| created_by | uuid | YES | NULL | FK auth.users, bootstrap은 NULL |
| last_reviewed_at | timestamptz | YES | NULL | 권한 재검토 |

```text
CHECK (role IN (
  'admin', 'reviewer', 'researcher', 'catalog_manager', 'read_only'
))
```

인덱스:
- PK (user_id)
- `admin_users_active_role_idx` ON (active, role)
- (선택) partial: active=true

### 2.2 `public.admin_role_history`

| 컬럼 | 타입 | NULL | 기본 |
|------|------|------|------|
| id | uuid | NO | gen_random_uuid() |
| target_user_id | uuid | NO | — |
| old_role | text | YES | |
| new_role | text | YES | |
| old_active | boolean | YES | |
| new_active | boolean | YES | |
| changed_by | uuid | YES | |
| reason | text | YES | |
| changed_at | timestamptz | NO | now() |

인덱스: `(target_user_id, changed_at DESC)`, `(changed_at DESC)`

FK: target_user_id / changed_by → auth.users(id) ON DELETE RESTRICT 또는 SET NULL(changed_by)  
(운영 선택: RESTRICT가 감사 보존에 유리)

---

## 3. RLS · 정책 · GRANT

두 테이블 공통:

```text
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- 정책 0개 (클라이언트 접근 경로 없음)
REVOKE ALL ON TABLE ... FROM anon, authenticated;
-- service_role REVOKE 하지 않음
```

관리자 조회·변경은 **서버 admin client(service_role)** 만.  
authenticated용 “본인 admin_users SELECT” 정책은 **넣지 않음** (JWT만으로 권한 추론 방지·클라이언트 우회 방지).  
세션 확인 후 서버가 service_role로 조회하는 패턴 (`docs/43`).

---

## 4. profiles 변경 범위

**이번 admin migration에서 profiles ALTER 금지(권고).**

이유:
- A안 채택 안 함
- profiles.role을 건드릴 필요 없음
- 기존 UPDATE 정책 위험은 **별도 hardening 후보**로 기록만

향후 hardening 후보(별 문서/별 migration):
- profiles UPDATE 시 role 컬럼 변경 금지 트리거
- anon/authenticated REVOKE DELETE/TRUNCATE 등

---

## 5. 금지 사항

- `auth.users`에 custom 컬럼 추가  
- profiles에 관리자 role CHECK를 “관리자 SSOT”로 삼기  
- anon/authenticated에게 admin_* WRITE/SELECT  
- 공개 RPC로 admin 승격  
- 첫 가입자 자동 admin  

---

## 6. 첫 admin bootstrap (권고 1개)

### 권고: **Supabase Dashboard SQL 수동 등록**

절차(구현·실행은 승인 후):
1. Auth에서 관리자용 사용자 생성(또는 기존 사용자 선택) — **이메일/UUID를 문서·채팅에 남기지 않음**
2. Dashboard SQL Editor에서 `admin_users` INSERT (`role='admin'`, `active=true`, `created_by=NULL`)
3. 동일 트랜잭션 또는 직후 `admin_role_history` INSERT (old null → new admin)
4. 앱에서 로그인 후 `/admin` 접근 확인

### 다른 후보 비교

| 방식 | 안전성 | 판정 |
|------|--------|------|
| Dashboard SQL 수동 | 최고 — 공개 엔드포인트 없음 | **권고** |
| 로컬 일회성 CLI + service_role | 양호 — 키·실수 주의 | 차선 |
| env 이메일 자동 승격 | 중 — 배포 실수·로그 위험 | 비권고 |
| 첫 가입자 자동 admin | 위험 | **금지** |
| 클라이언트 이메일 비교 | 위험 | **금지** |
| URL/공개 API bootstrap | 위험 | **금지** |

---

## 7. 적용 전 검증 (미래)

- [ ] migration SQL 줄 수·SHA 기록  
- [ ] CREATE admin_users / admin_role_history만  
- [ ] DROP/TRUNCATE/DELETE 실구문 0  
- [ ] profiles/products ALTER 0  
- [ ] REVOKE anon/authenticated  
- [ ] GitHub 백업  
- [ ] 사용자 승인  

## 8. 적용 후 검증 (미래)

- [ ] 두 테이블 존재, rows: admin≥1 예정, history≥1  
- [ ] RLS ON, 정책 0, anon/auth 권한 0  
- [ ] 비관리자 JWT로 SELECT 실패/빈 결과  
- [ ] 기존 products/ingredients/offers/11테이블 무변경  
- [ ] schema_migrations 기록  

## 9. “롤백” 원칙

- 테이블 DROP 금지 (기본)  
- 문제 시: 모든 admin `active=false` 또는 앱에서 admin 경로 비활성  
- 잘못된 role → history 남기고 교정 UPDATE (service_role/Dashboard만)

---

## 10. updated_at

- UPDATE 시 트리거 또는 애플리케이션이 `updated_at=now()`  
- 트리거 사용 시 함수는 security definer 최소화, search_path 고정

---

## 11. 이번 단계

**migration SQL 파일을 저장소에 만들지 않는다.**  
승인 후 `docs/46` 순서에 따라 작성한다.
