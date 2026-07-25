# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-25

## 2026-07-25 스캐폴드 모드 — 전체 사용자 여정 클릭 연결 + 통합 검증 1차

- 목적: 완료 기준 12가지(EXECUTION_CONTRACT.md §7)를 일부러 미적용하고, 접속→국가/언어/통화→문진→사진분석→추천→루틴→구매처→저장→체크인→피부과→상담리포트 11단계를 샘플 데이터로 전부 클릭 연결.
- 화면: 신규 6개(`/routine/purchase`, `/routine/save`, `/my/clinics`, `/my/consultation-report`, `/quiz/body` + `/onboarding` 언어·통화 보강), 기존 5개 재사용.
- 하위 기능 6개: 사용 영상 placeholder, 광고/제휴 뱃지(기본 off, 명시적 disclosure), 클릭 추적 stub, 마지막 확인일 표시, 알림·상담정보 전달 동의 체크박스.
- 마스터플랜 전수 점검(섹션 2~21, 26, 41) 후 갭 2건 실제 처리: `/quiz/body`(전신 부위 문진), `/results` 제품별 "추천하지 않는 제품" 노출(`filterCandidatesBySafety` 확장). 나머지 5건(AI 코치·프로필 완성도·제품 소진 예상·관리자 번역 관리·수익 정산)은 로드맵 후반으로 보류.
- 통합 검증 1차: 모바일 375px 6화면 이상 없음, 의료 단정 표현 1건 수정, 광고/제휴 고지 문구 명확화.
- 실데이터: WQ-F espoir 브랜드 커넥터 버그 수정(한국형 `.do` URL 패턴 미인식) → 실 제품 10건 Staging 등록. HIRA 서울 피부과 실 수집 1,917/4,967건(로컬만, 미게시).
- 로그인 게이트 e2e: `/my/check-ins`·`/my/clinics`·`/my/consultation-report`·`/admin/discovery` 4/4 실 로그인 기반 렌더링 확인 통과 (`test:scaffold-journey-e2e`).
- 최종 회귀: 전체 `tsc`·`eslint`·`build` 통과. 기존 test suite 107건 중 104 통과, 3건(`checkin-email-provider`/`resend`/`test-api`) 실패는 로컬 `.env.local`에 `SITE_URL` 미설정 때문(오늘 변경과 무관, pre-existing 환경 갭 — 코드 수정 안 함).
- 상세: `DASHBOARD.md` 참고. Staging/Production DB 쓰기 없음(제품·병원 후보 upsert만, 게시 아님) · main 병합·Production 배포 없음.
- next_task: 사람이 우선순위 지정 대기 (마스터플랜 보류 5건 또는 discovery 검수 등)

## 2026-07-24 P3-T05 · Integrated Staging import package

