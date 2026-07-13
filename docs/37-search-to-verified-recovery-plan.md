# docs/37-search-to-verified-recovery-plan.md — 부분 적용 복구 (A안)

최종 갱신: 2026-07-13  
상태: **로컬 보완 migration 작성 완료 / 원격 미적용**  
예정 apply 이름: `complete_search_to_verified_pipeline`  
파일: `supabase/migrations/20260713034000_complete_search_to_verified_pipeline.sql`

---

## 1. 부분 실패 원인

`apply_migration` 호출 시 원본 SQL **전체가 아니라 brands CREATE 일부만** 전달되어  
원격에 불완전 migration이 기록됨.

| 항목 | 값 |
|------|-----|
| 부분 migration version | `20260713032925` |
| 이름 | `create_search_to_verified_pipeline` |
| 실제 생성 | `public.brands`만 |
| 의도 | 11테이블 + RLS + 권한 |

원본 로컬 파일 `20260713030000_create_search_to_verified_pipeline.sql`은 **수정하지 않음**.  
원격 `schema_migrations` 이력도 **삭제·수정하지 않음**.

---

## 2. 원격 현재 상태 (SELECT 확인)

| 항목 | 결과 |
|------|------|
| project | `rhfrmvkjsummaylpzmns` |
| brands rows | 0 |
| brands RLS | **OFF** |
| brands 정책 | 0 |
| anon/authenticated on brands | INSERT/UPDATE/DELETE/**TRUNCATE**/… 전부 (**위험**) |
| 나머지 10테이블 | **없음** |
| products / ingredients / product_offers | 186 / 40 / 0 유지 |

---

## 3. brands 구조 비교 (원본 vs 원격)

| 분류 | 결과 |
|------|------|
| 이미 존재 | 컬럼 13개 전부 (id uuid … updated_at) 타입·nullable·default 일치 |
| PK / UNIQUE | brands_pkey, brands_canonical_name_key |
| CHECK | verification_status + nonempty 3개 모두 존재 |
| INDEX | verification_status / active / country_code 존재 |
| 타입 불일치 | **없음** |
| constraint 누락 | **없음** |
| index 누락 | **없음** |
| 구조 ALTER 필요 | **없음** |
| 권한 위험 | **있음** (default ACL) |
| RLS 누락 | **있음** (ENABLE + 정책) |

→ 보완 migration은 brands에 대해 **보안 잠금만** 수행한다.

---

## 4. A안 선택 이유

- brands DROP 없이 이력·데이터(0행) 보존  
- 불완전 `20260713032925` 이력 유지 (직접 수정 금지)  
- 새 migration으로 누락분·보안만 완성  
- 롤백(DROP)보다 운영 리스크 낮음  

---

## 5. 보완 migration 실행 순서

1. **A.** brands: ENABLE RLS → REVOKE ALL → 정책(approved) → GRANT SELECT  
2. **B.** brands 구조 ALTER 없음 (일치)  
3. **C.** 나머지 10테이블 CREATE IF NOT EXISTS (+ indexes/constraints)  
4. **D.** 11테이블 RLS ENABLE + 공개 7 정책 + 11 REVOKE ALL + 7 GRANT SELECT  

`service_role` REVOKE 없음.

---

## 6. 파일 무결성 (부분 전송 사고 방지)

| 항목 | 값 |
|------|-----|
| 경로 | `supabase/migrations/20260713034000_complete_search_to_verified_pipeline.sql` |
| 줄 수 | **857** |
| SHA-256 | `96f863f8147aca05cd76a639febda6ea93b142492cdd86d83cd5953ae70d1074` |
| 첫 줄 | `-- Complete Search-to-Verified-Product Pipeline after partial apply.` |
| 끝 줄 | `-- Apply only after human review + GitHub backup. Do not run against production yet.` |
| CREATE TABLE 10개 | product_variants … product_change_history |
| CREATE TABLE brands | **0** (의도) |
| ALTER brands ENABLE RLS | 선두(L16) + 후반 일괄(L613 부근) |
| REVOKE ALL 문장 수 | **12** (고유 테이블 **11**) |
| GRANT SELECT 문장 수 | **8** (고유 테이블 **7**) |

### REVOKE / GRANT 12회·8회 원인 (권한 감사 2026-07-13)

**판정 A — 의도적·idempotent 중복. SQL 수정 불필요.**

| 구간 | REVOKE brands | GRANT brands |
|------|---------------|--------------|
| 선두 보안 잠금 (L18, L40) | 1 | 1 |
| 후반 통합 권한 (L836, L848) | 1 | 1 |

