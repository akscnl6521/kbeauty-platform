# docs/31-search-to-verified-data-model.md — Search-to-Verified-Product 데이터 모델

최종 갱신: 2026-07-13  
상태: **설계 전용** (migration 미작성·원격 DB 미적용)  
상위: `MASTER_PLAN.md`, `docs/20-data-source-verification.md`, `docs/11-product-retailer-offer.md`

---

## 0. 설계 전제 (원격 DB 실측 2026-07-13)

| 테이블 | PK | 행 수 | 비고 |
|--------|-----|------|------|
| `products` | `id bigint` IDENTITY ALWAYS | 186 | `brand`는 text. slug UNIQUE |
| `ingredients` | `id bigint` IDENTITY ALWAYS | 40 | slug UNIQUE. 논문은 paper_1/2 평면 컬럼 |
| `product_offers` | `id uuid` | 0 | `product_id bigint` → `products(id)` ON DELETE RESTRICT |

**원칙**

1. `products`를 교체하지 않는다. `products.id bigint`를 기준키로 유지한다.  
2. `ingredients`를 유지·확장한다 (aliases / evidence / cautions).  
3. `product_offers`는 판매처·가격·재고·구매 링크 전용으로 유지한다.  
4. 신규 테이블 PK는 `uuid` (운영·큐·발견 후보). 기존 엔티티 FK는 `bigint`/`uuid`를 원격 타입에 맞춘다.  
5. 이번 문서는 설계만 하며 **migration SQL을 생성하지 않는다.**

---

## 1. 역할 분리 요약

| 레이어 | 테이블 | 역할 |
|--------|--------|------|
| 기존 | `products` | 제품 본체 (이름·카테고리·레거시 필드) |
| 기존 | `ingredients` | 성분 마스터 |
| 기존 | `product_offers` | 판매처·가격·재고·URL |
| 신규 | `brands` | 공식 브랜드명·출처 |
| 신규 | `product_variants` | 용량·국가·리뉴얼·성분 버전 |
| 신규 | `product_ingredients` | 전성분 순서 연결 |
| 신규 | `ingredient_aliases` | INCI·다국어·동의어 |
| 신규 | `skin_concerns` | 피부 고민 표준 코드 |
| 신규 | `ingredient_evidence` | 성분–고민 논문 근거 |
| 신규 | `ingredient_cautions` | 자극·알레르기·주의 |
| 신규 | `product_discovery_candidates` | 검색 후보·워크플로 상태 |
| 신규 | `verification_queue` | 관리자 검토 대기 |
| 신규 | `data_sources` | 출처·신뢰도 |
| 신규 | `product_change_history` | 변경 이력 |

---

## 2. 기존 테이블 연결 방식 (비파괴)

### 2.1 products (유지)

향후 migration에서 **선택 컬럼만 추가**하는 방향 (이번 작업에서는 실행하지 않음):

| 추가 후보 | 타입 | 설명 |
|-----------|------|------|
| `brand_id` | uuid NULL → `brands(id)` | text `brand`와 병행 후 점진 이관 |
| `pipeline_status` | text | `discovered`…`published` / `rejected` / `needs_review` |
| `published_at` | timestamptz NULL | published 전환 시각 |
| `primary_source_id` | uuid NULL → `data_sources(id)` | 공식 전성분·제품 출처 |

레거시 `full_ingredients text[]`, `key_ingredients text[]`, `link_*`, `price_usd`는 당분간 유지.  
구조화 전성분의 정본은 `product_ingredients`로 옮긴다.  
판매 정본은 `product_offers`이다.

### 2.2 ingredients (유지)

`paper_1_*` / `paper_2_*`는 레거시 표시용으로 유지.  
신규 근거 정본은 `ingredient_evidence`.  
표시명 확장은 `ingredient_aliases`.  
주의사항 구조화는 `ingredient_cautions` (기존 `caution*` 텍스트와 병행).

### 2.3 product_offers (유지)

