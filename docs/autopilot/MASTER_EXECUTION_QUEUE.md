# Master Execution Queue (Autopilot)

최종 갱신: 2026-07-24
계약: `docs/autopilot/EXECUTION_CONTRACT.md`
근거: `KBEAUTY_MASTER_EXECUTION_PROMPT.md` (수정 금지)
브랜치: `feature/recommendation-usage-guide-display-20260720`
감사 커밋 기준점(최근): `6deb7c5` clinic review/referral · `dacdf0b` guided capture/release docs

상태 토큰: `verified_complete` | `partial` | `external_only` | `remaining` | `deferred`

---

## next_task

| 필드 | 값 |
|------|-----|
| ID | `T07` |
| 제목 | 공식 병원 후보 실출처 승인 후 dry-run → 관리자 검수 → publishable (fixture 게시 금지) |
| 분류 | `external_only` (출처 승인) + 승인 후 `remaining` 코드 연결 |
| 에이전트 단독 | 불가 — 공식 출처·사람 검수 필요 |
| 대안(코드 가능) | **P2-T01·P2-T02·P2-T03 완료** · 피부과 재검증 주기 인터페이스(실운영 스케줄러 제외) |

사람 검수가 가능하면 우선순위:
1. P0-003 / P1-003 Preview 육안 (`external_only`)
2. P1-005 실기기 (`external_only`)
3. P1-006 정책·법무 (`external_only`)

---

## completed_task (이번 번들)

| 필드 | 값 |
|------|-----|
| ID | `P2-T03` |
| 제목 | Admin review end-to-end verification (제품·병원/전문가 후보 · evidence · duplicate · needs_review/admin_reviewed/publishable · 공개성 · Organic 독립 · local/Staging dry-run) |
| 분류 | `verified_complete` (하네스·selftest) · Preview 관리자 육안·공식 병원 실출처는 `external_only` |
| 검증 | `npm run test:admin-review-e2e` · `test:usage-media-admin-ops` · `test:clinic-stage6` · `test:commercial-separation` · `test:organic-commerce` · 변경 ESLint · `tsc` |

### 직전 completed

| 필드 | 값 |
|------|-----|
| ID | `P2-T02` |
| 제목 | Staging read-only release gates (환경 식별·헬스·테이블/계약·auth callback·Storage·게시 상태·migration · verified vs dashboard_only_unknown · Production 쓰기 없음) |
| 분류 | `verified_complete` (계약·static/selftest) · Dashboard Redirect/Storage/적용 이력은 `dashboard_only_unknown` |
| 검증 | `npm run test:staging-release-gate` · `npm run check:staging-release-gate` · `test:autopilot-queue` · 변경 ESLint · `tsc` |

### 그 이전 completed

| 필드 | 값 |
|------|-----|
| ID | `P2-T01` |
| 제목 | Automated Preview and route validation (공개·analyze/results/routine·profile/guidance·admin review·auth API · loading/empty/error 마커 · viewport 320/390/768/1440 · 스크린샷+JSON · 육안 승인 미주장) |
| 분류 | `verified_complete` (계약·selftest·static runner) · 사람 Preview/실기기 육안·SSO 로그인은 `external_only` |
| 검증 | `npm run test:preview-routes` · `npm run check:preview-routes` · 로컬 `--mode=browser` 스크린샷 40 · `test:smoke` · `test:autopilot-queue` · 변경 ESLint · `tsc` |

### 그 이전 completed

| 필드 | 값 |
|------|-----|
| ID | `T06` |
| 제목 | Final integration + release evidence (여정 연결 계약 · empty/loading/error a11y · landmark OFF · supabase build placeholder · 로컬 자동검증·security·production build · Preview/device 증거는 external_only로 정직 기록) |
| 분류 | `verified_complete` (코드·selftest·build) · Preview/실기기/법무/공식 병원/WQG-P0-002는 `external_only` |
| 검증 | `npm run test:final-integration` · `test:journey` · `test:master-execution` · `test:guided-capture` · `test:guided-landmark` · `test:photo-comparison` · `test:symptom-safety` · `test:commercial-separation` · `test:content-disclosure` · `test:autopilot-queue` · `check:release-security` · 변경 ESLint · `tsc` · `npm run build` |

### 그 이전 completed

| 필드 | 값 |
|------|-----|
| ID | `T05` |
| 제목 | Usage media localization + admin operations (도포량·순서·빈도·주의·패치 테스트·도포 영상 메타·fallback · 국가/언어 offer 미발명 · 후보 검수·중복 병합·근거·상태 전환·만료 큐·재시도·감사 · local/Staging dry-run) |
| 분류 | `verified_complete` (코드·selftest) · 실 offer 재고·Staging/Production DB 쓰기·Preview 육안은 `partial`/`external_only` |
| 검증 | `npm run test:usage-media-admin-ops` · `test:usage-media` · 변경 ESLint · `tsc` |