- 고유 REVOKE 대상: 정확히 **11** (정상 목록과 일치)  
- 고유 GRANT SELECT 대상: 정확히 **7** (공개 목록과 일치)  
- 관리자 4테이블 GRANT: **0**  
- 역할: `anon, authenticated`만. `service_role` / `PUBLIC` 실구문 REVOKE·GRANT **0**  
- 선두 brands 잠금 목적: 10테이블 CREATE 전에 **보안 노출 시간 최소화**  
- 후반 통합 구간 brands 재호출: 전체 11테이블 권한 일괄 정리·idempotent (기능·보안 결과 동일)

가독성용으로 후반에서 brands만 제외해도 결과는 같으나, **필수가 아니므로 현재 SQL 유지**.

### brands 선두 잠금 순서

1. `ENABLE ROW LEVEL SECURITY` (L16)  
2. `REVOKE ALL` (L18)  
3. SELECT 정책 CREATE/ALTER (L20–38)  
4. `GRANT SELECT` (L40)  
5. 이후 10테이블 CREATE …

→ RLS를 먼저 켠 뒤 권한을 좁히므로, 중간 순간에도 기본 ACL이 열려 있어도 행 단위로 차단된다.

### 트랜잭션 원자성

Supabase MCP `apply_migration`은 일반적으로 **단일 트랜잭션**으로 DDL을 실행한다.  
중간 실패 시 전체가 롤백되어 brands 잠금만 남는 상태가 되지 않아야 한다.  
성공 불명확 시 **재실행 금지** — 상태 SELECT 후 보고.

### 단일 payload 준비

파일 전체(857줄)를 apply_migration `query`에 **한 번에** 전달해야 한다.  
일부만 보내면 재부분 실패가 난다. SHA-256으로 전달 전 무결성 확인.

---

## 7. 적용 전 검증 (다음 단계)

- [ ] SHA-256 재확인  
- [ ] 원격 10테이블 여전히 없음  
- [ ] brands rows=0, RLS 여전히 OFF(적용 전)  
- [ ] 사용자 승인  
- [ ] GitHub 백업 (요청 시)  
- [ ] apply_migration에 **파일 전체** 전달 (일부 금지)  

---

## 8. 적용 후 검증 SQL (적용 시에만)

```sql
-- 11 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'brands','product_variants','product_ingredients','ingredient_aliases',
  'skin_concerns','ingredient_evidence','ingredient_cautions',
  'product_discovery_candidates','verification_queue','data_sources',
  'product_change_history'
) ORDER BY 1;

-- brands RLS + policy
SELECT relrowsecurity FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname='brands';
SELECT policyname, qual FROM pg_policies
WHERE schemaname='public' AND tablename='brands';

-- privileges: public 7 = SELECT only; admin 4 = none for anon
SELECT grantee, table_name, string_agg(privilege_type,',' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN (
    'brands','product_variants','product_ingredients','ingredient_aliases',
    'skin_concerns','ingredient_evidence','ingredient_cautions',
    'product_discovery_candidates','verification_queue','data_sources',
    'product_change_history'
  )
  AND grantee IN ('anon','authenticated')
GROUP BY 1,2 ORDER BY 2,1;

-- core unchanged
SELECT 'products' t, count(*) FROM products
UNION ALL SELECT 'ingredients', count(*) FROM ingredients
UNION ALL SELECT 'product_offers', count(*) FROM product_offers;

SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

---

## 9. 실패 시 원칙

- apply **1회만**  
- 성공 불명확 → **재실행 금지**, 상태 보고 후 대기  
- 임의 SQL 수정·부분 수동 CREATE 금지  
- brands DROP / schema_migrations 직접 수정 금지  

---

## 10. 예상 결과

| 항목 | 예상 |
|------|------|
| 신규 migration name | `complete_search_to_verified_pipeline` |
| 테이블 수 | 11 (brands 유지 + 10 신규) |
| 공개 권한 | 7테이블 SELECT only |
| 비공개 권한 | 4테이블 anon/authenticated 권한 없음 |
| brands TRUNCATE | 제거됨 |
| 기존 3테이블 | 무변경 |

---

## 11. BLOCKER / 적용 가능 여부

| 항목 | 상태 |
|------|------|
| 10테이블 미존재 | 확인됨 |
| brands 구조 일치 | 확인됨 |
| 로컬 보완 SQL | 작성됨 |
| BLOCKER (로컬 단계) | **없음** |
| 원격 apply | **아직 금지** — 사용자 승인 후 |
