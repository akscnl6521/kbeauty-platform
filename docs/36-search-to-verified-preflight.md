# docs/36-search-to-verified-preflight.md — Migration 적용 전 원격 충돌 검사

최종 갱신: **2026-07-13**  
검사 방식: Supabase MCP **SELECT 전용** (apply/INSERT/UPDATE/DELETE/ALTER/CREATE/DROP 없음)  
대상 migration: `supabase/migrations/20260713030000_create_search_to_verified_pipeline.sql`  
원격 project ref: `rhfrmvkjsummaylpzmns`  
원격 URL: `https://rhfrmvkjsummaylpzmns.supabase.co`  
PostgreSQL: **17.6**

민감정보(API 키·service_role·비밀번호·토큰)는 본 문서에 기록하지 않는다.

---

## 1. 검사한 원격 테이블

| 테이블 | 존재 | 행 수 | 비고 |
|--------|------|------|------|
| products | 예 | 186 | 참조 대상 |
| ingredients | 예 | 40 | 참조 대상 |
| product_offers | 예 | 0 | 참조만, ALTER 없음 |
| brands | **아니오** | — | 생성 예정 |
| product_variants | **아니오** | — | |
| product_ingredients | **아니오** | — | |
| ingredient_aliases | **아니오** | — | |
| skin_concerns | **아니오** | — | |
| ingredient_evidence | **아니오** | — | |
| ingredient_cautions | **아니오** | — | |
| product_discovery_candidates | **아니오** | — | |
| verification_queue | **아니오** | — | |
| data_sources | **아니오** | — | |
| product_change_history | **아니오** | — | |

**가정 검증:** 신규 11테이블이 원격에 없다는 가정 → **사실로 확인됨 (PASS).**

---

## 2. FK 타입 검증

| 원격 컬럼 | 타입 | Identity | migration FK | 결과 |
|-----------|------|----------|--------------|------|
| products.id | bigint | ALWAYS | product_* .product_id bigint | PASS |
| ingredients.id | bigint | ALWAYS | ingredient_* .ingredient_id bigint | PASS |
| product_offers.id | uuid | none | (참조 안 함) | PASS |
| product_offers.product_id | bigint | none | (기존) | PASS |
| products.slug | UNIQUE | — | 변경 없음 | PASS |
| ingredients.slug | UNIQUE | — | 변경 없음 | PASS |

---

## 3. 객체 이름 충돌

검사한 migration 객체명(테이블·인덱스·constraint·예상 pkey·정책명)을 원격 `pg_class` / `pg_constraint` / `pg_policies` / 트리거 / 시퀀스에서 조회.

**충돌 결과: 0건 (빈 결과 집합).**

| 종류 | 예 | 원격 존재 |
|------|-----|-----------|
| 테이블 11개 | brands … | 없음 |
| UNIQUE/CHECK 이름 | brands_canonical_name_key 등 | 없음 |
| 인덱스 이름 | *_idx / *_uidx | 없음 |
| 정책 이름 | Allow client read approved * | 없음 |
| 관련 트리거/시퀀스 | brand/variant/… 패턴 | 없음 |

등급: **PASS**

---

## 4. Extension / 함수

| 항목 | 결과 |
|------|------|
| pgcrypto | 설치됨 (1.3) |
| uuid-ossp | 설치됨 (1.1) |
| gen_random_uuid() | 호출 성공 (`true`) |
| 함수 위치 | `pg_catalog.gen_random_uuid`, `extensions.gen_random_uuid` |
| PG 17.6 | IF NOT EXISTS / DO / ALTER POLICY / partial unique 지원 | PASS |

extension 신규 설치·변경: **하지 않음.**

등급: **PASS**

---

## 5. RLS와 권한

### 5.1 migration 공개 정책 (로컬 SQL 기준)

| 테이블 | 정책 | 공개 조건 |
|--------|------|-----------|
| brands | Allow client read approved brands | active + approved |
| product_variants | … approved product_variants | active + approved |
| product_ingredients | … approved product_ingredients | approved + verified_at + 공식 source_type + source_url |
| ingredient_aliases | … approved ingredient_aliases | active + approved |
| skin_concerns | … approved skin_concerns | active + approved |
| ingredient_evidence | … approved ingredient_evidence | approved + reviewed_at + (url\|pmid\|doi) |
| ingredient_cautions | … approved ingredient_cautions | active + approved + reviewed_at + evidence_source |
| discovery / queue / data_sources / history | **정책 없음** | 클라이언트 SELECT 불가 |

정책명 원격 충돌: **없음 (PASS).**

### 5.2 클라이언트 권한 (권한 보안 패치 후 — PASS)

로컬 migration 최종 형태:

1. 신규 **11테이블** 전부  
   `REVOKE ALL PRIVILEGES ON TABLE … FROM anon, authenticated;`  
2. 공개 **7테이블**만  
   `GRANT SELECT ON TABLE … TO anon, authenticated;`  
3. 관리자 **4테이블** — GRANT 없음  
4. `service_role` REVOKE 없음  

효과:

- default ACL의 arwdDxtm(TRUNCATE 포함)이 클라이언트에 남지 않음  
- INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 제거 후 SELECT만 재부여  
- RLS 정책이 미승인 행을 계속 필터  

| 평가 | 등급 |
|------|------|
| RLS로 행 공개 경로 통제 | PASS |
| 관리자 테이블 SELECT 정책·GRANT 없음 | PASS |
| REVOKE ALL → GRANT SELECT (TRUNCATE 제거) | **PASS** |
| service_role 유지 | PASS |

> 원격 `product_offers`의 TRUNCATE 잔여는 **기존 테이블** 이슈이며 본 migration 범위 밖.

---

## 6. UNIQUE / NULL 검토 (권한 패치와 함께 정리)

| 인덱스 | 방식 | NULL / 빈문자열 | 등급 |
|--------|------|-----------------|------|
| variants identity | `UNIQUE … NULLS NOT DISTINCT` + nonempty CHECK | NULL=미확인, `''` 금지 | **PASS** (의도) |
| aliases (normalized, lang) | 동일 | 동일 | **PASS** (의도) |
| data_sources (type, url) | partial `WHERE base_url IS NOT NULL` + nonempty CHECK | NULL URL 다수 허용 | **PASS** |
| pmid / doi / discovered_url | partial + nonempty CHECK | NULL 다수, 실값 unique | **PASS** |
| product_ingredients order | `COALESCE(variant_id, nil uuid)` | NULL=공통 전성분 버킷 | **PASS** (의도적 WARNING 아님 — 설계 유지) |

빈 문자열 저장은 CHECK로 차단. COALESCE('', '') 제거.

---

## 7. FK ON DELETE 동작

migration 전부 **ON DELETE RESTRICT**.

| 부모 | 자식 | ON DELETE | 운영 이력 관점 |
|------|------|-----------|----------------|
| products | product_variants | RESTRICT | 제품 hard delete 차단 |
| products | product_ingredients | RESTRICT | 동일 |
| products | discovery.linked_product_id | RESTRICT | 링크 있는 후보 있으면 삭제 차단 |
| products | product_change_history | RESTRICT | **이력 있는 제품 삭제 불가 → 이력 보존에 유리** |
| ingredients | aliases / evidence / cautions / product_ingredients | RESTRICT | 성분 hard delete 차단 |
| product_variants | product_ingredients | RESTRICT | variant 삭제 전 전성분 정리 필요 |
| product_variants | product_change_history | RESTRICT | 이력 보존 |
| skin_concerns | ingredient_evidence | RESTRICT | 근거 연결 시 고민 삭제 차단 |

평가: hard delete보다 soft-delete(`active=false`) 운영과 맞음.  
**WARNING:** 실수로 CASCADE가 아님을 운영자가 인지해야 함 (의도된 안전장치).

---

## 8. 재실행 안전성

| 구문 | 재실행 |
|------|--------|
| CREATE TABLE IF NOT EXISTS | 안전. **단 컬럼 추가 안 함** |
| CREATE INDEX IF NOT EXISTS | 안전 |
| CONSTRAINT in CREATE TABLE | 테이블이 이미 있으면 스킵 → 누락 CHECK 가능 |
| DO + EXISTS + CREATE/ALTER POLICY | 안전 (idempotent) |
| GRANT/REVOKE | 반복 가능 |

**WARNING:** 부분 실패 후 테이블만 생기고 정책/제약이 빠진 상태면 IF NOT EXISTS가 복구하지 못함 → 별도 ALTER migration 필요.  
현재 원격에 11테이블 없음 → **최초 적용은 안전 (PASS).**

---

## 9. Migration 순서

| 원격 적용됨 | version / name |
|-------------|----------------|
| 예 | `20260713022607` / `create_product_offers_and_catalog_extensions` |

로컬 파일명: `20260713030000_…` → 시간순으로 **이후** (PASS).  
로컬 `supabase/migrations`에도 `20260712000000` / `20260712010000` 등이 있으나, 원격 schema_migrations에는 product_offers 적용본만 기록됨 (대시보드/MCP 이름과 파일명 불일치 가능) → **WARNING** (적용 시 버전 문자열만 충돌하지 않으면 됨; `20260713030000` > `20260713022607`).

---

## 10. 상태값 · 문서 일치 (로컬 SQL vs docs/31~35)