| 필드 | 값 |
|------|-----|
| ID | `T04` |
| 제목 | Organic commerce + professional routing (제휴 링크·Organic 랭킹·광고 슬롯·스폰서 카드·이벤트·UI 라벨·admin · 증상 전문가 번들·일반/제휴 병원 분리·fixture 차단) |
| 분류 | `verified_complete` (코드·selftest) · 실제휴 URL·실병원 publishable·수익 채널은 `partial`/`external_only` |
| 검증 | `npm run test:organic-commerce` · `test:commercial-separation` · `test:clinic-stage6` · `test:symptom-safety` · `test:care-guidance` · 변경 ESLint · `tsc` |

| 필드 | 값 |
|------|-----|
| ID | `T03` |
| 제목 | Product automation · category expansion (ingestion 계약·공식출처 evidence·정규화·variants·images·INCI·offers·usage media·dedupe·eligibility·review·refresh/resume·admin 링크 · 마스카라/립/샴푸 안전 추천 dry-run) |
| 분류 | `verified_complete` (코드·fixture selftest) · 실공식 출처·verified 구매 SKU는 `partial`/`external_only` |
| 검증 | `npm run test:product-automation` · `test:full-beauty` · `test:master-execution` · 변경 ESLint · `tsc` |

| 필드 | 값 |
|------|-----|
| ID | `T02` |
| 제목 | 3/7/15/30 follow-up lifecycle (opt-in·due·결정·루틴조정·red-flag·resume/fallback·채널 dry-run·admin) |
| 분류 | `verified_complete` (코드·selftest) · 실 email/SMS/push는 `partial`/`external_only` |
| 검증 | `npm run test:follow-up-lifecycle` · `test:checkin-policy` · `test:checkin-scheduling` · `test:reminder-delivery` · 변경 ESLint · `tsc` |

| 필드 | 값 |
|------|-----|
| ID | `T01` |
| 제목 | Core journey + durable BeautyProfile (파싱·병합·체크인 반영·서버 경계·DRAFT migration·UI) |
| 분류 | `verified_complete` (코드·selftest) · Staging/Production 적용은 `external_only` |
| 검증 | `npm run test:beauty-profile` · `test:master-execution` · `test:journey` · 변경 ESLint · `tsc` |

---

## A. verified_complete (코드·selftest로 확인)