컬럼·RLS·CHECK 그대로.  
향후 선택: `variant_id uuid NULL → product_variants(id)`, `data_source_id uuid NULL`.

---

## 3. 신규 테이블 정의

공통 규칙:

- 시간: `timestamptz`, 기본값 `now()`  
- RLS: ENABLE. anon/authenticated는 **published(또는 공개 가능) SELECT만**. 쓰기는 service_role(또는 향후 관리자 정책)  
- 가짜 데이터 금지. 출처 URL·확인일 없는 판매·전성분·효능 단정 금지  

### 3.1 brands

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| canonical_name | text | NO | — | 공식 표기 (번역 금지) |
| name_ko | text | YES | NULL | 표시용 (브랜드 공식 한글이 있을 때만) |
| name_en | text | YES | NULL | |
| name_ja | text | YES | NULL | |
| official_website | text | YES | NULL | HTTPS |
| country_code | text | YES | NULL | KR/US/JP/… |
| verification_status | text | NO | `'pending'` | pending / in_review / approved / rejected / needs_review |
| source_url | text | YES | NULL | |
| verified_at | timestamptz | YES | NULL | 관리자 승인 시각(메타). offer의 verified와 혼동 금지 |
| active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

- UNIQUE: `canonical_name` (대소문자 정규화는 앱/인덱스 규칙으로 별도)  
- INDEX: `(verification_status)`, `(active)`  
- FK: 없음 (products.brand_id가 추후 참조)

### 3.2 product_variants

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| product_id | bigint | NO | — | FK → `products(id)` RESTRICT |
| country_code | text | YES | NULL | KR/US/JP |
| size_value | numeric | YES | NULL | |
| size_unit | text | YES | NULL | ml, g, ea… |
| variant_name | text | YES | NULL | |
| formula_version | text | YES | NULL | 성분 버전 키 |
| package_version | text | YES | NULL | |
| launch_date | date | YES | NULL | |
| discontinued_at | date | YES | NULL | |
| verification_status | text | NO | `'pending'` | pending…needs_review (관리자 검토) |
| active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

- UNIQUE 후보: `(product_id, country_code, variant_name, formula_version)` (NULL은 COALESCE 인덱스)
- INDEX: `(product_id)`, `(country_code)`, `(active)`, `(verification_status)`
- 클라이언트 SELECT: `active = true AND verification_status = 'approved'`
- 리뉴얼·국가별 용량 차이는 variant로만 표현. 제품 본체는 하나로 유지.

### 3.3 product_ingredients

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| product_id | bigint | NO | — | FK → products |
| variant_id | uuid | YES | NULL | FK → product_variants. NULL=제품 공통 전성분 |
| ingredient_id | bigint | NO | — | FK → ingredients |
| ingredient_order | integer | NO | — | 1부터, 전성분 표기 순서 |
| is_key_ingredient | boolean | NO | false | |
| declared_concentration | numeric | YES | NULL | |
| concentration_unit | text | YES | NULL | %, ppm… |
| concentration_disclosed | boolean | NO | false | |
| source_url | text | YES | NULL | |
| source_type | text | YES | NULL | label/official/retailer/admin |
| verified_at | timestamptz | YES | NULL | approved 시 필수 |
| verification_status | text | NO | `'pending'` | pending…needs_review (**approved만 공개**. offer verified와 혼용 금지) |
| created_at | timestamptz | NO | now() | |

- UNIQUE: `(product_id, COALESCE(variant_id, sentinel), ingredient_order)` — variant_id NULL도 순서 중복 방지  
- INDEX: `(product_id, ingredient_order)`, `(ingredient_id)`, `(verification_status)`, `(product_id, variant_id)`  
- approved 시 CHECK: `verified_at` + 비어 있지 않은 `source_url` + `source_type ∈ (official_brand_page, official_label, official_retailer)`  
- 클라이언트 SELECT: approved + 공식 출처 + verified_at  
- **전성분 순서 보존이 핵심.** 공식 출처 없는 전성분은 published 금지 조건에 사용.

