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

---

## 3. 제품 추천 전 검증 원칙

추천 점수보다 **판매 가능 여부**를 먼저 확인한다.

필수 검증 항목:

- 판매처 (`retailerName`, `retailerCountry`)
- 가격·통화 (`price`, `currency`)
- 재고 (`stockStatus`)
- 구매 링크 (`purchaseUrl`, https)
- 검증 상태 (`verificationStatus`, `verifiedAt`)
- 활성 여부 (`active`)

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

## 4. 안전·의료 경계

- 본 서비스는 의료 진단·치료를 대체하지 않는다.
- 화장품으로 관리 가능한 범위와 한계를 명확히 표시한다.
- 위험 신호·전문 상담이 필요하면 **피부과 상담 분기**를 우선한다.
- 알레르기·회피 성분은 추천 전에 안전 필터로 제외한다.

---

## 5. 지속 관리 (3·7·15·30일)

단기 MVP 이후 확장 목표:

- 분석·추천 이후 **3일 / 7일 / 15일 / 30일** 안부·변화 확인
- 현재 사용 제품·루틴 점검과 연결
- 자극·건조·호전 등 피드백을 다음 안내에 반영

현재(2026-07-13): 현재 제품 등록·루틴 점검까지 구현. 주기적 안부 확인은 이후 단계.

---

## 6. GitHub와 Supabase 이중 저장 원칙 (v3.1)

| 저장소 | 저장 대상 |
|--------|-----------|
| **GitHub** | 코드, 문서, migration, 비개인 카탈로그 원본(JSON/CSV), 백업 스냅샷 |
| **Supabase** | 실제 제품·성분·판매처·가격·재고·검증 상태 등 운영 데이터 |

원칙:

1. Cursor 수정은 로컬 수정일 뿐 자동 반영이 아니다.
2. GitHub와 Supabase 중 **한쪽만** 반영된 상태는 완료가 아니다.
3. Supabase 쓰기 전 GitHub 백업을 확인하고, **사용자 승인**을 받는다.
4. 중요 비개인 데이터는 `data/backups/YYYY-MM-DD/` 에도 JSON으로 남긴다.
5. `.env.local`, 비밀번호, API 키, `service_role` 키는 GitHub에 올리지 않는다.

상세 규칙은 `PROJECT_RULE.md`를 따른다.

---

## 7. 작업 수행 원칙

1. **즉흥 수정 금지** — 오류 시 원인 확인 → 계획 → 최소 수정
2. **한 번에 한 작업만** 수행한다
3. 연결 확인 작업과 DB 변경 작업을 섞지 않는다
4. 가짜 제품·가격·판매처·재고·구매 링크를 만들지 않는다
5. 브랜드명은 번역하지 않고 `canonicalBrandName`을 사용한다
6. 작업 완료 후 `PROJECT_STATUS.md`와 `CHANGELOG.md`를 갱신한다

---

## 8. 현재 단계 (요약)

- Sprint 9~13 완료, Sprint 14 진행 중
- 로컬 COSRX 실제품 3개 + offer 3개 등록 (검증 대기)
- GitHub 백업 브랜치 `backup-sprint14-20260713` 생성 완료
- 원격 `product_offers` 테이블 **미적용**
- 다음 핵심 작업: `product_offers` migration 안전 적용 준비

상세 현황은 `PROJECT_STATUS.md`를 본다.
