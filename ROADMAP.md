# ROADMAP.md — K-Beauty Match

최종 갱신: 2026-07-24

현재 실제 진행 상태는 이 문서를 우선한다. 최상위 방향은 Master Plan **v4.2**를 따른다.

## 현재 단계

**단계 6 피부과 기반(코드) + 단계 5 리텐션 + Phase 3.0 수동 촬영** · Phase 3.1 deferred · WQ-G · WQG-P0-002=`RELEASE_GATE_PENDING` · 공식 병원 실데이터는 미연결

## 완료

### 최상위 실행 명세 기반 확장 (2026-07-23)

- [x] 장기 BeautyProfile 계약과 기존 Care 로컬 저장 흐름 연결
- [x] 사용자 확인값/추론값 우선순위 및 구형 V1 스냅샷 fallback
- [x] BeautyProfile 조회·편집 UI (`/my/profile`)
- [x] 도메인 문진 → BeautyProfile 누적
- [x] 체크인 → BeautyProfile 추론 누적 · 안전 파싱/병합 · 서버 API 경계 · DRAFT migration (Staging 미적용)
- [x] 전체 beauty taxonomy의 기기·구강·규제·전문가용 분리
- [x] 공통 제품/규제/추천 적격/상업 메타데이터 계약
- [x] 증상별 피부과·두피·알레르기·치과·응급 라우팅 (symptomSafety 실연결)
- [x] 마스카라·립·샴푸 기존 category-specific 랭커와 새 taxonomy 회귀 검증
- [x] T03 제품 자동화 ingestion 계약·카테고리 확장 fixture dry-run·안전 추천 (`test:product-automation`)
- [x] T04 Organic/Affiliate/Sponsored 분리 · 전문가 라우팅 번들 (`test:organic-commerce`)
- [x] T05 사용 가이드 현지화·패치/영상 fallback · 국가/언어 offer · admin ops dry-run (`test:usage-media-admin-ops`)
- [x] T06 최종 통합·릴리스 증거 (`test:final-integration` · landmark OFF · build placeholder · Preview/device external_only)
- [x] **P2-T01** Preview/local 라우트 자동 검증 (`test:preview-routes` · `check:preview-routes` · viewport 320/390/768/1440 · 스크린샷 증거 · 육안 승인 미주장)
- [x] **P2-T02** Staging 읽기 전용 릴리스 게이트 (`test:staging-release-gate` · `check:staging-release-gate` · Dashboard 미확인 분리 · Production 쓰기 없음)
- [x] **P2-T03** Admin review E2E 검증 (`test:admin-review-e2e` · 제품·병원 레인 · fixture 비공개 · Organic 독립 · dry-run)
- [x] **P2-T04** 실데이터 온보딩 준비 (`test:real-data-onboarding` · 매니페스트·provenance·공식 우선·stale·체크리스트·템플릿·dry-run·거절 사유 · 비공개 fixture)
- [x] **P2-T05** Final Preview 증거·사람 승인 패키지 (`test:phase2-final-evidence` · `check:phase2-final-evidence` · 6버킷 분리 · 1회성 검수 절차 · 위장 승인 금지)
- [x] Master execution queue 문서화 (`docs/autopilot/MASTER_EXECUTION_QUEUE.md` · 계약 `docs/autopilot/EXECUTION_CONTRACT.md`)
- [x] **T07-02** 서울 피부과 후보 HIRA 수집 파이프라인 (재개·dedupe·provenance·stale · fixture dry-run · 게시 금지)

### 플랫폼 핵심 사용자 여정

- [x] 국가·언어 기본 구조
- [x] 피부 고민·부위·증상 입력
- [x] 위험 신호 분기
- [x] 제품 추천 안전 필터
- [x] 추천 이유·주의·화장품 한계 표시
- [x] 현재 제품과 루틴 관리
- [x] Day 3·7·15·30 지속 관리
- [x] 전문가 상담 안내와 상담 준비 흐름 기반

### 제품 데이터 자동화

- [x] 한국 화장품 후보 수집·정규화
- [x] 공식 출처와 전성분 검증 구조
- [x] 중복 검사와 Staging 후보 분리
- [x] 제품 갱신 정책과 due queue
- [x] 제품 예외 검수 큐
- [x] 자동 게시·Production 쓰기 차단
- [x] 매일 09:20 KST 갱신 아티팩트 생성
- [x] **T03** ingestion 계약·카테고리 추출(마스카라/립/샴푸)·fixture dry-run·refresh/resume·admin 링크 (`test:product-automation`)
- [ ] 실공식 출처 live verify · verified 구매 SKU 풀 (external_only)

### 피부과 후보 자동화