### 3.4 ingredient_aliases

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| ingredient_id | bigint | NO | — | FK → ingredients |
| alias | text | NO | — | 원문 표기 |
| language_code | text | YES | NULL | ko/en/ja/inci |
| alias_type | text | NO | `'synonym'` | inci/common/ko/en/ja/misspelling |
| normalized_alias | text | NO | — | 소문자·공백 정규화 키 |
| active | boolean | NO | true | |
| review_status | text | NO | `'pending'` | pending…needs_review |
| created_at | timestamptz | NO | now() | |

- UNIQUE: `(normalized_alias, COALESCE(language_code,''))`  
- INDEX: `(ingredient_id)`, `(normalized_alias)`, `(active)`, `(review_status)`  
- 클라이언트 SELECT: `active = true AND review_status = 'approved'` (검토 전 alias 비공개)

### 3.5 skin_concerns

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| code | text | NO | — | flush, barrier, dryness… |
| name_ko | text | NO | — | |
| name_en | text | NO | — | |
| category | text | YES | NULL | cosmetic / borderline / refer_expert |
| medical_boundary | text | YES | NULL | 전문가 상담 우선 사유 |
| active | boolean | NO | true | |
| review_status | text | NO | `'pending'` | pending…needs_review (운영 기준 데이터) |
| created_at | timestamptz | NO | now() | |

- UNIQUE: `code`  
- 클라이언트 SELECT: `active = true AND review_status = 'approved'`  
- `products.skin_concern text[]`와 병행. 점진적으로 code 매핑.

### 3.6 ingredient_evidence

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| ingredient_id | bigint | NO | — | FK → ingredients |
| concern_id | uuid | YES | NULL | FK → skin_concerns |
| evidence_type | text | NO | — | cosmetic_study / drug_study / guideline / claim |
| study_design | text | YES | NULL | systematic_review, rct, … |
| population | text | YES | NULL | |
| concentration | text | YES | NULL | 연구 농도 (자유 텍스트+구조화는 추후) |
| formulation | text | YES | NULL | |
| usage_frequency | text | YES | NULL | |
| study_duration | text | YES | NULL | |
| outcome_summary | text | YES | NULL | 사실 요약, 마케팅 문구 금지 |
| evidence_level | text | NO | — | 정책 문서 33 참조 |
| pmid | text | YES | NULL | |
| doi | text | YES | NULL | |
| journal | text | YES | NULL | |
| publication_year | integer | YES | NULL | |
| conflict_of_interest | text | YES | NULL | none/disclosed/unknown/high |
| source_url | text | YES | NULL | |
| reviewed_by | text | YES | NULL | 운영자 표시명 (개인정보 최소) |
| reviewed_at | timestamptz | YES | NULL | |
| review_status | text | NO | `'pending'` | pending / in_review / approved / rejected / needs_review |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

- INDEX: `(ingredient_id, concern_id)`, `(evidence_level)`, `(review_status)`, `(publication_year)`  
- Partial UNIQUE: 비어 있지 않은 `pmid` / `doi` 각각 unique (둘 다 NULL 허용)  
- approved 시 CHECK: `reviewed_at` + (`source_url` OR `pmid` OR `doi`)  
- 클라이언트 SELECT: 동일 조건  
- **제품 추천 테이블이 아님.** 성분–고민 근거만 저장.  
- `evidence_level` ≠ `review_status` (분리 필수).  
- 논문 1건으로 제품 효능 확정 금지 (앱·운영 규칙).

### 3.7 ingredient_cautions

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| ingredient_id | bigint | NO | — | FK → ingredients |
| caution_type | text | NO | — | irritation/allergy/sensitive/pregnancy/lactation/interaction |
| severity | text | NO | `'moderate'` | low/moderate/high/refer_expert |
| condition | text | YES | NULL | 적용 조건 |
| description | text | NO | — | |
| evidence_source | text | YES | NULL | approved 시 필수 |
| reviewed_at | timestamptz | YES | NULL | approved 시 필수 |
| review_status | text | NO | `'pending'` | pending…needs_review |
| active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |

- INDEX: `(ingredient_id, caution_type)`, `(severity, active)`, `(review_status)`  
- approved 시 CHECK: `reviewed_at` + 비어 있지 않은 `evidence_source`  
- 클라이언트 SELECT: active + approved + evidence_source + reviewed_at  
- 근거·검토일 없는 주의사항은 공개하지 않는다.

### 3.8 product_discovery_candidates

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| discovered_name | text | NO | — | |
| discovered_brand | text | YES | NULL | |
| discovered_url | text | YES | NULL | HTTPS 권장 |
| discovered_country | text | YES | NULL | KR/US/JP |
| source_type | text | YES | NULL | search/manual/feed |
| search_query | text | YES | NULL | |
| discovered_at | timestamptz | NO | now() | |
| sale_check_status | text | NO | `'pending'` | pending/pass/fail |
| ingredient_check_status | text | NO | `'pending'` | |
| evidence_check_status | text | NO | `'pending'` | |
| safety_check_status | text | NO | `'pending'` | |
| duplicate_check_status | text | NO | `'pending'` | |
| workflow_status | text | NO | `'discovered'` | 아래 enum |
| linked_product_id | bigint | YES | NULL | FK → products |
| assigned_to | text | YES | NULL | 운영 표시명 |
| notes | text | YES | NULL | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**workflow_status**

`discovered` | `sale_checked` | `ingredients_checked` | `evidence_checked` | `safety_checked` | `verified` | `published` | `rejected` | `needs_review`

- INDEX: `(workflow_status)`, `(discovered_country)`, `(linked_product_id)`, `(discovered_at DESC)`  
- client SELECT 금지 권장 (관리자/service_role만).

### 3.9 verification_queue

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| entity_type | text | NO | — | candidate/product/offer/ingredient/evidence |
| entity_id | text | NO | — | uuid 또는 bigint 문자열 (다형) |
| review_type | text | NO | — | sale/ingredients/evidence/safety/publish |
| priority | integer | NO | 100 | 낮을수록 우선 |
| status | text | NO | `'pending'` | pending / in_review / approved / rejected / needs_review |
| assigned_to | text | YES | NULL | |
| reason | text | YES | NULL | |
| reviewer_notes | text | YES | NULL | |
| created_at | timestamptz | NO | now() | |
| reviewed_at | timestamptz | YES | NULL | |

- INDEX: `(status, priority, created_at)`, `(entity_type, entity_id)`  
- client SELECT 금지.

### 3.10 data_sources

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| source_type | text | NO | — | official_mall/label/paper/retailer/admin |
| source_name | text | NO | — | |
| base_url | text | YES | NULL | |
| country_code | text | YES | NULL | |
| trust_level | text | NO | `'medium'` | high/medium/low |
| official | boolean | NO | false | |
| active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |

- UNIQUE 후보: `(source_type, source_name, country_code)`  
- INDEX: `(trust_level, official)`

### 3.11 product_change_history

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| product_id | bigint | YES | NULL | FK → products |
| variant_id | uuid | YES | NULL | FK → product_variants |
| change_type | text | NO | — | name/ingredients/price/status/source |
| old_value | jsonb | YES | NULL | |
| new_value | jsonb | YES | NULL | |
| source_url | text | YES | NULL | |
| detected_at | timestamptz | NO | now() | |
| reviewed_at | timestamptz | YES | NULL | |
| approved_by | text | YES | NULL | |

- INDEX: `(product_id, detected_at DESC)`, `(change_type)`  
- client SELECT 금지 또는 관리자만.

---

## 4. 상태값 정리

### 공통 검토 상태 (신규 테이블)