| ID | 항목 | 근거 경로 / 테스트 |
|----|------|-------------------|
| VC-01 | 스킨케어 분석→추천→루틴→저장→체크인 연결 | Care local-store · analyze/results · `test:journey` |
| VC-02 | 위험 신호 → `professionalRoutes` · 제품 추천 중단 | `symptomSafety` · `test:symptom-safety` · `test:master-execution` |
| VC-03 | BeautyProfile 계약·저장·`/my/profile` 편집 | `src/lib/profile` · `src/app/my/profile` |
| VC-04 | 도메인 문진 → BeautyProfile 누적 | DomainQuiz · master-execution selftest |
| VC-05 | 전체 taxonomy · 기기/구강/규제/전문가용 분리 | `src/lib/catalog/taxonomy` · `test:full-beauty` |
| VC-06 | 공통 제품·적격·상업 메타 분리 | `commonProduct.ts` · commercial separation |
| VC-07 | Organic / Affiliate / Sponsored 분리 | `test:commercial-separation` · **T04** `test:organic-commerce` |
| VC-23 | 제휴 링크·광고 슬롯·스폰서 카드·상업 이벤트·admin | `src/lib/commercial/*` · `/admin/commerce` · `test:organic-commerce` |
| VC-24 | 증상 전문가 번들 · 일반/제휴 병원 · fixture 차단 · guidance | `professionalGuidanceBundle` · `test:organic-commerce` · `test:clinic-stage6` |
| VC-08 | 3/7/15/30 체크인·루틴 조정 UI/정책 | checkinPolicy · `/my/check-ins` · `test:checkin-scheduling` |
| VC-21 | Follow-up lifecycle (opt-in→due→결정→조정→red-flag→resume/fallback·채널 dry-run·admin) | `followUpLifecycle*` · `test:follow-up-lifecycle` · 실발송 제외 |
| VC-09 | 수집·정규화·중복·갱신 파이프라인 코드 | catalog scripts · refresh/exception queues |
| VC-22 | Product automation ingestion 계약·카테고리 추출·fixture dry-run·안전 추천·admin 링크 | `src/lib/catalog/productAutomation` · `test:product-automation` · `docs/catalog-product-automation.md` |
| VC-10 | 국가·언어·판매처 구조 | locale/offer 기존 유지 |
| VC-11 | Phase 3.0 수동 3각도 촬영 · 갤러리 금지 | guided-capture · WQG-P0-001 카피 |
| VC-12 | WQG-P1-002 카메라/landmark 동적 import | `test:guided-capture` · `test:guided-landmark` |
| VC-13 | 사용 가이드·루틴·부위 화면 연결 | `test:usage-media` 계열 |
| VC-25 | T05 사용 가이드 현지화·패치/영상 fallback · 국가/언어 offer(미발명) · admin ops dry-run | `usageGuidanceComplete` · `localizedOffers` · `adminOps` · `test:usage-media-admin-ops` |
| VC-26 | T06 최종 통합·릴리스 증거 · empty/loading a11y · build placeholder · landmark OFF | `finalIntegrationEvidence` · `test:final-integration` · `docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md` |
| VC-27 | P2-T01 Preview/local 라우트 자동 검증 · viewport 스크린샷 파이프라인 (육안 승인 미주장) | `previewRouteValidation` · `test:preview-routes` · `check:preview-routes` · `docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md` |
| VC-28 | P2-T02 Staging 읽기 전용 릴리스 게이트 · dashboard_only_unknown 정직 분리 | `stagingReleaseGate` · `test:staging-release-gate` · `check:staging-release-gate` · `docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md` |
| VC-29 | P2-T03 Admin review E2E · fixture 비공개 · Organic 독립 · dry-run | `adminReviewE2E` · `test:admin-review-e2e` · `docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md` |
| VC-14 | Stage 6 **코드 기반** 병원 어댑터·게이트·안내·리드 dry-run·admin | `test:clinic-stage6` · `/my/guidance` · `/admin/clinics` |
| VC-15 | Preview 원격 검수 JSON 경로 | `test:unified-review-remote` |
| VC-16 | 추천↔commerce 분리 Phase 2.5–2.6.2 | recommendation commerce selftests |
| VC-17 | 체크인 이메일 큐 Schema A Staging 적용(코드·검증) | Staging verify 통과 · **실발송 없음** |
| VC-18 | 사진 비교 **정책/API/UI/selftest** (WQ-B) | `test:photo-comparison` · migration/Storage는 별도 |
| VC-19 | Master execution Q01–Q15·Q19–Q21 | 레거시 큐와 동일 사실 · 본 문서가 canonical |
| VC-20 | BeautyProfile 안전 파싱·병합·체크인 반영·서버 API·DRAFT migration | `test:beauty-profile` · `/api/care/beauty-profile` · `DRAFT_DO_NOT_APPLY_beauty_profiles.sql` |

---

## B. partial

| ID | 항목 | 완료 부분 | 미완 |
|----|------|-----------|------|
| PA-01 | 마스카라·립·샴푸 추천 | 속성 랭커·패널·**T03 안전 추천 플로우·자동화 후보 연결** | 실구매 verified SKU 풀 부족 · fixture≠구매 가능 |
| PA-02 | 전문가/병원 안내 | 라우팅·UI·fixture 게이트·**T04 번들** | 공식 병원 publishable 0 · 실리드 전달 없음 |
| PA-03 | 체크인 알림 | 스케줄·큐·email/sms/push 인터페이스·dry-run/Resend 어댑터·상태 레코드 | 실발송·DNS·Production 키·실 SMS/푸시 인프라 없음 |
| PA-04 | 사진 비교 운영 | 동의·삭제 코드 | Staging `care-photos` migration 미적용 · Storage 미연결 |
| PA-05 | 전체 lint/품질 | 변경 파일 lint·관련 selftest | 저장소 전체 ESLint 기존 실패(다수) 잔존 |
| PA-06 | 카탈로그 자동화 운영 | 계획·아티팩트·가드·**T03 ingestion dry-run** | 운영 worker는 사람/스케줄러 영역 · 실공식 live verify 미연결 |
| PA-07 | BeautyProfile 서버 동기화 | API·DRAFT·로컬 fallback | Staging `beauty_profiles` 미적용 · 계정 간 실동기화 미검증 |
| PA-08 | 상업/제휴 운영 | T04 코드·이벤트·admin | 실제휴 URL·수익 채널·Production 미연결 |
| PA-09 | 출시 통합 | T06 코드·로컬 자동검증·build · **P2-T01 라우트** · **P2-T02 Staging 게이트** · **P2-T03 admin review E2E** | Preview/실기기/법무·Dashboard Redirect/Storage 사람 검수 잔여 |

