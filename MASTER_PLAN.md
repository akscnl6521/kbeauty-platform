# MASTER_PLAN.md — K-Beauty Match Master Plan v3.1

최종 갱신: 2026-07-13  
문서 버전: **v3.1**

이 문서는 K-Beauty Match의 **최상위 계획**이다.  
세부 실행 상태는 `PROJECT_STATUS.md`, 작업 순서는 `ROADMAP.md`, 변경 이력은 `CHANGELOG.md`, 운영 규칙은 `PROJECT_RULE.md`를 따른다.

---

## 1. 프로젝트 최상위 목표

K-Beauty Match는 사용자의 피부 상태·고민·성분 선호를 바탕으로  
**실제로 구매 가능한 K-뷰티 제품**을 안전하게 추천하는 플랫폼이다.

핵심 목표:

1. 피부 분석 결과를 근거 있는 제품·성분 추천으로 연결한다.
2. 추천 전에 **실제 판매처·가격·재고·구매 링크**를 검증한다.
3. 화장품의 한계를 명확히 알리고, 필요 시 **피부과 상담**으로 분기한다.
4. 분석 이후에도 **3일·7일·15일·30일** 지속 관리로 사용자를 돕는다.
5. 한국 MVP를 먼저 완성하고, 미국·일본은 구조를 유지한 채 준비한다.

---

## 2. 시장 우선순위

| 우선순위 | 시장 | 상태 |
|----------|------|------|
| 1 | **한국 (KR)** | MVP 우선. KRW, 국내 판매처, verified offer 중심 |
| 2 | 미국 (US) | 구조 유지, 데이터·offer 준비 중 |
| 3 | 일본 (JP) | 구조 유지, 데이터·offer 준비 중 |

한국 MVP 원칙:

- 핵심 추천 Top 5는 **한국 verified offer**가 있는 제품만 사용한다.
- 공식 확인되지 않은 가격·재고·링크는 핵심 추천에 넣지 않는다.
- 브랜드명은 번역하지 않고 공식 canonical 표기를 유지한다.
- 초기 한국 MVP는 **검색 우선**으로 실제 판매 제품을 찾고, 검증된 제품만 등록한다.

---

## 3. Search-to-Verified + Autonomous Catalog Pipeline

K-Beauty Match는 **검증 정확도**를 유지하면서, 사람이 모든 URL을 수동 등록하지 않도록  
**자율 카탈로그 파이프라인**으로 후보를 대량 구축한다.

- **자율 카탈로그 파이프라인**: draft catalog + 전성분 + offer discovery (`docs/90`~`103`)
- Cursor는 개발만 · 운영은 worker · 사람은 needs_review만 · 자동 publish 금지 · Top5는 verified offer 필수
- 정상 데이터: 자동 저장 (후보·관계·점수·큐)
- 낮은 신뢰도/충돌: `needs_review`만 사람 검토
- **자동 `published` 금지** · 가짜 offer/가격/성분 금지
- 상세: `docs/69-autonomous-catalog-pipeline.md` ~ `docs/85-pipeline-commit-mode-policy.md`

### 3.0 기존 Search-to-Verified (유지)

제품 등록보다 **검증 정확도를 우선**한다.

공식 파이프라인 이름: **Search-to-Verified-Product Pipeline**

### 3.1 기본 수집 흐름

1. 사용자 피부 고민 또는 제품군 검색  
2. 실제 판매 제품 후보 발견  
3. 판매 페이지 확인  
4. 가격과 구매 버튼 확인  
5. 품절 여부 확인  
6. 배송 국가 확인  
7. 공식 제품명·브랜드·용량 확인  
8. 전체 전성분 확인  
9. 성분 표준화  
10. 논문·피부과학 근거 검토  
11. 자극·알레르기·회피 성분 검토  
12. 관리자 검증  
13. Supabase 등록  
14. 추천 사용  

검색 결과에 노출된다는 이유만으로 재고가 있다고 판단하지 않는다.

### 3.2 판매 가능 제품 판단 조건

- 실제 상품 상세 페이지 존재  
- HTTPS URL  
- 공식 또는 신뢰 판매처  
- 가격 표시  
- 구매 버튼 존재  
- 품절 상태 아님  
- 해당 배송 국가에서 구매 가능  
- 최근 확인일 존재  

판매 상태 확인 전에는 **핵심 추천에 포함하지 않는다.**

### 3.3 제품 상태 단계

`discovered` → `sale_checked` → `ingredients_checked` → `evidence_checked` → `safety_checked` → `verified` → `published`

**`published`가 아닌 제품은 핵심 추천에 사용하지 않는다.**

### 3.4 추천 판단 근거 순서

1. 사용자 피부 상태  
2. 전체 전성분  
3. 성분별 논문 근거  
4. 제형·농도·사용 부위  
5. 자극 가능 성분  
6. 알레르기 및 회피 성분  
7. 실제 구매 가능성  

