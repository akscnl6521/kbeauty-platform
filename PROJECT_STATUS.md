# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-23

## 2026-07-23 T01 Core journey · durable BeautyProfile

- 안전 파싱(`parseBeautyProfile`) · 프로필 병합 · 확인값 패치 sanitize
- 체크인 완료 시 추론 관찰값(자극·악화·중단·급성 신호)을 BeautyProfile에 누적
- 빈 목록이 `user_confirmed`로 고정되어 이후 추론 갱신을 막던 merge 버그 수정
- 서버 경계: `GET/PUT /api/care/beauty-profile` (로그인·검증·migrationPending 로컬 fallback)
- DRAFT migration: `supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql` (**미적용**)
- `/my/profile` 로컬+서버 병합 UI · Tests: `test:beauty-profile` · `test:master-execution` · `test:journey` · 변경 ESLint · tsc
- Staging/Production DB 미적용 · main 미병합 · commit/push 미실행
- next_task: `T02` 공식 병원 실출처 (`external_only`)

## 2026-07-23 T00 Master audit — Autopilot 계약·실행 큐

- `KBEAUTY_MASTER_EXECUTION_PROMPT.md` 1회 정독 · 상태/로드맵/changelog/최근 커밋·핵심 경로 대조
- 신설: `docs/autopilot/EXECUTION_CONTRACT.md` · `docs/autopilot/MASTER_EXECUTION_QUEUE.md`
- 레거시 `docs/MASTER_EXECUTION_QUEUE.md` → autopilot canonical 포인터
- 분류: verified_complete / partial / external_only / remaining / deferred
- ROADMAP 사진 비교 체크박스 모순 수리 (코드 완료 vs Staging/Storage 대기 분리)
- Self-test: `npm run test:autopilot-queue`
- next_task: 공식 병원 실출처 승인·publishable (external_only) · Preview/실기기 육안 병행
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
- 장기 BeautyProfile 저장·조회·편집 (`/my/profile`) · 체크인 반영 · 서버 API 경계(DRAFT 미적용 시 로컬 fallback)
- 마스카라·립·샴푸 속성 추천 구조 (실구매 verified SKU 부족 시 속성 예시만)
- 체크인 이메일 dry-run / Resend adapter 코드 준비 (실발송 없음)
- Preview Care admin · 체크인 이메일 테스트 UI 육안 통과
- 체크인 이메일 큐 Schema A Staging 적용·검증 완료 (Production 미적용)
- 사진 비교 동의·저장·삭제 흐름 코드·테스트 완료 (WQ-B · DRAFT migration 미적용 · care-photos 미생성)
- 시나리오 파일럿 Phase 2~2.6.2 종료
- 재방문 대시보드 · 체크인 스케줄 · Care worker dry-run (WQ-C/D/E)
- 관리자 제품·성분·검증·카탈로그·사용 가이드·disclosure
- **Stage 6 기반**: 병원 후보 어댑터·검증 게이트·안내 UI·상담 리드 dry-run·관리자 검수 (실병원 게시 데이터 없음)

## 자동화 안전 상태

- 자동 게시 금지 · Production 쓰기 금지
- Organic과 광고·제휴 점수 분리
- anon `product_offers` write 권한 0
- Phase 3.x 사진은 브라우저 임시 object URL만 · Storage 영구 저장 없음 · 랜드마크 좌표 미저장
- 병원 fixture는 `fixtureOnly` · 사용자 publishable 목록 비움

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

Canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (`next_task` T02)

1. 공식 병원 후보 실출처 승인 후 dry-run→검수→publishable 전환 (가짜 게시 금지)
2. P0-003 / P1-003·005 Preview·실기기 육안 (대시보드 아님 · 사람 검수)
3. P1-006 개인정보 전송 범위 문구의 정책·법무 최종 검수
4. **WQG-P0-002** — `RELEASE_GATE_PENDING` (Production 배포 직전 최종 확인 · 지금 미실행)
5. Phase 3.1 자동 정렬은 **보류** 유지
6. (승인 대기) 사진 비교 Staging migration · `care-photos`
7. (승인 대기) BeautyProfile Staging migration · `beauty_profiles`
8. (승인 후) 권장 커밋 분할·feature push

## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