- [x] 증상 기반 피부과 추천 정책
- [x] 공식 근거와 검증 상태 구조
- [x] 제휴 여부와 Organic 적합도 분리
- [x] 피부과 Staging 계획과 검수 큐
- [x] 매주 월·목 09:40 KST 검수 아티팩트 생성
- [x] **T07-02** HIRA 서울 피부과 후보 ingestion (공식 필드 필터·checkpoint·dedupe·audit · `test:seoul-dermatology-ingestion`)
- [ ] 실 HIRA live 수집 → 관리자 검수 → publishable (external_only · fixture 게시 금지)

### 통합 운영 안전

- [x] 카탈로그·피부과 자동화 통합 안전 감사
- [x] 제품 갱신·제품 예외·피부과 검수 통합 매니페스트
- [x] 일반 CI와 Core Journey CI 통과
- [x] main 병합 완료: PR #19~#27

### 관리자 통합 검수 화면

- [x] 통합 검수 매니페스트 읽기 모델 구현
- [x] 관리자 GET 전용 API 구현
- [x] 제품 갱신·예외·피부과 항목 통합 목록
- [x] critical/high/medium/low 우선순위 표시
- [x] 출처·우선순위·검색 필터
- [x] 변경 전후·근거·공식 출처·마지막 확인일 표시
- [x] 빈 상태·오류 상태·모바일 대응
- [x] 자체 테스트와 CI·빌드 검증
- [ ] 실제 Preview 로그인 화면 육안 검수
- [x] Preview 원격 검수 JSON 전달 경로 연결 (공개 artifact 라우트 + VERCEL_URL 자동 · 대시보드 URL 설정은 선택)

## 지금 진행할 작업

### 단계 4 — 제품 사용 영상과 루틴

- [x] 영상 자산·권리 상태 정책 모델
- [x] 게시 가능한 제품 사용 가이드 선택 정책
- [x] 도포량·사용 순서·아침/저녁 정보 모델
- [x] 광고·협찬 표시와 Organic 점수 분리 정책
- [x] 루틴 화면(`/routine`) 사용 가이드 연결
- [x] 추천 결과 핵심 제품 카드 사용 가이드 연결 (공용 컴포넌트)
- [x] 권리 만료·삭제·비공개 점검 큐
- [x] 영상이 Organic 적합도 점수에 영향을 주지 않는 통합 회귀 테스트
- [x] 부위별 화면 사용 가이드 연결 (`/face-explorer`, results `area`, `/my/guidance`)
- [x] 관리자 영상 검수 화면 (제품 상세 읽기 전용)
- [x] AI 생성·광고·협찬 표시 정책 보강 (공용 disclosure)
- [x] 단계 4 본기능 코드·자동 테스트·Staging build 검증 완료
- [x] **T05** 도포량·순서·빈도·주의·패치 테스트·도포 영상 메타 + fallback · 국가/언어 offer(미발명) · admin 후보/중복/근거/전환/만료큐/재시도/감사 dry-run
- [x] **T06** 최종 통합·릴리스 증거 (여정 연결 계약 · empty/loading a11y · landmark OFF · 로컬 자동검증·security·production build) · Preview/실기기 육안은 미검증
- [x] **P2-T01** 공개·analyze/results/routine·profile/guidance·admin review 라우트 자동 검증 + viewport 스크린샷 파이프라인 (육안 승인 아님)
- [x] **P2-T02** Staging 읽기 전용 릴리스 게이트 (환경·헬스·계약·auth·Storage·게시·migration · dashboard_only_unknown 정직 분리)
- [x] **P2-T03** Admin review E2E (후보·근거·중복·needs_review/admin_reviewed/publishable · fixture 비공개 · Organic 독립)
- [x] **P2-T04** 실데이터 온보딩 준비 (출처 매니페스트·provenance·공식 우선·stale/refresh·검수 체크리스트·import 템플릿·dry-run·거절 사유 · 비공개 fixture · Production 쓰기 없음)
- [x] **P2-T05** Final Preview 증거 패키지 (Phase 2 자동 회귀 · 스크린샷/실기기/외부출처/Dashboard/main·Production 버킷 분리 · 1회성 사람 검증 문서 · 위장 승인 금지)
- [ ] Preview 수동 샘플 육안 확인 (콘솔 주입 검수 중단 · QA 페이지 미포함) — P2-T05 절차 문서화 · 사람 미실행
- [ ] Preview 관리자 로그인 후 Staging 미디어 육안 검수 — P2-T05 절차 문서화 · 사람 미실행
- [x] Preview 원격 검수 JSON 경로 연결 (코드·fixture·자동 Preview 경로)

## 다음 작업

Autopilot canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (`next_task` = T07)

