# CHANGELOG.md — K-Beauty Match

형식: 최신 항목이 위.

---

## 2026-07-13

### 일반 사용자 인증 · 온보딩 · Care E2E

- `/login` `/signup` `/forgot-password` `/reset-password` `/logout`
- `/my`·`/onboarding` 보호 · safe `next` · `/auth/link-local` 익명 기록 연결
- `/onboarding` 단계형 · results CTA “내 피부 관리 시작하기”
- docs/138~142 · Cursor 운영/실메일 E2E 미실행

### Continuous Care 서버 영속화

- migration `create_continuous_care_persistence` 원격 적용 + DELETE privilege revoke
- CarePersistence · `/api/care/*` · 익명 local fallback · attach 연결
- worker care tick (due/expired/알림/audit) · `/admin/care` DB 집계
- docs/133~137 · Cursor 운영 worker 미실행

### Continuous Care (3·7·15·30일 지속 관리)

- `/my` 대시보드 · 분석 snapshot · 루틴 · 체크인 · 변화 · 설정
- Day 3/7/15/30 자동 일정 · 사이트 내 알림 · 루틴 조정 제안(확인 후 적용)
- 피부과 상담 권고 규칙(진단 아님) · `/admin/care` 익명 집계
- local store UX · 서버 스키마는 `docs/131` BLOCKER / `docs/132` rollback
- docs/123~130 · Cursor 운영 worker/SQL 미실행

### 운영 모니터링 · 알림센터

- /admin/operations health/alerts · rule registry · fingerprint 중복 억제
- 파일 기반 acknowledgement · durable alert migration은 BLOCKER SQL만
- safe auto-recovery allowlist · external adapter stub
- config v5 monitoring · docs/116~122
- Cursor 운영 worker/SQL 미실행

### 자율 제품 검증 · 활성화 · 추천 연결

- quality A/B draft → active=true + verified_at (published 금지)
- verified offer·공식 전성분·구조화 ingredients 필수
- stale/OOS는 제품 강등 없이 eligibility만 false
- Top5 패딩 금지 · fetchCandidateProducts는 verified catalog만
- config v4: allowProductAutoVerify/Activate/Reevaluation
- docs/104~109
- Cursor 운영 worker/SQL 미실행

### 자율 offer discovery · verification

- 판매처 등급·JSON-LD Offer 추출·가격/재고/배송 게이트
- `allowOfferCandidateInsert` / `allowVerifiedOfferUpsert` (ungated offer insert는 hard false)
- `/admin/offers` · marketplace seller 제외
- docs/98~103
- Cursor는 운영 worker/SQL 미실행

### 자율 draft catalog · 전성분 enrichment

- `allowDraftProductInsert` 등 config v2
- draft product (`active=false`) · variant · product_ingredients 자동 연결
- INCI 파서/매칭 · 카테고리 분류 · 추천 pool에서 draft 제외
- docs/90~97
- Cursor는 worker/SQL 미실행 (다음 스케줄부터 worker 적용)

### Cursor / worker 운영 분리

- `config/pipeline-operation.json` 고정 운영 설정
- 스케줄러 고정 명령: `node scripts/run-pipeline-worker.mjs` (가변 CLI 금지)
- `/admin/pipeline/settings` + overrides 파일
- Cursor는 개발·테스트·build·git만 · 운영 worker/Task/SQL 미실행
- `docs/79`, `docs/83`, `.cursor/rules/dev-ops-separation.mdc`

### 자율 파이프라인 무인 운영 전환

- migration `create_autonomous_pipeline_persistence` 원격 적용
- Supabase persistence adapter · claim/lock/heartbeat
- 관리자 pipeline 콘솔 DB 연결
- 쿠키 없는 로컬 worker (`run-pipeline-worker.mjs`)
- Task Scheduler 스크립트 (UAC 시 수동 1줄)
- dry_run 1회 검증 (products 186 / ingredients 40 유지, discovery INSERT 0)
- `docs/81`~`docs/85`

