# docs/35-search-to-verified-migration-review.md — Migration 초안 검토

최종 갱신: 2026-07-13  
상태: **로컬 초안만** — 원격 Supabase **미적용**  
Migration 파일: `supabase/migrations/20260713030000_create_search_to_verified_pipeline.sql`  
근거 문서: `docs/31` ~ `docs/34`

---

## 1. 상태값 통일 (최종)

### 공통 검토 상태

`pending` | `in_review` | `approved` | `rejected` | `needs_review`

| 구분 | 사용 |
|------|------|
| 관리자 검토 결과 / 공개 게이트 | **`approved`** |
| 판매처 offer (기존) | **`verified`** / unverified / invalid / unavailable |
| 파이프라인 단계명 | `workflow_status.verified` (offer verified와 **다른 의미**) |

**혼용 금지:** 신규 테이블 공개 조건에 offer의 `verified`를 쓰지 않는다.  
`product_ingredients.verification_status`는 공통 검토 상태이며 공개는 **`approved`만**.

---

## 2. 생성 테이블 11개 · RLS 공개 조건

| # | 테이블 | 클라이언트 SELECT |
|---|--------|-------------------|
| 1 | brands | `active` AND `verification_status='approved'` |
| 2 | product_variants | `active` AND `verification_status='approved'` |
| 3 | product_ingredients | `verification_status='approved'` AND `verified_at` AND 공식 `source_type` AND 비어 있지 않은 `source_url` |
| 4 | ingredient_aliases | `active` AND `review_status='approved'` |
| 5 | skin_concerns | `active` AND `review_status='approved'` |
| 6 | ingredient_evidence | `review_status='approved'` AND `reviewed_at` AND (`source_url` OR `pmid` OR `doi`) |
| 7 | ingredient_cautions | `active` AND `review_status='approved'` AND `reviewed_at` AND 비어 있지 않은 `evidence_source` |
| 8–11 | discovery / queue / data_sources / history | **비공개** (REVOKE ALL, GRANT 없음) |

- 신규 11테이블 전부: `REVOKE ALL PRIVILEGES … FROM anon, authenticated`  
- 공개 7테이블만: `GRANT SELECT`  
- 관리자 4테이블: GRANT 없음 → TRUNCATE 포함 클라이언트 권한 없음  
- `service_role` REVOKE 없음  
- SELECT만으로 미승인 행 공개 안 됨 (RLS USING 유지) 

---

## 3. 수정된 테이블·컬럼 (이번 정합성 패치)

| 테이블 | 변경 |
|--------|------|
| product_variants | `verification_status` 추가, RLS에 approved 요구 |
| product_ingredients | `verified`/`unverified` CHECK 제거, approved-only + 공식출처 CHECK |
| ingredient_aliases | `review_status` 추가 |
| skin_concerns | `review_status` 추가 (운영 기준 데이터) |
| ingredient_cautions | `review_status` + approved 시 evidence_source/reviewed_at CHECK |
| ingredient_evidence | approved 시 citation+reviewed_at CHECK, RLS 강화 |
| verification_queue.status | open/deferred 제거 → 공통 5값만 |

---

## 4. 제약조건 · NULL · 권한 검토

| 제약 | 처리 |
|------|------|
| PMID/DOI unique | partial unique `WHERE … IS NOT NULL` + 빈문자열 CHECK 금지 |
| discovered_url / data_sources base_url | 동일 |
| aliases / variants identity | **`NULLS NOT DISTINCT`** + 빈문자열 CHECK (COALESCE('', '') 제거) |
| product_ingredients order | `COALESCE(variant_id, sentinel)` **의도적 유지** (NULL=공통 전성분) |
| approved 무결성 | product_ingredients / evidence / cautions CHECK |

### 권한 (default ACL 대응)

```
REVOKE ALL PRIVILEGES ON TABLE public.<each of 11> FROM anon, authenticated;
GRANT SELECT ON TABLE public.<each of 7 public> TO anon, authenticated;
-- admin 4: no GRANT
```

→ anon/authenticated에 **TRUNCATE 없음**. service_role 유지.

### SEQUENCE

신규 PK는 uuid/`gen_random_uuid()` → **신규 sequence 없음**.

### CREATE TABLE IF NOT EXISTS 한계

- 이미 존재하는 불완전 테이블에 새 컬럼을 추가하지 않는다.  
- 원격에 현재 이 11테이블이 없으므로 최초 적용은 가능.  
- 부분 실패 후 재적용 시 컬럼 드리프트가 있으면 별도 ALTER migration 필요.

---

## 5. 문서와 SQL 일치 여부

| 문서 | 일치 |
|------|------|
| docs/31 상태·RLS | 이번 패치로 SQL과 맞춤 |
| docs/32 ERD 필드 | verification_status / review_status 반영 |
| docs/33 review_status | `in_review` 포함, 공개 조건 명시 |
| docs/34 용어 구분 | approved vs offer verified vs workflow verified |
| docs/35 | 본 문서 |

---

## 6. 외래키 (변경 없음)

bigint → products/ingredients, uuid → variants/concerns. queue는 entity_type+entity_id.  
`products.brand_id` / `product_offers.variant_id`는 여전히 향후 별도 migration.

---

## 7. 적용 전 체크리스트

- [x] 공통 검토 상태 통일  
- [x] verified/approved 혼용 제거 (offers 제외)  
- [x] RLS 공개 조건 강화  
- [ ] 사용자 최종 검토  
- [ ] GitHub 백업 커밋 (요청 시)  
- [ ] 원격 적용 승인 (아직 금지)  

안전 재검사 (로컬 SQL):

- DROP / TRUNCATE / DELETE 실구문: 목표 0  
- 정책 upsert 비지원 문법: 목표 0  
- products/ingredients/product_offers ALTER: 0  

---

## 8. 적용 후 검증 SQL (지금은 실행하지 않음)

```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'brands','product_variants','product_ingredients','ingredient_aliases',
    'skin_concerns','ingredient_evidence','ingredient_cautions'
  )
ORDER BY 1, 2;

SELECT 'products' t, count(*) FROM products
UNION ALL SELECT 'ingredients', count(*) FROM ingredients
UNION ALL SELECT 'product_offers', count(*) FROM product_offers;
```

---

## 9. 롤백 전략

적용 전: 파일 revert면 충분.  
적용 후: 신규 11테이블 DROP은 **별도 승인된 롤백 migration**만 (본 초안에 DROP 없음).

---

## 10. 남은 위험

| 위험 | 완화 |
|------|------|
| workflow `verified` 용어 혼동 | 문서·주석으로 offer verified와 구분 |
| IF NOT EXISTS 컬럼 미추가 | §4 명시, 최초 적용만 가정 |
| sentinel uuid for NULL variant | 의도적 (공통 전성분); nil UUID 예약 |
| ON DELETE RESTRICT | 의도적 — hard delete 전 연결 정리 |
| default ACL | REVOKE ALL + GRANT SELECT로 대응 완료 |

---

## 11. Supabase 적용 가능 여부

**아직 적용하지 않는다.**  
스키마 정합성은 로컬 초안 기준 통과. 사용자 검토 + GitHub 백업 후 staging 적용을 권장.