1. 공식 병원 실출처 live 수집·승인 → 관리자 검수 → publishable (T07-02 파이프라인 코드 완료 · fixture 게시 금지)
2. P0-003 / P1-003·005 Preview·실기기 육안 (사람)
3. P1-006 개인정보 전송 범위 정책·법무 최종 검수
4. **WQG-P0-002** `RELEASE_GATE_PENDING` — Production 배포 직전 `AI_PROVIDER` 확인 (지금 미실행 · 키 미기록)
5. Phase 3.1 자동 정렬은 **보류** 유지
6. (승인 대기) 사진 비교 Staging migration · `care-photos`
7. (승인 대기) BeautyProfile Staging migration · `beauty_profiles`
8. (외부) 실제 제휴 URL·수익 채널 연결

### 단계 5 — 리텐션 보강

- [x] 3·7·15·30일 체크인 응답 분기 정책 (`checkinPolicy`)
- [x] 위험 신호 상담 우선 · 48시간 1회 재알림 정책 (발송 미연결)
- [x] `/my/check-ins` · `/my/check-ins/[id]` 화면 연결
- [x] 체크인 응답 기반 루틴 조정 제안 UI (승인 전 불변 · 일시 중지 · 되돌리기)
- [x] **T02 follow-up lifecycle** — opt-in·스케줄·due·progress/adherence/irritation·루틴조정·red-flag·resume/fallback · in_app/email/sms/push 인터페이스·dry-run·상태레코드·관리자 가시성 (`test:follow-up-lifecycle` · 실발송 미주장)
- [x] 체크인 이메일 큐 정책 (발송 미연결 · DRAFT migration)
- [x] 체크인 이메일 dry-run provider (disabled/dry_run/live_blocked · 실제 발송·SDK·API 키 없음 · admin UI 후순위)
- [x] 체크인 이메일 Resend live adapter 코드 준비 (게이트·allowlist·kill switch · mock self-test · 실제 발송·API 키·DNS 변경 없음 · main 미병합)
- [x] Preview 관리자 체크인 이메일 테스트 발송 UI/API (Production 차단 · same-origin · allowlist 서버 고정 · in-memory rate limit · mock self-test · 실제 발송 미실행 · DB audit 미구현 · main 미병합)
- [x] Care admin readiness 오류 분류 (`42501` vs `PGRST205`) · service_role care SELECT grant migration 작성
- [x] Staging care service_role SELECT grant migration 적용 (2026-07-21 · probe ready)
- [x] Preview `/admin/care` 육안 확인 (migration/permission 경고 없음 · counts only — no PII · 집계 카드 정상)
- [x] 체크인 이메일 큐 DRAFT Staging 검토 (적용 보류 · 테이블 미생성)
- [x] 체크인 이메일 큐 Schema A 코드·게이트 (dated migration · persistence · SKIP LOCKED claim · dry-run worker · Preview 분리 유지)
- [x] 사진 비교 동의·저장·삭제 **코드** (WQ-B · policy/API/UI/selftest)
- [ ] 사진 비교 Staging migration · `care-photos` Storage 연결 (승인 대기 · external_only)
- [x] Staging에 `20260722010000_create_checkin_email_queue.sql` Dashboard 적용 · `verify:checkin-email-queue-staging` **통과** (2026-07-22 · FK/status/payload negative · claim RPC · 실발송 없음 · Production 미적용)
- [x] 재방문 대시보드 보강 (WQ-C)
- [x] 알림 채널별 동의 분리 UI / 스케줄링 연결 (WQ-D · enqueue only · 실발송 없음)
- [x] Care worker admin / dry-run delivery (WQ-E · dry-run tick · retry/cancel · 실발송 없음)
- [x] WQ-F Phase 0/1: scenario Top10 model + KR core scenarios (30) + gap analysis (no fake pool fill)
- [x] WQ-F Scenario Top10 pilot artifacts (2026-07-22 · offline pools + selftest · no runtime fill)
- [x] WQ-F Scenario Top10 pilot enrichment (2026-07-22 · multiSource · global products + many-to-many pools · reuse 15–35% · honest ready shortfall · no runtime)
- [x] Phase 2.5 — recommendation ↔ commerce 분리 (`RECOMMEND_COMMERCE_SEPARATION`)
- [x] Phase 2.6 — Staging SELECT + Preview commerce 분리 검증
- [x] Phase 2.6.2 — A 엄격 RLS + BOJ verified OOS + Preview 수동 UI 검수 **종료** (2026-07-22)
- [x] Phase 3.0 — 안내형 얼굴 촬영 MVP + AI 분석 대기 UX (카메라 3각도 · 로컬 품질 · progress overlay · Storage/migration 없음 · `NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE`)
- [x] Phase 3.0.2 — 일반 사용자 갤러리 업로드 금지 (카메라/문진만)
- [~] Phase 3.1 — 얼굴 랜드마크 자동 정렬·자동 촬영 (**implemented · tests passed · Android blocker unresolved · deferred**) · 기본 flag OFF · 코드 보존
- [x] 프로젝트 UI 스킬 설치 (frontend-design, ui-ux-pro-max) + kbeauty-match-design + design-system 초안 (페이지 재디자인 미실시)
- [x] **WQ-G Prelaunch gate** 문서 (`docs/prelaunch/WQ-G_PRELAUNCH_GATE.md` · 조사만 · P0×3 / P1×6)
- [x] **WQG-P0-001** 사진 AI 분석 오인·동의 정합 (문진 기반 · 픽셀 외부 AI 미전송 · vision 미도입)
- [~] **WQG-P0-002** Production `AI_PROVIDER` — **`RELEASE_GATE_PENDING`** (배포 직전 · 지금 미실행)
- [x] **WQG-P1-002** CameraCapturePanel/landmark dynamic import (카메라 선택 시 로드 · SSR-safe 접근성 fallback · 회귀 테스트)
- [ ] Phase 3.1 실기기 안정화 재개 (Android Chrome · iPhone Safari 통과 후)
- [ ] WQ-F Phase 2+ 잔여: schema/runtime 확장 (D/E 보강 없이 · 별도 승인)