### 자율 카탈로그 파이프라인 1차

- 오케스트레이터·파일 checkpoint·retry/resume (`src/lib/pipeline/*`)
- 브랜드 seed (products/brands) · 사이트 crawl · 추출 · 중복 · 성분 · skin/tone/quality 점수
- 관리자 `/admin/pipeline` · `/admin/brands` · pipeline/brands API
- 로컬 worker 스크립트 · Task Scheduler 명령 생성만 (자동 등록 없음)
- 기본 dry_run · 자동 published 금지 · DELETE/migration 미적용
- BLOCKER SQL: `docs/80-pipeline-migration-blocker.sql`
- `docs/69`~`docs/79`

### URL 기반 discovery 빠른 등록

- `/admin/discovery/import` — URL 붙여넣기·CSV·미리보기·선택 등록
- `POST .../import/preview` · `POST .../import/commit`
- cheerio HTML 추출 (JSON-LD → OG → meta → title → path)
- SSRF 방어 · 중복 검사 · 부분 성공 · duplicate 큐 옵션
- `docs/66`~`docs/68`
- migration/DELETE/원격 테스트 INSERT 없음

### Search-to-Verified 쓰기 콘솔 1차

- 역할별 쓰기 권한 (`admin-permissions` / `write-guard`)
- POST/PATCH discovery · POST/PATCH verification
- workflow 서버 검증 (`workflow.ts`)
- 감사 로그: `product_change_history` (safe metadata, PII 없음)
- UI: `/admin/discovery/new`, discovery/verification 쓰기 패널
- DELETE·migration·가짜 offer/가격·main 병합 없음
- `docs/61`~`docs/65`

### 관리자 읽기 전용 운영 콘솔 완료

- ingredients 상세 · verification 목록/상세 · 대시보드 Verification 링크
- `AdminSubnav` 공통 내비 · `src/lib/admin/query.ts` 공통 헬퍼
- `docs/57`~`docs/60` · PROJECT_STATUS / ROADMAP / CHANGELOG 갱신
- Supabase 쓰기·migration·main 병합 없음

### 관리자 verification 상세 1차 — 읽기 전용

- `getAdminVerificationDetail` — queue + entity 연결 SELECT
- `GET /api/admin/verification/[id]` — 400/404/401
- `/admin/verification/[id]` UI — 승인/반려 버튼 없음
- `assigned_to` → `isAssigned`만
- `docs/60-admin-verification-detail-readonly.md`

### 관리자 verification 목록 1차 — 읽기 전용

- `getAdminVerificationQueue` — 검색·필터·정렬·페이지네이션
- `GET /api/admin/verification` · `/admin/verification`
- 큐 0건 빈 상태 정상 (seed 금지)
- `docs/59-admin-verification-readonly.md`

### 관리자 성분 상세 1차 — 읽기 전용

- `getAdminIngredientDetail` — aliases/evidence/cautions/linked products
- `GET /api/admin/ingredients/[id]` · `/admin/ingredients/[id]`
- verified vs evidence 존재 구분 · https URL만 활성
- `docs/58-admin-ingredient-detail-readonly.md`

### 관리자 성분 목록 1차 — 읽기 전용

- `getAdminIngredients` — ingredients + alias/evidence/caution/product counts
- `GET /api/admin/ingredients` — 검색·필터·정렬·페이지네이션
- `/admin/ingredients` UI — 실제 40건 조회
- ingredients에 active/verified_at/inci_name 컬럼 없음 → 필터·표시 규칙 문서화
- 대시보드 Ingredients 링크 활성화
- `docs/57-admin-ingredients-readonly.md`
- 쓰기·migration 없음

### 관리자 discovery 상세 1차 — 읽기 전용

- `getAdminDiscoveryDetail` — candidate + linked product + queue SELECT
- `GET /api/admin/discovery/[id]` — 400/404/401
- `/admin/discovery/[id]` UI — 기본/출처/workflow/중복/queue
- `canProceedToNextStage` 참고값만 (버튼 없음)
- 목록 상세 링크 연결
- `docs/56-admin-discovery-detail-readonly.md`
- 후보 0건 → 상세 200 E2E 미실행 (seed 금지)
- 쓰기·migration·commit/push 없음

