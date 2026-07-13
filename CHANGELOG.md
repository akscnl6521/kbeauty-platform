# CHANGELOG.md — K-Beauty Match

형식: 최신 항목이 위.

---

## 2026-07-13

### 문서 복구 — Master Plan v3.1 / 운영 규칙 / 상태 동기화

- `MASTER_PLAN.md` 신설 (v3.1: 한국 MVP, 이중 저장, 검증 우선, 즉흥 수정 금지)
- `PROJECT_RULE.md` 신설 (GitHub/Supabase 규칙, 작업 순서, 백업 경로, 승인 절차)
- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md`를 실제 Sprint 진행에 맞게 갱신

### GitHub 백업 브랜치

- 브랜치 `backup-sprint14-20260713` 생성
- 커밋 `c73c135d92149f1c67b2b4c8209b750850792a03` — Backup Sprint 14 local work before Supabase migration
- `main` 미병합, Supabase 미적용 상태로 로컬 작업 보존
- Supabase MCP 연결 완료 (쓰기 도구 사용 가능, 본 단계에서는 미사용)
- 원격 `product_offers` **미적용** 상태 유지

### Sprint 14 — COSRX 1차 등록·검증 대기 (진행 중)

- 로컬 `data/catalog/kr/cosrx-products.json` / `cosrx-offers.json` — 실제품 3개·offer 3개
- 가격 23,000 / 23,000 / 24,000 KRW, 공식몰 URL, 성분 임의 기입 없음
- offer: `unverified` + `stock unknown` → 핵심 Top 5 제외
- `/admin/catalog-review` 개발 전용 검증 대기 UI
- `product_offers` migration: `product_id bigint` FK, 최소 권한 RLS 준비

---

## 2026-07-12

### `514f0f9` — Sprint 13
한국 카탈로그 템플릿·검증 도구

- `validateCatalogData` / `findDuplicateProducts`
- 한국 제품·offer CSV/JSON 템플릿 및 sample
- `docs/29-korean-product-data-guide.md`
- 가짜 실상품·임의 가격 없이 입력·검증 구조만 구축

### `f9ca6e7` — Sprint 12
canonical 브랜드명 표준화

- `displayBrandName` / `BrandDisplayName` 레지스트리
- 오번역·오타 복구 (Peach Slices, Beauty of Joseon 등)
- 제품명·브랜드명 분리 표시
- 브랜드명 자동 번역 차단

### `e001baf` — Sprint 10
현재 제품 등록과 루틴 점검

- `CurrentProductInput` 및 analyze CRUD UI
- `reviewCurrentRoutine` / 결과 페이지 「현재 루틴 점검」
- 프롬프트·mock과 연동

### `7136a88` — Sprint 9
알레르기·회피 성분 안전 필터

- 알레르기/회피 성분 입력·저장
- `filterCandidatesBySafety` 등 추천 전 안전 필터
- 결과 UI 반영

### `1895221` — Sprint 8
핵심 추천 제품 분리와 성분 표시명 표준화

- 결과 페이지 「나를 위한 핵심 추천 제품」Top 5와 「다른 제품 둘러보기」분리
- 탐색 목록 기본 미리보기 + 더 보기/접기
- Top 5와 중복되지 않도록 탐색 목록에서 핵심 추천 제품 제외
- 성분명 표준화 (한국어·영어·일본어 표시명, 한국어 UI에서 일본어 표기 혼입 방지)
- 추천 카드·분석 가이드·탐색 배지에 표준 표시명 적용

### `61393cd` — Sprint 7
확장된 AI 분석 결과 UI 개선

- 확장 필드 표시 규칙 정리 (빈 값은 숨김)
- 관리 단계(`managementLevel`) 한글 표기
- `expert_first` / `urgent_check` 최상단 경고
- 화장품의 한계·전문가 상담 사유를 제품 목록보다 앞에 배치
- 아침/저녁 루틴 구분, 분석 신뢰도 % 표시

### `53b1507` — Sprint 6
확장된 AI 분석 결과를 결과 페이지에 연결

- 분석/Mock 성공 후 `/results` 자동 이동
- 분석·추천·소스 정보를 LocalStorage에 저장
- 결과 페이지에서 확장 AI 가이드와 Top 5를 함께 표시
- 필요 시 분석 결과로 요약·피부 타입 폴백

### `b183fe4` — Sprint 5
AI 피부 관리 안내와 안전 응답 구조 확장

- Master Plan 기준 확장 Recommendation 필드 추가
- 안전 원칙 반영 프롬프트·응답 검증
- Mock 응답에 확장 필드 포함
- (관련) `063111c` — 멀티 프로바이더 서버 AI API, 브라우저 직접 AI 호출 제거

### 운영 문서

- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md` 작성 및 UTF-8 한글 복구

---

## 이전 (요약)

| 커밋 | 요약 |
|------|------|
| `20fd9b2` | Sprint 4: 결과 페이지와 추천 파이프라인 연결 |
| `5b7c037` | Sprint 3 Phase 2C: 캐논컬 성분 매칭 개선 |
| `99932a6` | Sprint 3 Phase 2A: 성분 정규화 및 랭킹 개선 |

더 이른 Sprint 상세는 Git 이력과 `docs/`를 참고한다.