### 단계 6 — 증상 기반 피부과 실제 데이터

- [x] 공식 병원 후보 수집 어댑터·fixture·dry-run/live_blocked (실출처 미연결)
- [x] **T07-02** HIRA 서울 피부과 후보 재개 가능 수집 (공식 필드·provenance·dedupe·stale · 게시 금지)
- [x] 증상 태그·필드 검증·관리자 검수 게이트 (실데이터 검수 대기)
- [x] 진료시간·주소·예약 URL·언어 필드 검증 구조
- [x] 거리·언어·예산 필터
- [x] 제휴 병원 Organic 분리 표시 (`/my/guidance` · `/admin/clinics`)
- [x] 상담 리드 최소정보 동의 흐름 (dry-run only · DB 미저장)
- [ ] 공식 병원 실데이터 live 수집·사람 최종 검수 후 publishable 전환
- [ ] 상담 리드 실전달 채널 (승인 후)

### 단계 7 — 수익화

- [x] 화장품 제휴 링크 데이터 구조 (`affiliateLink` · in-memory store)
- [x] 제휴 피부과와 Organic 추천 분리 검증 (코드·selftest · 실데이터는 별도)
- [x] 광고 슬롯 안전 영역 정책
- [x] 스폰서 카드 분리 (`SponsoredCard` · Organic 레인 금지)
- [x] 클릭·리드·전환·수익 이벤트 (in-memory · Production 미연결)
- [x] 개인정보·건강정보 광고 타기팅 금지 테스트
- [ ] 실제 제휴 URL·수익 채널 연결 (external_only)

### 단계 8 — 자동 갱신·운영 자동화

- [x] **T05** 영상/가이드·offer 후보 운영 인터페이스 (상태 전환·만료 큐·재시도·감사 · dry-run · 실운영 스케줄러 제외)
- [ ] 영상 URL·권리 만료 실운영 갱신
- [ ] 피부과 정보 재검증 주기
- [ ] 제휴·광고 계약 상태 갱신
- [ ] 실패 재시도·중복 알림 억제 (실운영 채널)
- [ ] 변경 이력과 rollback (Production 연결)

### 단계 9 — 통합 검증과 출시

- [x] **T06** 코드 수준 여정 통합·릴리스 증거 문서·로컬 자동검증·production build (Preview/실기기·법무 제외)
- [x] **P2-T01** Preview/local 라우트·viewport 자동 검증 인프라 (사람 육안은 별도)
- [x] **P2-T02** Staging 읽기 전용 릴리스 게이트 인프라 (Dashboard 실확인·Production 직전 게이트는 별도)
- [x] **P2-T03** Admin review E2E 하네스 (사람 Preview 관리자 육안은 별도)
- [x] **P2-T04** 실데이터 온보딩 준비 계약·dry-run (실공식 데이터·Staging 쓰기는 별도)
- [x] **P2-T05** Final Preview 증거·사람 승인 패키지 (자동 회귀·버킷 분리·1회성 절차 · 사람 검수는 별도)
- [ ] 실제 제품·판매처·피부과 데이터 사람 최종 검수
- [ ] 전체 사용자 여정 Preview 검증
- [ ] 모바일·접근성·성능 재검증 (실기기)
- [ ] 개인정보·의료·광고 문구 검수 (법무)
- [ ] 보안 하드닝 (운영)
- [ ] Production 환경 확인
- [ ] Production 배포 승인 후 공개

## 차단 항목

- 공식 전성분·라벨을 확보하지 못한 제품은 자동 완성하지 않는다.
- 영상 권리가 확인되지 않으면 게시하지 않는다.
- 피부과 진료 분야는 광고 문구만으로 확정하지 않는다.
- Production·DB·환경변수·외부 제휴 활성화는 명시 승인 전 실행하지 않는다.