`pending` | `in_review` | `approved` | `rejected` | `needs_review`

- 관리자 검토 결과 공개 게이트는 **`approved`**  
- **`verified`와 `approved`를 혼용하지 않는다**

| 대상 | 필드 | 값 |
|------|------|-----|
| 후보 파이프라인 | workflow_status | discovered → … → **verified**(단계명) → published (+ rejected, needs_review). 여기서 verified는 **파이프라인 단계**이며 offer verified와 다름 |
| brands / variants / product_ingredients | verification_status | 공통 검토 상태. 공개는 **approved** |
| aliases / skin_concerns / evidence / cautions | review_status | 공통 검토 상태. 공개는 **approved** (+ 표별 추가 조건) |
| offer (기존) | verification_status | **verified** / unverified / invalid / unavailable (변경 없음) |
| offer | stock_status | in_stock / out_of_stock / unknown (기존) |
| evidence | evidence_level | docs/33 (+ insufficient) |
| queue | status | 공통 검토 상태 |

**workflow verified ≠ published ≠ offer verified**  
관리자 게이트(approved / workflow verified) 후, 판매·전성분·공개 조건을 충족할 때만 published.  
핵심 추천: **published 제품 + 국가별 verified offer**만.

---

## 5. RLS 설계 방향 (최소 권한)

| 테이블 | anon/authenticated | 쓰기 |
|--------|-------------------|------|
| products (향후) | pipeline published 권장 (현재 전체 SELECT — 점진 강화) | service_role |
| ingredients | 공개 마스터 SELECT 유지 가능 | service_role |
| product_offers | 기존: active+**verified**+in_stock | service_role |
| brands | active + verification_status=**approved** | service_role |
| product_variants | active + verification_status=**approved** | service_role |
| product_ingredients | **approved** + 공식 출처 + verified_at | service_role |
| ingredient_aliases | active + review_status=**approved** | service_role |
| skin_concerns | active + review_status=**approved** | service_role |
| ingredient_evidence | **approved** + (url\|pmid\|doi) + reviewed_at | service_role |
| ingredient_cautions | active + **approved** + evidence_source + reviewed_at | service_role |
| discovery / queue / history / data_sources | **SELECT 금지** | service_role |

개인정보·운영자 계정 테이블은 이번 설계 범위 밖.

---

## 6. 타입 호환성 체크리스트

| FK | 타입 | 대상 |
|----|------|------|
| product_variants.product_id | bigint | products.id |
| product_ingredients.product_id | bigint | products.id |
| product_ingredients.variant_id | uuid | product_variants.id |
| product_ingredients.ingredient_id | bigint | ingredients.id |
| ingredient_aliases.ingredient_id | bigint | ingredients.id |
| ingredient_evidence.ingredient_id | bigint | ingredients.id |
| ingredient_evidence.concern_id | uuid | skin_concerns.id |
| ingredient_cautions.ingredient_id | bigint | ingredients.id |
| product_discovery_candidates.linked_product_id | bigint | products.id |
| product_offers.product_id | bigint | products.id (기존) |
| product_change_history.product_id | bigint | products.id |

로컬 JSON `productId` 문자열(slug) ≠ DB `bigint`. 등록 시 매핑 테이블/컬럼 필요 (앱 구현은 이후).

---

## 7. published 게이트 (데이터 조건)

모두 충족해야 published 허용:

1. 실제 판매 확인 (offer 또는 판매 검증 기록)  
2. 공식(또는 trust high) 전성분 출처  
3. `product_ingredients` 순서 검증  
4. 안전성 검토 완료  
5. 관리자 verified  
6. 중복 검사 pass  
7. 의료 경계 해당 시 전문가 분기 메타 존재 (추천 억제)

---

## 8. 관련 문서

- ERD: `docs/32-search-to-verified-erd.md`  
- 근거 수준: `docs/33-evidence-level-policy.md`  
- 워크플로: `docs/34-product-verification-workflow.md`