논문 근거가 있는 성분 하나가 포함됐다는 이유만으로 제품 전체 효과를 단정하지 않는다.  
의약품 연구와 화장품 연구를 구분한다.

### 3.5 데이터 분리 모델

| 엔티티 | 역할 |
|--------|------|
| Product | 제품 자체 |
| ProductVariant | 용량·국가·리뉴얼 버전 |
| ProductOffer | 판매처·가격·재고·구매 링크 |
| ProductIngredient | 전체 전성분 |
| IngredientEvidence | 성분별 논문 근거 |

가짜 제품·가격·재고·링크, 근거 없는 효능 설명은 절대 생성하지 않는다.

### 3.6 공식 API 정책

공식 API는 **필수 조건이 아니다.**  
API는 다음 경우에만 선택적으로 사용한다.

- 가격·재고 자동 갱신  
- 브랜드 공식 연동  
- 판매처 피드  
- 대량 변경 감지  
- 비용 대비 효과가 충분한 경우  

상세: `docs/20-data-source-verification.md`, `docs/11-product-retailer-offer.md`

---

## 4. 제품 추천 전 검증 원칙 (Offer)

추천 점수보다 **판매 가능 여부**를 먼저 확인한다.

한국 verified offer 조건:

- `retailerCountry === "KR"`
- `shipsToCountries`에 `"KR"` 포함
- `currency === "KRW"`
- `price > 0`
- `stockStatus === "in_stock"`
- `verificationStatus === "verified"`
- `purchaseUrl`은 https
- `verifiedAt` 존재
- `active !== false`

검증 대기(`unverified` / `stock unknown`) 데이터는 관리자 검토용으로만 두고, 핵심 추천에는 포함하지 않는다.

---

## 5. 안전·의료 경계

- 본 서비스는 의료 진단·치료를 대체하지 않는다.
- 화장품으로 관리 가능한 범위와 한계를 명확히 표시한다.
- 홍조·심한 염증·통증·진물·지속적 악화 등은 제품 추천보다 **전문가 상담 분기**를 우선한다.
- 알레르기·회피 성분은 추천 전에 안전 필터로 제외한다.

---

## 6. 지속 관리 (3·7·15·30일)

단기 MVP 이후 확장 목표:

- 분석·추천 이후 **3일 / 7일 / 15일 / 30일** 안부·변화 확인
- 현재 사용 제품·루틴 점검과 연결
- 자극·건조·호전 등 피드백을 다음 안내에 반영

현재(2026-07-13): 현재 제품 등록·루틴 점검까지 구현. 주기적 안부 확인은 이후 단계.

---

## 7. GitHub와 Supabase 이중 저장 원칙 (v3.1)

| 저장소 | 저장 대상 |
|--------|-----------|
| **GitHub** | 코드, 문서, migration, 비개인 카탈로그 원본(JSON/CSV), 백업 스냅샷 |
| **Supabase** | 실제 제품·성분·판매처·가격·재고·검증 상태 등 운영 데이터 |

1. Cursor 수정은 로컬 수정일 뿐 자동 반영이 아니다. Cursor는 운영 worker/Task/SQL을 실행하지 않는다.
2. GitHub와 Supabase 중 **한쪽만** 반영된 상태는 완료가 아니다.
3. Supabase 쓰기 전 GitHub 백업을 확인하고, **사용자 승인**을 받는다.
4. 중요 비개인 데이터는 `data/backups/YYYY-MM-DD/` 에도 JSON으로 남긴다.
5. `.env.local`, 비밀번호, API 키, `service_role` 키는 GitHub에 올리지 않는다.

상세 규칙은 `PROJECT_RULE.md`를 따른다.

---

## 8. 작업 수행 원칙

1. **즉흥 수정 금지** — 오류 시 원인 확인 → 계획 → 최소 수정
2. **한 번에 한 작업만** 수행한다
3. 연결 확인 작업과 DB 변경 작업을 섞지 않는다
4. 가짜 제품·가격·판매처·재고·구매 링크를 만들지 않는다
5. 브랜드명은 번역하지 않고 `canonicalBrandName`을 사용한다
6. 작업 완료 후 `PROJECT_STATUS.md`와 `CHANGELOG.md`를 갱신한다

---

## 9. 현재 단계 (요약)

- Sprint 9~13 완료, Sprint 14 진행 중
- 제품 데이터 전략: **검색 우선·검증 후 등록**으로 공식화
- 로컬 COSRX 실제품 3개 + offer 3개 (검증 대기 사례)
- GitHub 백업 브랜치 `backup-sprint14-20260713` 존재
- 원격 `product_offers` migration **적용 완료** (`20260713022607`)
- 다음 핵심 작업: **Search-to-Verified-Product Pipeline 설계**

상세 현황은 `PROJECT_STATUS.md`를 본다.