| 집합 | 일치 |
|------|------|
| 공통 검토: pending/in_review/approved/rejected/needs_review | PASS |
| workflow_status 9값 | PASS |
| evidence_level 8값 (+insufficient) | PASS |
| source_type 10값 | PASS |
| offer verified 혼용 없음 (ingredients approved만) | PASS |

---

## 11. PASS / WARNING / BLOCKER 요약

### PASS

- 신규 11테이블 원격 미존재  
- FK 타입 bigint/uuid 일치  
- 객체명(테이블·인덱스·constraint·정책) 충돌 0  
- gen_random_uuid 사용 가능 + pgcrypto 존재  
- PG 17.6 문법 지원  
- 관리자 4테이블에 공개 SELECT 정책 없음 (SQL 설계)  
- 공개 7테이블 RLS 조건이 docs와 일치  
- PMID/DOI/URL partial unique NULL 허용  
- product_ingredients NULL variant order 유일성  
- migration 버전 순서가 기존 적용분 이후  
- 기존 products/ingredients/product_offers ALTER 없음 (SQL)  
- 운영 데이터 변경 SQL 없음  

### WARNING

1. ~~default ACL / TRUNCATE 잔여~~ → **수정됨 (PASS)**  
2. ~~COALESCE('', '') NULL 동일시~~ → **NULLS NOT DISTINCT + CHECK로 수정 (PASS)**  
3. CREATE TABLE IF NOT EXISTS는 불완전 스키마를 고치지 못함 (**WARNING 유지**)  
4. ON DELETE RESTRICT로 부모 hard delete가 막힘 — 의도적 (**WARNING 유지**)  
5. 원격 schema_migrations와 로컬 초기 파일 이력 불일치 가능 (**WARNING 유지**)  
6. product_ingredients `COALESCE(variant_id, sentinel)` — **의도적 설계 (PASS로 분류, 문서화)**  

### BLOCKER

**없음.**

---

## 12. Supabase 적용 가능 여부

**충돌·권한 관점: 적용 가능 (조건부).**  

아직 자동 적용하지 않는다. 권장 순서:

1. 사용자 최종 승인  
2. GitHub 백업 브랜치에 migration·문서 커밋  
3. staging/preview 또는 승인된 원격 apply  
4. 적용 후 검증 SQL (권한에 TRUNCATE 없는지 포함)

---

## 13. 적용 직전 체크리스트

- [x] 원격 11테이블 미존재 확인  
- [x] FK 타입 확인  
- [x] 이름 충돌 0  
- [x] gen_random_uuid 확인  
- [x] BLOCKER 없음  
- [x] REVOKE ALL + GRANT SELECT 권한 패치  
- [x] TRUNCATE 클라이언트 권한 제거 (정적)  
- [ ] 사용자 적용 승인  
- [ ] GitHub 백업  
- [ ] apply_migration 실행 (아직 금지)

---

## 14. 적용 후 검증 SQL (적용 시에만)

```sql
-- 11 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'brands','product_variants','product_ingredients','ingredient_aliases',
  'skin_concerns','ingredient_evidence','ingredient_cautions',
  'product_discovery_candidates','verification_queue','data_sources',
  'product_change_history'
) ORDER BY 1;

-- RLS on
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
  'brands','product_variants','product_ingredients','ingredient_aliases',
  'skin_concerns','ingredient_evidence','ingredient_cautions',
  'product_discovery_candidates','verification_queue','data_sources',
  'product_change_history'
);

-- policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND policyname LIKE 'Allow client read approved%'
ORDER BY 1;

-- admin tables: expect 0 policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND tablename IN (
  'product_discovery_candidates','verification_queue',
  'data_sources','product_change_history'
);

-- core row counts unchanged
SELECT 'products' t, count(*) FROM products
UNION ALL SELECT 'ingredients', count(*) FROM ingredients
UNION ALL SELECT 'product_offers', count(*) FROM product_offers;

-- grants sample
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('brands','product_discovery_candidates')
  AND grantee IN ('anon','authenticated')
ORDER BY 2,1,3;
```

---

## 15. 결론

| 항목 | 결과 |
|------|------|
| 원격 충돌 | 없음 |
| BLOCKER | 0 |
| WARNING | IF NOT EXISTS 한계 · ON DELETE RESTRICT(의도) · schema_migrations 이력 |
| default ACL/TRUNCATE | **PASS** (REVOKE ALL + GRANT SELECT) |
| COALESCE/NULL | **PASS** (NULLS NOT DISTINCT + nonempty CHECK; ingredients sentinel 의도 유지) |
| 적용 | **승인·백업 후 가능 / 지금은 미적용** |