### 관리자 discovery 목록 1차 — 읽기 전용

- `getAdminDiscoveryCandidates` — candidates + queue count (N+1 방지)
- `GET /api/admin/discovery` — 검색·필터·정렬·페이지네이션
- `/admin/discovery` UI — 0건 빈 상태 정상
- 대시보드 Discovery 링크 활성화
- 상세/상태변경/seed 없음
- `docs/55-admin-discovery-readonly.md`
- 쓰기·migration·commit/push 없음

### 관리자 제품 상세 1차 — 읽기 전용

- `getAdminProductDetail` — products + offers + variants + product_ingredients SELECT
- `GET /api/admin/products/[id]` — 400/404/401 처리
- `/admin/products/[id]` UI — 기본/검증/성분/offer/레거시/variant
- `recommendationEligible` 엄격 계산 (레거시 링크만으로 true 금지)
- 목록 ID·제품명 상세 링크 연결
- `docs/54-admin-product-detail-readonly.md`
- 쓰기·migration·commit/push 없음

### 관리자 제품 목록 1차 — 읽기 전용

- `getAdminProducts` — products SELECT + offer count (N+1 방지)
- `GET /api/admin/products` — 검색·필터·정렬·페이지네이션
- `/admin/products` UI — 읽기 전용 테이블
- 대시보드 Products 링크 활성화
- 쓰기·migration·원격 schema 변경 없음
- `docs/53-admin-products-readonly.md`
- commit/push 없음

### 관리자 대시보드 1차 — 읽기 전용 운영 현황

- `getAdminDashboardData()` — service_role SELECT/count만
- `GET /api/admin/dashboard` — 전 관리자 역할 허용
- `/admin` UI — catalog / pipeline / queue / quality / system
- 쓰기·migration·seed·원격 schema 변경 없음
- `docs/52-admin-dashboard-implementation.md`
- commit/push 없음

### 관리자 비밀번호 재설정 — token_hash verifyOtp 보완

- 실패 원인: 기본 ConfirmationURL → PKCE `code` 교환이 실패해 `recovery_failed` 반복
- `/auth/callback`: `token_hash` + `type=recovery` → `verifyOtp` 우선
- `code` → `exchangeCodeForSession` fallback 유지
- Email Template 권장 URL을 `docs/51`에 문서화 (변수만)
- commit/push·원격 DB 변경 없음

### 관리자 비밀번호 재설정 — PKCE callback 수정

- 원인: `redirectTo`가 `/admin/reset-password` 직행 → client code 교환으로 쿠키 세션 미성립
- `GET /auth/callback` — 서버 `exchangeCodeForSession` 후 cookie + redirect
- `redirectTo` → `/auth/callback?next=/admin/reset-password`
- reset-password는 `getUser`만 (code 교환 제거)
- proxy matcher에 `/auth/callback` 추가
- Dashboard Redirect URL: `http://localhost:3000/auth/callback` 수동 추가 필요
- `docs/51` 갱신 · commit/push 없음

### 관리자 비밀번호 재설정 최소 구현

- `/admin/forgot-password` — `resetPasswordForEmail` (origin 기반 redirectTo)
- `/admin/reset-password` — recovery 세션 확인 후 `updateUser({ password })`
- 로그인 화면 「비밀번호를 잊으셨나요?」 링크
- layout 가드 제외: forgot/reset-password (무한 redirect 방지)
- `docs/51-admin-password-reset.md`
- Dashboard Redirect URL은 수동 확인만 (자동 변경 없음)
- commit/push·원격 DB 변경 없음

### 관리자 로그인 페이지 최소 구현