---

## C. external_only (에이전트 위장 완료 금지)

| ID | 항목 | 비고 |
|----|------|------|
| EX-01 | Preview 관리자/사용자 육안 (P0-003 / P1-003) | 사람 |
| EX-02 | 실기기 Android/iPhone (P1-005) · Phase 3.1 재개 조건 | 사람 |
| EX-03 | P1-006 개인정보 전송 범위 정책·법무 | 사람 |
| EX-04 | 공식 병원 실출처 승인·검수·publishable | fixture 게시 금지 · **next_task T07** |
| EX-05 | WQG-P0-002 Production `AI_PROVIDER` | `RELEASE_GATE_PENDING` · 지금 미실행 · 키 미기록 |
| EX-06 | Production 배포 · main 병합 · Production DB/env | 명시 승인 전 금지 |
| EX-07 | 사진 비교 Staging migration · `care-photos` 버킷 | 승인 대기 |
| EX-08 | 상담 리드 실전달 채널 | 승인 후 |
| EX-09 | 공식 offer/전성분 미확보 제품 자동 완성 | 차단 정책 유지 |
| EX-10 | BeautyProfile Staging migration (`beauty_profiles`) 적용 | DRAFT만 존재 · 승인 전 미적용 |
| EX-11 | 제품 자동화 live 공식 출처·verified 구매 SKU 검수 | T03 코드 완료 · 실데이터는 사람/승인 |
| EX-12 | 실제 제휴 URL·수익 채널 연결 | T04 코드 완료 · 실계약/키 미연결 |

---

## D. remaining (코드/정책으로 남을 수 있는 항목)

| ID | 항목 | 단계 |
|----|------|------|
| RE-01 | ~~화장품 제휴 링크 데이터 구조~~ | **T04로 코드 완료** → EX-12 실연결 |
| RE-02 | ~~제휴 피부과 ↔ Organic 분리 코드~~ | **T04/Stage6 코드 완료** · 실데이터는 EX-04 |
| RE-03 | ~~광고 슬롯 · 스폰서 카드 · 전환 이벤트~~ | **T04로 코드 완료** |
| RE-04 | ~~건강정보 광고 타기팅 금지 테스트~~ | **T04로 코드 완료** |
| RE-05 | ~~영상 URL·권리 만료 자동 갱신 인터페이스~~ | **T05 dry-run 완료** · 실운영 스케줄러는 잔여 |
| RE-06 | 피부과 정보 재검증 주기 운영화 | 단계 8 |
| RE-07 | 제휴·광고 계약 상태 갱신 · rollback | 단계 8 |
| RE-08 | WQ-F Phase 2+ schema/runtime (별도 승인) | 시나리오 |
| RE-09 | ~~출시 전 코드 통합 자동검증~~ | **T06로 코드·build 완료** · 사람 Preview/실기기는 EX-01/02 |

---

## E. deferred

| ID | 항목 | 상태 |
|----|------|------|
| DF-01 | Phase 3.1 랜드마크 자동촬영 | 코드 보존 · flag 기본 OFF · Android blocker · 재개=실기기 통과 후 |

---

## F. 레거시 Q-번호 매핑

| Q | 상태(레거시) | Autopilot 분류 |
|---|-------------|----------------|
| Q01–Q15, Q19–Q21 | done | `verified_complete` |
| Q16 | blocked_external | `external_only` |
| Q17 | blocked_external | `external_only` (EX-05/06) |
| Q18 | deferred | `deferred` (DF-01) |

---

## G. T00 감사에서 수리한 문서 불일치

| 이슈 | 조치 |
|------|------|
| ROADMAP에 사진 비교 `[x]`와 `[ ]` 동시 존재 | 코드 완료 vs Staging/Storage 대기를 분리 표기 |
| STATUS가 Q20–Q21 누락 요약 | Q01–Q15·Q19–Q21 완료로 정합 |
| 큐 canonical 경로 부재 | `docs/autopilot/*` 신설 · 레거시는 포인터 |

---

## H. Self-test

```bash
npm run test:autopilot-queue
npm run test:final-integration
npm run test:preview-routes
npm run test:staging-release-gate
npm run test:admin-review-e2e
```

검증: 계약/큐 존재 · 필수 헤더 · `next_task` · 분류 섹션 · 레거시 포인터 · 핵심 경로 존재 · 금지 문구(Production 미배포 등) 유지 · T06 증거 문서 · P2-T01 라우트 검증 · P2-T02 Staging 릴리스 게이트 · P2-T03 Admin review E2E.
