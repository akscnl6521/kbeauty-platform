# docs/34-product-verification-workflow.md — 제품 검증 워크플로

최종 갱신: 2026-07-13  
상태: **설계 전용**  
관련: `docs/20-data-source-verification.md`, `docs/31-…`, `docs/32-…`, `docs/33-…`

---

## 1. 목표

검색으로 찾은 실제 판매 제품을  
**판매 확인 → 전성분 → 중복 → 근거 → 안전 → 관리자 승인 → Supabase → published**  
순으로만 핵심 추천에 올린다.

등록량보다 검증 정확도를 우선한다.  
가짜 제품·가격·재고·링크·근거 없는 효능 설명 금지.

---

## 2. 상태 머신

```text
discovered
  → sale_checked
  → ingredients_checked
  → evidence_checked
  → safety_checked
  → verified
  → published

분기: needs_review | rejected
```

| 상태 | 의미 | 핵심 추천 |
|------|------|-----------|
| discovered | 후보만 존재 | 불가 |
| sale_checked | 판매·가격·재고·배송 확인 | 불가 |
| ingredients_checked | 전성분 수집·표준화 | 불가 |
| evidence_checked | 성분–고민 근거 연결 | 불가 |
| safety_checked | 자극·알레르기·회피 검토 | 불가 |
| verified | 관리자 게이트 통과(파이프라인 단계). 행 공개는 각 테이블 `approved` | 불가 (아직 공개 전) |
| published | 공개·추천 가능 | **가능** (offer 조건 별도) |
| needs_review | 보류 | 불가 |
| rejected | 반려 | 불가 |

**용어 구분**

- 공통 검토 상태: `pending` / `in_review` / `approved` / `rejected` / `needs_review`  
- 관리자 검토 결과 공개 게이트: **`approved`** (verified와 혼용 금지)  
- `product_offers.verification_status=verified`: 판매처 검증 (기존 유지)  
- `workflow_status=verified`: 파이프라인 단계명 (offer verified와 다름)  

**workflow verified ≠ published ≠ offer verified**  
관리자 승인 후에도 판매·전성분·출처 게이트를 통과해야 published.

저장 위치:

- 후보: `product_discovery_candidates.workflow_status`  
- 제품(향후): `products.pipeline_status`  
- 작업: `verification_queue`

---

## 3. 단계별 절차

### 3.1 검색 (discovered)

1. 피부 고민 또는 제품군 검색어 기록 (`search_query`)  
2. 후보 이름·브랜드·URL·국가 저장  
3. `data_sources`에 출처 유형 연결  
4. 검색 노출만으로 재고·판매 가능을 단정하지 않음  

산출: `product_discovery_candidates` 행

### 3.2 판매 상태 확인 (→ sale_checked)

모두 충족해야 pass:

- 실제 상품 상세 페이지  
- HTTPS URL  
- 공식 또는 신뢰 판매처 (`data_sources.trust_level` / official)  
- 가격 표시  
- 구매 버튼 존재  
- 품절 아님  
- 해당 배송 국가 구매 가능  
- 최근 확인일 (`last_checked_at` / notes)

실패 → `rejected` 또는 `needs_review`.  
통과 후 `product_offers` 초안 작성 가능 (기본 `unverified`, stock 실측값).

### 3.3 전성분 확인 (→ ingredients_checked)

1. 공식 라벨·공식몰 전성분 확보 (`source_url`, `source_type`)  
2. 성분 표준화 → `ingredients` + `ingredient_aliases`  
3. 순서대로 `product_ingredients.ingredient_order` 저장  
4. 농도 공개 시에만 concentration 필드 기입  

**공식 전성분 출처 없으면 published 금지.**

### 3.4 중복 확인

앱 유틸 방향과 동일 원칙 (`findDuplicateProducts`):

- productId / 향후 bigint id 충돌  
- canonical brand + 제품명(KO/EN) 정규화 키  
- URL·용량 variant 차이인지 동일 제품인지 구분  

중복이면 기존 `products.id`에 링크 (`linked_product_id`), 신규 남발 금지.

### 3.5 논문 근거 연결 (→ evidence_checked)