- `/admin/login` — Supabase `signInWithPassword`
- `POST /admin/logout` — 세션 종료 후 로그인으로 이동
- 미로그인 `/admin` → `/admin/login`
- 비관리자 → `/admin/forbidden` (+ 로그아웃)
- 설정 누락 → `/admin/unavailable`
- 로그인 성공만으로 admin 인정하지 않음 (`admin_users` 재검증)
- `docs/50-admin-login-implementation.md`
- `SUPABASE_SERVICE_ROLE_KEY` 로컬 missing → E2E BLOCKER
- commit/push·원격 DB 변경 없음

### 관리자 인증 가드 최소 구현

- `@supabase/ssr` / `server-only` 추가
- browser / server session / admin(service_role) client 분리
- `src/proxy.ts` — `/admin`, `/api/admin` 쿠키 갱신만 (role 판정 없음)
- `requireAdminUser` / `withAdminAuth` / `GET /api/admin/auth-check`
- `/admin` 가드 레이아웃 + unauthorized/forbidden
- `/admin/catalog-review` — development + **admin_users 필수**
- `profiles.role` 권한 판정 사용 안 함
- 문서: `docs/49-admin-auth-implementation.md`
- 로그인 UI·commit/push·원격 DB 변경 없음

### 제품 DB 구축 원칙 변경 — Search-to-Verified-Product Pipeline

- 브랜드별 대량 DB 선구축을 중단하고 **검색 우선·판매 확인·성분·논문 검증 후 등록** 방식 채택
- 공식 파이프라인명: **Search-to-Verified-Product Pipeline**
- 제품 상태 단계: `discovered` → `sale_checked` → `ingredients_checked` → `evidence_checked` → `safety_checked` → `verified` → `published`
- `published`만 핵심 추천 사용; 판매 미확인·가짜 데이터·근거 없는 효능 단정 금지
- Product / ProductVariant / ProductOffer / ProductIngredient / IngredientEvidence 분리
- 공식 API는 필수 아님 — 가격·재고 갱신·피드·비용 대비 효과가 충분할 때만 선택 사용
- `MASTER_PLAN.md` / `PROJECT_RULE.md` / `ROADMAP.md` / `PROJECT_STATUS.md` 동기화
- `docs/20-data-source-verification.md` / `docs/11-product-retailer-offer.md` 신설
- `.cursor/rules/search-to-verified-product.mdc` 신설
- Sprint 14 방향: COSRX 수동 입력 → 파이프라인 설계로 확장 (COSRX 3개는 첫 검증 사례)

### Supabase — product_offers migration 적용

- 원격 migration `20260713022607` (`create_product_offers_and_catalog_extensions`) 적용 완료
- `product_offers` 테이블 존재, 행 0; RLS: verified + in_stock + active만 SELECT

### 문서 복구 — Master Plan v3.1 / 운영 규칙 / 상태 동기화

- `MASTER_PLAN.md` 신설 (v3.1: 한국 MVP, 이중 저장, 검증 우선, 즉흥 수정 금지)
- `PROJECT_RULE.md` 신설 (GitHub/Supabase 규칙, 작업 순서, 백업 경로, 승인 절차)
- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md`를 실제 Sprint 진행에 맞게 갱신

### GitHub 백업 브랜치

- 브랜치 `backup-sprint14-20260713` 생성
- 커밋 `c73c135d92149f1c67b2b4c8209b750850792a03` — Backup Sprint 14 local work before Supabase migration
- `main` 미병합 상태로 로컬 작업 보존
- Supabase MCP 연결 완료 (쓰기 전 사용자 승인)

### Sprint 14 — COSRX 1차 등록·검증 대기 (진행 중)

- 로컬 `data/catalog/kr/cosrx-products.json` / `cosrx-offers.json` — 실제품 3개·offer 3개
- 가격 23,000 / 23,000 / 24,000 KRW, 공식몰 URL, 성분 임의 기입 없음
- offer: `unverified` + `stock unknown` → 핵심 Top 5 제외
- `/admin/catalog-review` 개발 전용 검증 대기 UI
- `product_offers` migration: `product_id bigint` FK, 최소 권한 RLS (원격 적용 완료)

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