- 계약: `src/lib/onboarding/stagingImportPackage/*` (제품·병원 후보 · provenance · review states · duplicates · rejection reasons · refresh status · commercial separation · publishable gates · 통합 사람 검수 패키지)
- Selftest/러너: `test:staging-import-package` · `check:staging-import-package` → `artifacts/staging-import-package/`
- 게이트: `stagingImportExecuted=false` · `stagingImportApprovalClaimed=false` · `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · fixture structural eligibility=0
- Docs: `docs/prelaunch/P3-T05_STAGING_IMPORT_PACKAGE.md`
- Tests: focused+integration 12건 · `check:release-security` · `build` · 변경 ESLint · `tsc` — **통과**
- 실 Staging import 승인·실행·공식 live·Production은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 · Staging import 승인 (`external_only`)

## 2026-07-24 P3-T04 · Affiliate and sponsored revenue readiness

- 계약: `src/lib/commercial/revenueReadiness/*` (affiliate offer ingestion · sponsored placement · disclosure · click/conversion events · country purchase links · expiry · admin approval · analytics privacy · Organic/전문 라우팅 독립)
- Selftest/러너: `test:revenue-readiness` · `check:revenue-readiness` → `artifacts/revenue-readiness/`
- 게이트: `commercialAgreementsActivated=false` · `publishAllowed=false` · `publicVisible=false` · `inventedCommissionRates=false` · `inventedLiveUrls=false` · `databaseTouched=false` · `writeAttempted=false` · `paidApiUsed=false`
- Docs: `docs/prelaunch/P3-T04_REVENUE_READINESS.md`
- Tests: `test:revenue-readiness` · `check:revenue-readiness` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실제휴 URL·수수료율·수익 채널 활성화는 **미검증** (`external_only` · EX-12)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T03 · Automated refresh and exception operations

- 계약: `src/lib/ops/automatedRefresh/*` (제품·병원 통합 due queue · stale · retry/backoff · resume checkpoint · source-change diff · exception 우선순위 · audit · admin review manifest · 스케줄러 준비 명령)
- Selftest/러너: `test:automated-refresh-ops` · `check:automated-refresh-ops` · `refresh:product-daily` · `refresh:clinic-twice-weekly` → `artifacts/automated-refresh-ops/`
- 게이트: `publishAllowed=false` · `autoPublishAttempted=false` · `destructiveUpdateAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · `externalScheduleCreated=false` · `paidApiUsed=false`
- Docs: `docs/prelaunch/P3-T03_AUTOMATED_REFRESH_OPS.md`
- Tests: `test:automated-refresh-ops` · `check:automated-refresh-ops` · `refresh:product-daily` · `refresh:clinic-twice-weekly` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 live 소스 갱신·운영자 스케줄 등록·DB 반영은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T02 · Verified product pool and category expansion

- 계약: `src/lib/catalog/verifiedProductPool/*` (skincare·makeup·hair/scalp·body·lip/eye · 카테고리 정규화 · 안전 적격 · 중복 병합 · 추천 준비 · 거절 사유 · 공개 Top 5 4기둥 게이트 · 기계 판독 audit)
- Selftest/러너: `test:verified-product-pool` · `check:verified-product-pool` → `artifacts/verified-product-pool/`
- 게이트: 출처·전성분·이미지 권리·구매 offer 미검증 시 공개 Top 5 진입 불가 · fixture/dry-run `publicTop5=[]`
- `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/P3-T02_VERIFIED_PRODUCT_POOL.md`
- Tests: `test:verified-product-pool` · `check:verified-product-pool` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 live verified SKU·공개 Top 5 게시는 **미검증** (`external_only` · EX-11)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T01 · Official Korean product source onboarding

- 계약: `src/lib/onboarding/officialKoreanProductSource/*` (브랜드 공식·공식 KR몰·공식 INCI · 이미지·variants·가격·재고·국가가용·사용가이드 · 필드 provenance · 재개 매니페스트 · deterministic dedupe · stale/refresh · review reasons · dry-run audit)
- Selftest/러너: `test:official-kr-product-source` · `check:official-kr-product-source` → `artifacts/official-kr-product-source/`
- 금지 강제: CAPTCHA/로그인/유료API/약관위험 자동화 · 미확인 필드 미발명 · fixture·미검증 비공개
- `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · `paidApiUsed=false` · Production 미터치
- Docs: `docs/prelaunch/P3-T01_OFFICIAL_KR_PRODUCT_SOURCE.md`
- Tests: `test:official-kr-product-source` · `check:official-kr-product-source` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 사이트 live 수집·사람 검수·Staging import·publishable은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`) · 제품 live는 EX-11

## 2026-07-24 T07-05 · Admin dry run and publishable gate

- 계약: `src/lib/publicData/adminDryRunPublishableGate/*` (T07-02→T07-03→T07-04 오케스트레이션 · fixture/실패/스테일/충돌/근거부족 비공개 · 공식근거+관리자승인만 구조적 publishable · Organic·clinical fit 유료필드 독립 · JSON/CSV 감사 · 1회성 사람 작업)
- Selftest/러너: `test:admin-dry-run-publishable-gate` · `check:admin-dry-run-publishable-gate` → `artifacts/admin-dry-run-publishable-gate/`
- `publishAllowed=false` · `publicVisible=0` · `databaseTouched=false` · `writeAttempted=false` · `secretsPresent=false` · Production 미터치
- Docs: `docs/prelaunch/T07-05_ADMIN_DRY_RUN_PUBLISHABLE_GATE.md`
- Tests: `test:admin-dry-run-publishable-gate` · `check:admin-dry-run-publishable-gate` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 사이트 근거 검수·Staging import 승인·publishable 전환은 **미검증** (`external_only` · 1회성 사람 작업 문서화)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 실 live 수집·사람 검수·Staging import (`external_only`)

## 2026-07-24 T07-04 · Official-site symptom evidence review bundle

- 계약: `src/lib/publicData/symptomEvidenceReview/*` (여드름·주사/홍조·아토피·색소 · 매니페스트 전용 · URL/제목/발췌/확인일/검수상태/만료일/거절사유 · Organic↔유료 큐 분리 · 미검증 비게시 · CAPTCHA/로그인/크롤 금지)
- Selftest/러너: `test:symptom-evidence-review` · `check:symptom-evidence-review` → `artifacts/symptom-evidence-review/`
- `publishAllowed=false` · `crawlAttempted=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-04_SYMPTOM_EVIDENCE_REVIEW.md`
- Tests: `test:symptom-evidence-review` · `check:symptom-evidence-review` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 페이지 사람 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 T07-03 · Institution detail enrichment + specialist evidence

- 계약: `src/lib/publicData/institutionDetailEnrichment/*` (공식 기관상세 진료과목·전문의 수 · evidence strength · lastVerified · conflicting-source · retryable failure · manual-review · 피부과 근거↔증상 전문 주장 분리 · bounded concurrency · cache/checkpoint · dry-run audit)
- T07-01 `PublicDataApiClient` 재사용 · 상호명만으로 피부과 추론 금지 · 미확인 값 null
- Selftest/러너: `test:institution-detail-enrichment` · `check:institution-detail-enrichment` → `artifacts/institution-detail-enrichment/`
- `publishAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-03_INSTITUTION_DETAIL_ENRICHMENT.md`
- Tests: `test:institution-detail-enrichment` · `check:institution-detail-enrichment` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 HIRA live 보강·관리자 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 T07-02 · Seoul dermatology candidate ingestion

- 계약: `src/lib/publicData/seoulDermatologyIngestion/*` (HIRA 공식 필드 · 서울/피부과 필터 · provenance · pagination checkpoint · deterministic dedupe · stale/refresh · dry-run audit)
- T07-01 `PublicDataApiClient` 재사용 · API 키 URL/아티팩트 미포함
- Selftest/러너: `test:seoul-dermatology-ingestion` · `check:seoul-dermatology-ingestion` → `artifacts/seoul-dermatology-ingestion/`
- 필터: `sidoCd=110000` · `dgsbjtCd=14`/`dgsbjtCdNm=피부과` · 상호명 키워드 단독 거절
- `publishAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-02_SEOUL_DERMATOLOGY_INGESTION.md`
- Tests: `test:seoul-dermatology-ingestion` · `check:seoul-dermatology-ingestion` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 HIRA live 수집·관리자 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 P2-T05 · Final Preview evidence and human approval package

- 계약: `src/lib/release/phase2FinalEvidencePackage.ts` (6버킷 · 자동명령 · 1회성 사람 검증 · 정직 플래그)
- Selftest/러너: `test:phase2-final-evidence` · `check:phase2-final-evidence` → `artifacts/phase2-final-evidence/`
- 버킷: 자동 테스트/라우트 · 스크린샷 육안 대기 · Android/iPhone · 외부 출처 · Dashboard 전용 · main/Production 게이트
- Docs: `docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md`
- 위장 금지: `visualApprovalClaimed=false` · `deviceApprovalClaimed=false` · `releaseReadyClaimed=false` · main/Production 미실행
- Tests: `test:phase2-final-evidence` · `check:phase2-final-evidence` (필수 8건 통과: preview-routes·staging-release-gate·admin-review-e2e·real-data-onboarding·final-integration·autopilot-queue·release-security·build) · 변경 ESLint · `tsc` — **통과**
- Preview 육안·실기기·Dashboard·공식 병원·WQG-P0-002 — **미검증** (`external_only`/`dashboard_only_unknown`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T04 · Real data onboarding readiness

- 계약: `src/lib/onboarding/realDataOnboarding/*` (출처 매니페스트·필드 provenance·공식 우선순위·stale/refresh·검수 체크리스트·import 템플릿·dry-run 검증·거절 사유 · KR 제품·병원/전문가)
- Selftest: `scripts/real-data-onboarding-selftest.ts` · 명령 `npm run test:real-data-onboarding`
- 비공개 fixture · dry-run 공식 예시만 스테이징 검수 적격 · 마켓 단독/유료 API/CAPTCHA/발명 가격 거절 · `writeAttempted=false` · `publicVisible=false`
- Docs: `docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md`
- Tests: `test:real-data-onboarding` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실공식 KR 제품·실병원 publishable·Staging/Production 쓰기는 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T03 · Admin review end-to-end verification

- 계약: `src/lib/admin/adminReviewE2E.ts` (제품·병원/전문가 레인 · candidate→evidence→duplicate→needs_review→admin_reviewed→publishable · 공개성 · Organic 독립)
- Selftest: `scripts/admin-review-e2e-selftest.ts` · 명령 `npm run test:admin-review-e2e`
- fixture·미승인 비공개 · dry-run 공식 병원만 publishable 평가 · 유료 관계가 Organic 순위 불변 · `writeAttempted=false`
- Docs: `docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md`
- Tests: `test:admin-review-e2e` · `test:usage-media-admin-ops` · `test:clinic-stage6` · `test:commercial-separation` · `test:organic-commerce` · 변경 ESLint · `tsc` — **통과**
- Preview 관리자 로그인 육안·공식 병원 실출처는 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T02 · Staging read-only release gates

- 계약: `src/lib/release/stagingReleaseGate.ts` (환경 식별·헬스·테이블/계약·auth callback·Storage·게시 상태·migration · factKind 분리)
- 러너: `scripts/run-staging-release-gate.ts` · selftest `scripts/staging-release-gate-selftest.ts`
- 명령: `npm run test:staging-release-gate` · `npm run check:staging-release-gate` (`--mode=static|readonly`)
- 기본 static 읽기 전용 · Production 식별 시 중단 · `writeAttempted=false` · 비밀/전체 ref 미출력
- Dashboard 전용(Redirect URL·care-photos 실버킷·migration 적용 이력·published 집계)은 `dashboard_only_unknown` — 위장 없음
- Docs: `docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md`
- Tests: `test:staging-release-gate` · `check:staging-release-gate` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T01 · Automated Preview and route validation

- 계약: `src/lib/validation/previewRouteValidation.ts` (공개·analyze/results/routine·profile/guidance·admin review·auth API · viewport 320/390/768/1440 · loading/empty/error 마커)
- 러너: `scripts/run-preview-route-validation.ts` · selftest `scripts/preview-route-validation-selftest.ts`
- 명령: `npm run test:preview-routes` · `npm run check:preview-routes` (`--mode=http|browser` + `BASE_URL`/`PREVIEW_BASE_URL`/`--base-url`)
- 로컬 검증: static inventory 통과 · HTTP 통과 · browser 스크린샷 **40장**(10 routes × 4 viewports) · `visualApprovalClaimed=false`
- 아티팩트: `artifacts/preview-route-validation/` (gitignore) · 육안 승인 위장 없음
- 스모크 재사용: `test:smoke` 라우트 인벤토리 확장 · Preview SSO 우회 금지 · Playwright chromium
- Docs: `docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md` · Preview 체크리스트 갱신
- Tests: `test:preview-routes` · `check:preview-routes` · `test:smoke` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 사람 Preview/실기기 육안·SSO 로그인은 **미검증** (`external_only`)
- Staging/Production DB·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-23 T06 · Final integration + release evidence

- 여정 연결 증거 계약: `src/lib/release/finalIntegrationEvidence.ts` · 문서 `docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md`
- empty/loading/error a11y: `ProductUsageGuide` · `PhotoAssetsSettingsPanel` (`role="status"` / `aria-busy`)
- 빌드 안전: `supabase/browser`·`server` empty public env placeholder (legacy와 동일 · 실키 없이 throw 방지)
- landmark 자동촬영 **기본 OFF** · 수동 3각도 유지 · Phase 3.1 deferred
- Tests: `test:final-integration` · `test:journey` · `test:master-execution` · `test:guided-capture` · `test:guided-landmark` · `test:photo-comparison` · `test:symptom-safety` · `test:commercial-separation` · `test:content-disclosure` · `test:autopilot-queue` · `check:release-security` · 변경 ESLint · `tsc` · `npm run build`(env 없음) — **통과**
- Preview 육안·실기기·P1-006 법무·공식 병원·WQG-P0-002 — **미검증** (`external_only`) · 위장 없음
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-23 T05 · Usage media localization + admin operations

- 사용 가이드 메타: 도포량·순서·빈도·주의·패치 테스트·도포 영상 + 정직한 fallback 상태
- 국가·언어별 offer 표시: 재고·가격·판매처 **미발명** · 미확인 지역 빈 상태 · 미검증 URL CTA 제외
- 관리자 운영: 후보 검수 · 중복 병합 · 근거 검토 · 상태 전환 · 만료 갱신 큐 · 재시도 · 감사 기록 · local/Staging dry-run (in-memory)
- UI: `ProductUsageGuide` 패치 테스트·fallback 고지 · Admin `/admin/catalog/ops` · API `/api/admin/catalog-ops`
- Docs: `docs/usage-media-localization-admin-ops.md`
- Tests: `test:usage-media-admin-ops` · `test:usage-media` · 변경 ESLint · tsc — **통과**
- Staging/Production DB 쓰기·실 offer 재고·main·commit/push 미실행
- next_task: `T06` Final integration (완료됨 → 위 T06 항목)

## 2026-07-23 T04 · Organic commerce + professional routing

- Organic/Affiliate/Sponsored: 제휴 링크 구조 · Organic 전용 랭킹 · 광고 슬롯 · in-memory 지속화 · API · UI 라벨 · 애널리틱스 · `/admin/commerce`
- 유료 관계 필드가 Organic score/순위를 바꾸지 않음 · 건강·증상 프로필 광고 타기팅 거부
- 증상 기반 전문가 번들: 라우팅 · 일반 vs 제휴 병원 분리 · fixture 게시 차단 · guidance 연결 · `/api/care/professional-guidance`
- Docs: `docs/organic-commerce-professional-routing.md`
- Tests: `test:organic-commerce` · `test:commercial-separation` · `test:clinic-stage6` · `test:symptom-safety` · `test:care-guidance` · 변경 ESLint · tsc — **통과**
- 공식 병원 실출처·실제휴 URL 게시·Production 쓰기·main·commit/push 미실행
- next_task: `T05` Usage media localization (완료됨 → 위 T05 항목)

## 2026-07-23 T03 · Product automation · category expansion

- Ingestion 계약 18단계 · 공식출처 evidence · 정규화 · variants · images · INCI · offers · usage media 메타
- dedupe · field verification · eligibility · review status · refresh/resume checkpoint · Staging/admin 링크(쓰기 없음)
- 마스카라·립·샴푸/두피 카테고리 추출기 + 안전 추천 플로우(급성 눈/두피 신호 시 추천 중단)
- Fixtures/dry-run만 · `recommendation_ready=0` (live official 미검증) · `autoPromote=false`
- Docs: `docs/catalog-product-automation.md`
- Tests: `test:product-automation` · `test:full-beauty` · `test:master-execution` · 변경 ESLint · tsc — **통과**
- 실공식 출처·verified 구매 SKU·Staging/Production 쓰기·main·commit/push 미실행
- next_task: `T04` Organic commerce + professional routing (완료됨 → 위 T04 항목)

## 2026-07-23 T02 · 3/7/15/30 follow-up lifecycle

- Opt-in → 3/7/15/30 스케줄 → due → 체크인 → progress/adherence/irritation 결정 → 루틴 조정 → red-flag 에스컬레이션 → pause/resume
- 채널 배송 인터페이스: in_app / email / sms / push · dry-run·disabled·live_blocked 어댑터 · 상태 레코드 (`realDeliveryClaimed=false`)
- Persistence: 로컬 직렬화·재개 · 손상/누락 시 empty fallback
- 설정 UI SMS/푸시 동의 (실발송 미연결 고지) · 관리자 `/admin/care/follow-up` + API
- Tests: `test:follow-up-lifecycle` · `test:checkin-policy` · `test:checkin-scheduling` · `test:reminder-delivery` · 변경 ESLint · tsc — **통과**
- 실 email/SMS/push 발송·Production·main·commit/push 미실행
- next_task: `T03` product automation (완료됨 → 위 T03 항목)

## 2026-07-23 T01 Core journey · durable BeautyProfile

- 안전 파싱(`parseBeautyProfile`) · 프로필 병합 · 확인값 패치 sanitize
- 체크인 완료 시 추론 관찰값(자극·악화·중단·급성 신호)을 BeautyProfile에 누적
- 빈 목록이 `user_confirmed`로 고정되어 이후 추론 갱신을 막던 merge 버그 수정
- 서버 경계: `GET/PUT /api/care/beauty-profile` (로그인·검증·migrationPending 로컬 fallback)
- DRAFT migration: `supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql` (**미적용**)
- `/my/profile` 로컬+서버 병합 UI · Tests: `test:beauty-profile` · `test:master-execution` · `test:journey` · 변경 ESLint · tsc
- Staging/Production DB 미적용 · main 미병합 · commit/push 미실행
- next_task: `T02` follow-up lifecycle (완료됨)

## 2026-07-23 T00 Master audit — Autopilot 계약·실행 큐

- `KBEAUTY_MASTER_EXECUTION_PROMPT.md` 1회 정독 · 상태/로드맵/changelog/최근 커밋·핵심 경로 대조
- 신설: `docs/autopilot/EXECUTION_CONTRACT.md` · `docs/autopilot/MASTER_EXECUTION_QUEUE.md`
- 레거시 `docs/MASTER_EXECUTION_QUEUE.md` → autopilot canonical 포인터
- 분류: verified_complete / partial / external_only / remaining / deferred
- ROADMAP 사진 비교 체크박스 모순 수리 (코드 완료 vs Staging/Storage 대기 분리)
- Self-test: `npm run test:autopilot-queue`
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 2026-07-23 Stage 6 기반 + Preview 원격 검수 JSON

- 증상 기반 병원 후보 수집 어댑터·필드 검증·게시 게이트·언어/예산 필터 구현
- `/my/guidance`에 Organic/제휴 분리 병원 안내 + 상담 리드 최소동의 dry-run 연결
- 관리자 `/admin/clinics` 검수 화면 (fixture 게시 불가 · Production 쓰기 없음)
- Preview 원격 검수 JSON: 공개 artifact 라우트 + `VERCEL_URL` 자동 경로 + 로컬 fixture
- Tests: `test:clinic-stage6` · `test:clinic-referral` · `test:unified-review-remote` · 관련 ESLint/TS
- 공식 병원 실데이터·실발송 리드·Preview 육안·Production 미검증
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 2026-07-23 Master Execution 번들 (연속 구현)

- `docs/MASTER_EXECUTION_QUEUE.md`(현 canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md`)에 전체 요구사항 실행 큐를 기록하고 Q01–Q15·Q19–Q21을 완료 처리했다.
- BeautyProfile 조회·편집 UI `/my/profile` 추가. 확인값 우선 저장, 동의·비진단 문구 포함.
- 도메인 문진(마스카라·립·베이스·헤어) 완료 시 Care local BeautyProfile에 누적.
- `symptomSafety` ↔ `professionalRouting` 연결: 급성/전문가 분기 시 `professionalRoutes`를 추천·가이드에 전달하고 제품 추천 중단을 명시.
- 공통 제품·taxonomy·마스카라/립/샴푸 랭커·Organic 분리·3/7/15/30 체크인·자동화 파이프라인은 기존 미커밋 기반을 유지·회귀 검증.
- Tests: `test:master-execution` · `test:symptom-safety` · `test:care-guidance` · `test:full-beauty` · `test:journey` · `test:commercial-separation` · `test:checkin-scheduling` · 변경 ESLint · production build(Staging public env) — **통과**
- Preview·실기기·공식 병원/offer 실데이터·Production AI_PROVIDER는 미검증 (`blocked_external`)
- Phase 3.1 랜드마크 자동촬영은 deferred · flag OFF
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 현재 기준

- 최상위 계획: K-Beauty Match Master Plan **v4.2**
- GitHub 저장소: `akscnl6521/kbeauty-platform`
- 기준 브랜치: `main`
- 작업 브랜치: `feature/recommendation-usage-guide-display-20260720`
- 최근 main 병합: PR #29~#32 (영상 권리 검수 큐·통합 매니페스트·루틴 사용 가이드 연결)
- Production 배포: 이번 작업에서 미실행
- Production DB·환경변수 변경: 이번 작업에서 미실행

## 현재 완료된 핵심 기능

- 피부 고민·증상·부위 관찰 입력
- 위험 신호와 전문가 상담 우선 분기 (`professionalRoutes` 포함)
- 제품 추천 안전 필터와 Top 5 게이트
- **추천 자격(recommendation_ready)과 구매 가능(commerce) 분리** (Phase 2.5~2.6.2)
- **Phase 3.0 안내형 얼굴 촬영 MVP + AI 분석 대기 UX** (기본 UX)
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- **3/7/15/30 follow-up lifecycle** (opt-in·due·결정·루틴조정·red-flag·resume/fallback·채널 dry-run · 실발송 미연결)
- 장기 BeautyProfile 저장·조회·편집 (`/my/profile`) · 체크인 반영 · 서버 API 경계(DRAFT 미적용 시 로컬 fallback)
- 마스카라·립·샴푸 속성 추천 + **T03 자동화 파이프라인·안전 추천 dry-run** (실구매 verified SKU 부족 시 속성/픽스처 예시만)
- 체크인 이메일 dry-run / Resend adapter 코드 준비 (실발송 없음)
- Preview Care admin · 체크인 이메일 테스트 UI 육안 통과
- 체크인 이메일 큐 Schema A Staging 적용·검증 완료 (Production 미적용)
- 사진 비교 동의·저장·삭제 흐름 코드·테스트 완료 (WQ-B · DRAFT migration 미적용 · care-photos 미생성)
- 시나리오 파일럿 Phase 2~2.6.2 종료
- 재방문 대시보드 · 체크인 스케줄 · Care worker dry-run (WQ-C/D/E)
- 관리자 제품·성분·검증·카탈로그·사용 가이드·disclosure
- **Stage 6 기반**: 병원 후보 어댑터·검증 게이트·안내 UI·상담 리드 dry-run·관리자 검수 (실병원 게시 데이터 없음)
- **T03 제품 자동화**: ingestion 계약·카테고리 확장 fixture dry-run · admin review 링크 (Staging 쓰기 없음)
- **T04 Organic commerce**: 제휴 링크 구조·Organic 분리 랭킹·광고 슬롯·이벤트·UI 라벨·`/admin/commerce` · 전문가 라우팅 번들 (실제휴·실병원 게시 제외)
- **T05 사용 가이드 현지화·운영**: 패치 테스트·영상 fallback · 국가/언어 offer(미발명) · admin ops dry-run (`/admin/catalog/ops`)
- **T06 최종 통합·릴리스 증거**: 여정 연결 계약 · empty/loading a11y · supabase build placeholder · 로컬 자동검증·production build 통과 · Preview/실기기는 external_only
- **P2-T01 Preview/라우트 자동 검증**: 계약·HTTP/브라우저 러너·스크린샷·JSON · 육안 승인 미주장
- **P2-T02 Staging 읽기 전용 릴리스 게이트**: 환경 식별·헬스·계약·auth·Storage·게시·migration · Dashboard 미확인 분리
- **P2-T03 Admin review E2E**: 제품·병원 레인 · fixture 비공개 · Organic 독립 · dry-run
- **P2-T04 실데이터 온보딩 준비**: 출처 매니페스트·provenance·공식 우선·stale·체크리스트·템플릿·dry-run·거절 사유 · 비공개 fixture
- **P2-T05 Final Preview 증거 패키지**: Phase 2 자동 회귀 · 6버킷 분리 · 1회성 사람 검증 절차 · 육안/실기기/Dashboard/Production 위장 없음
- **P3-T01 공식 한국 제품 출처 온보딩**: 브랜드/공식몰/INCI · 이미지·variants·가격·재고·국가·사용가이드 · provenance · 재개·dedupe·stale · fixture dry-run · 비공개

## 자동화 안전 상태

- 자동 게시 금지 · Production 쓰기 금지
- Organic과 광고·제휴 점수 분리
- 광고 슬롯·스폰서 카드는 Organic 레인 밖 · 건강정보 타기팅 금지
- anon `product_offers` write 권한 0
- Phase 3.x 사진은 브라우저 임시 object URL만 · Storage 영구 저장 없음 · 랜드마크 좌표 미저장
- 병원 fixture는 `fixtureOnly` · 사용자 publishable 목록 비움
- 제품 자동화 fixture는 `liveVerified=false` · `recommendation_ready` 미부여
- 제휴 링크·상업 이벤트는 in-memory · Production DB 미기록

## 현재 진행 단계

**Stage 6 코드 기반 완료** — 공식 병원 실데이터·사람 검수·외부 차단 항목 잔여.

- WQ-G 문서: `docs/prelaunch/WQ-G_PRELAUNCH_GATE.md`
- 실행 큐: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (계약: `docs/autopilot/EXECUTION_CONTRACT.md`)
- Stage 6 문서: `docs/clinic-stage6-referral.md`
- **출시 가능으로 보지 않음**
  - **WQG-P0-002** = `RELEASE_GATE_PENDING`
  - 잔여: P0-003 · P1-003/005/006 Preview·실기기·정책 검수
- 기본 촬영 UX = Phase 3.0 수동 3각도 · Phase 3.1 = **deferred**
- main 미병합 · Production 미배포 · DB 미변경

## Phase 3.0 — 안내형 촬영 (현재 기본)

- 카메라/문진만 · 정면→좌45→우45 · 로컬 품질 · 분석 대기 UX
- 3.0.1 stream 유지 · 3.0.2 갤러리 금지
- 문서: `docs/analyze/PHASE30_GUIDED_CAMERA_CAPTURE.md`

## Phase 3.1 — 보류 요약

- 문서: `docs/analyze/PHASE31_FACE_LANDMARK_AUTO_CAPTURE.md`
- flag=1로만 진입 · 기본 사용자 경로에 자동 오류/디버그 미노출

## 다음 작업

Canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (`next_task` T07)

1. 공식 병원 후보 실출처 승인 후 dry-run→검수→publishable 전환 (가짜 게시 금지)
2. P0-003 / P1-003·005 Preview·실기기 육안 — **P2-T05 1회성 절차** 문서화됨 (대시보드 아님 · 사람 검수)
3. P1-006 개인정보 전송 범위 문구의 정책·법무 최종 검수
4. **WQG-P0-002** — `RELEASE_GATE_PENDING` (Production 배포 직전 최종 확인 · 지금 미실행)
5. Phase 3.1 자동 정렬은 **보류** 유지
6. (승인 대기) 사진 비교 Staging migration · `care-photos`
7. (승인 대기) BeautyProfile Staging migration · `beauty_profiles`
8. (승인 후) 권장 커밋 분할·feature push
9. (외부) 제품 자동화 live 공식 출처·verified 구매 SKU 검수
10. (외부) 실제 제휴 URL·수익 채널 연결

## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