1. 핵심 성분에 대해 `ingredient_evidence` 작성  
2. `docs/33-evidence-level-policy.md` 준수  
3. 의약품/화장품 구분, COI, 농도·제형·기간 기록  
4. `review_status=pending`으로 queue 등록  

제품 전체 효과를 논문 1건으로 쓰지 않음.

### 3.6 안전성 검토 (→ safety_checked)

1. `ingredient_cautions` 확인  
2. 알레르기·회피·자극·임신·병용 주의  
3. `skin_concerns.medical_boundary`면 전문가 상담 분기 우선  
4. 홍조·심한 염증·통증·진물·지속 악화 → 추천 억제 플래그/노트  

### 3.7 관리자 승인 (→ verified)

1. `verification_queue`에서 sale/ingredients/evidence/safety 일괄 검토  
2. 누락·과장·출처 불명 시 `needs_review` 또는 `rejected`  
3. 승인 시 candidate/product `workflow_status=verified`  
4. **이 시점에도 핵심 추천 사용 금지**

### 3.8 Supabase 등록

승인된 데이터만 원격 반영 (별도 작업·사용자 승인 필수):

- brands / products / variants  
- product_ingredients / aliases  
- offers (아직 unverified일 수 있음)  
- evidence / cautions  

GitHub JSON 백업과 이중 저장 원칙 유지.

### 3.9 published 전환

게이트:

1. workflow verified  
2. 판매 확인 유효 (최근 확인일)  
3. 공식 전성분 출처 존재 + product_ingredients 검증  
4. 핵심 offer가 국가 규칙 충족 가능 상태 (KR: verified+in_stock+KRW 등)  
5. 안전·의료 경계 처리 완료  

→ `published` + (필요 시) offer `verification_status=verified`  
→ 핵심 추천 후보 편입

### 3.10 정기 재검증

주기(운영 목표, 수치는 추후 확정):

- 가격·재고·URL (`product_offers.last_checked_at`)  
- 전성분·리뉴얼 (`product_variants.formula_version`, change_history)  
- evidence review 만료  

변경 감지 → `product_change_history` → queue → 필요 시 published 철회.

---

## 4. 실패·보류·단종

| 상황 | 상태 | 조치 |
|------|------|------|
| URL 사망·구매 불가 | rejected 또는 offer invalid/unavailable | published 해제, 추천 제외 |
| 품절 | offer out_of_stock | 핵심 추천 제외 (RLS도 숨김) |
| 전성분 리뉴얼 미확인 | needs_review | published 유지 여부 관리자 판단 |
| 근거 철회·고COI | evidence rejected | 해당 근거 미사용 |
| 제품 단종 | products/variants discontinued | active=false, published 해제 |
| 중복 확정 | linked_product_id | 후보 병합, 중복 행 rejected |

---

## 5. 역할과 권한

| 역할 | 가능 |
|------|------|
| anon/authenticated | published 제품·approved evidence·verified in_stock offer SELECT |
| service_role / 관리자 | discovery, queue, 미공개 행 CRUD |
| AI/에이전트 | 문서·초안만. 원격 쓰기·가짜 데이터 금지. Supabase 쓰기는 사용자 승인 |

개인정보·계정 체계는 본 워크플로 문서 범위 밖 (`assigned_to`는 표시명 수준).

---

## 6. 한국 MVP 체크리스트

- [ ] KR 검색 후보만으로 시작 가능  
- [ ] COSRX 3개를 첫 실제 검증 사례로 파이프라인 통과  
- [ ] offer: unverified/unknown → 핵심 Top 5 제외 (현재와 동일)  
- [ ] published 전 Supabase 대량 insert 금지  
- [ ] API 없이도 수동 검증으로 완주 가능  

---

## 7. 구현 순서 (아직 실행하지 않음)

1. 본 데이터 모델 검토  
2. **migration 설계** (파일 작성·적용은 승인 후)  
3. 관리자 검증 UI 확장  
4. COSRX 3개 사례 적용  
5. Supabase 반영 · JSON 백업 · GitHub push  

다음 작업 1개: **데이터 모델 검토 후 migration 설계 (미실행)**
