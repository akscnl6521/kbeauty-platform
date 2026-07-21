# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-22

## 현재 기준

- 최상위 계획: K-Beauty Match Master Plan v4.1
- GitHub 저장소: `akscnl6521/kbeauty-platform`
- 기준 브랜치: `main`
- 작업 브랜치: `feature/recommendation-usage-guide-display-20260720`
- 최근 main 병합: PR #29~#32 (영상 권리 검수 큐·통합 매니페스트·루틴 사용 가이드 연결)
- Production 배포: 이번 작업에서 미실행
- Production DB·환경변수 변경: 이번 작업에서 미실행

## 현재 완료된 핵심 기능

- 피부 고민·증상·부위 관찰 입력
- 위험 신호와 전문가 상담 우선 분기
- 제품 추천 안전 필터와 Top 5 게이트
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- 체크인 이메일 dry-run provider (실제 발송 없음 · live 차단 · API 키 없음 · admin UI 후순위)
- 체크인 이메일 Resend live adapter 코드 준비 (실제 발송 없음 · API 키 미설정 · DNS 미변경 · staging allowlist · kill switch · Production 강제 차단)
- Preview 전용 관리자 체크인 이메일 테스트 발송 UI/API (mock self-test만 · in-memory rate limit · DB audit 없음 · 실제 발송은 Preview 배포 후 관리자 클릭 시만)
- Preview 이메일 미리보기 `siteOrigin` 서버 prop · Care admin readiness · service_role care SELECT · Preview `/admin/care` 육안 **통과**
- Preview `/admin/care/check-in-email-test` 육안 **통과** (2026-07-22 · 폼·미리보기 정상 · milestone/locale/kind 변경 정상 · migration/permission 오류 없음 · 실발송 없음)
- 체크인 이메일 큐 Schema A **Staging 적용·검증 완료** (2026-07-22 · `20260722010000_create_checkin_email_queue.sql` Dashboard 적용 · `npm run verify:checkin-email-queue-staging` **통과** · FK/status/payload negative · claim RPC · anon SELECT 거부 · 실발송 없음 · Production **미적용**)
- Fast Execution System v1 **추가** (`WORK_QUEUE.md` · `npm run project:*` · safe-command-gate · docs/FAST_EXECUTION_SYSTEM.md)
- 사진 비교 동의·저장·삭제 흐름 **코드·테스트 완료** (WQ-B · DRAFT migration 미적용 · `care-photos` bucket 미생성 · 실제 업로드 501)
- 재방문 대시보드 **코드·테스트 완료** (WQ-C · `/my` 섹션 재구성 · `revisitDashboard` · quick skin check · photo-consents 클라이언트 연동 · Staging migration/실업로드 없음)
- 관리자 제품·성분·검증·카탈로그 도구
- 한국 화장품 후보 수집·정규화·Staging 검수 구조
- 제품 갱신 계획과 due queue 자동화
- 피부과 후보 검수 계획 자동화
- 카탈로그·피부과 자동화 통합 안전 감사
- 제품 갱신·제품 예외·피부과 검수 통합 매니페스트
- 관리자 통합 검수 화면과 GET 전용 API
- 출처·우선순위·검색 필터
- 변경 전후·근거·공식 출처·마지막 확인일 표시
- 영상 자산·권리 상태 및 사용법 정책 모델
- 게시 가능한 제품 사용 가이드 선택 정책
- 영상 권리 만료·삭제·비공개 검수 큐와 통합 매니페스트
- 루틴 화면(`/routine`) 검증된 제품 사용 가이드 연결
- 추천 결과 핵심 제품 카드 검증된 사용 가이드 연결 (공용 `ProductUsageGuide`)
- 관리자 제품 상세 사용 영상·가이드 검수 화면 (읽기 전용, `catalog_product_media` SELECT)
- 부위별 화면(`/face-explorer`)·결과(`area` 쿼리)·관리 가이드에 검증된 사용 가이드 연결 (applicationArea 일치 시만)
- AI 생성·광고·협찬·브랜드 제공·제휴 공용 disclosure 정책 및 UI 라벨

## 자동화 안전 상태

- 자동 게시 금지
- Production 쓰기 금지
- DB 쓰기 없는 dry-run·아티팩트 중심
- 제품·병원 최종 검증 자동 승격 금지
- Organic 추천과 광고·제휴 점수 분리 유지
- 공식 출처 미확보 데이터 생성 금지
- 권리 미확인 영상 게시 금지
- 사용 가이드·영상 유무가 Organic 추천 점수·순위에 영향 없음

## 현재 진행 단계

Master Plan v4.1 구현 우선순위의 **단계 5 리텐션 보강**을 진행 중이다.

- 단계 4 본기능: 코드·자동 테스트·Staging build 검증 **완료**
- 단계 5 첫 작업: 3·7·15·30일 체크인 응답 분기 정책·화면 연결 **코드 완료** (실제 알림 발송·DB migration 실행 없음)
- 단계 5 두 번째 작업: 체크인 응답 기반 루틴 조정 제안 UI **코드 완료** (사용자 승인 전 자동 변경 없음 · 일시 중지≠삭제 · 되돌리기 · DB migration 미실행)
- 단계 5 세 번째 작업: 체크인 이메일 큐 정책 **코드 시작** (후보 생성·동의·중복방지·재시도·상태전이 · **실제 발송 미연결** · DB migration 미실행)
- 단계 5 네 번째 작업: 체크인 이메일 dry-run provider **코드 완료** (disabled/dry_run · live_mode_blocked · 실제 발송·SDK·API 키 없음 · admin UI 후순위)
- 단계 5 다섯 번째 작업: 체크인 이메일 Resend live adapter **코드 준비 완료** (게이트·allowlist·kill switch · mock self-test만 · 실제 발송·API 키·DNS 변경 없음 · main 미병합)
- 단계 5 여섯 번째 작업: Preview 관리자 체크인 이메일 테스트 발송 UI/API **코드 완료** (Production 404/403 · same-origin · allowlist 서버 고정 · 60초/10건 in-memory 제한 · mock self-test만 · 실제 발송 미실행 · DB audit 미구현 · main 미병합)
- Preview 콘솔 localStorage 수동 주입 검수: **중단**
- `/qa/usage-guide` 임시 QA 페이지: **본기능에 포함하지 않음** (미채택)
- main 미병합 · Production 미배포 · Production DB·환경변수 변경 없음

## 다음 작업

1. 알림 채널별 동의 분리 UI / 스케줄링 연결 (WQ-D)
2. (승인 대기) 사진 비교 Staging migration 적용 · `care-photos` bucket 생성

## 현재 차단 또는 사람 확인이 필요한 항목

- Care persistence Staging: service_role SELECT grant · Preview `/admin/care` 육안 **통과**
- Preview `/admin/care/check-in-email-test` 육안 **통과** (2026-07-22 · 폼·미리보기 정상 · milestone/locale/kind 변경 정상 · migration/permission 오류 없음 · 실발송 없음)
- 체크인 이메일 큐 Schema A **Staging 적용·검증 완료** (2026-07-22 · Dashboard SQL · `verify:checkin-email-queue-staging` 통과 · FK/status/payload negative · claim RPC · anon SELECT 거부 · care_check_ins 없어 positive insert 스킵 · 실발송 없음 · Production **미적용**)
  - Schema A: Production만 DB queue · Preview test-send in-memory 유지
  - idempotency `checkin-email:v1:{user_id}:{checkin_id}:{milestone}:{kind}:email`
  - 상태 매핑: scheduled→pending · sending→processing · retry_scheduled→pending(+retry) · duplicate→skipped_duplicate
  - claim: `claim_checkin_email_jobs` FOR UPDATE SKIP LOCKED · stale processing 복구
  - retry: max 3 · last_error sanitize · 초과 시 failed
  - 게이트: `npm run gate:checkin-email-queue-staging` **통과** (2026-07-22)
  - Staging 적용: Dashboard SQL Editor 적용 **완료** · `npm run verify:checkin-email-queue-staging` **통과**
- Preview 관리자 로그인 후 Staging `catalog_product_media` 실제 미디어 육안
- Preview 원격 검수 JSON 주소와 환경변수 연결
- 공식 전성분 미확보 제품의 최종 검증
- 실제 제품 이미지·가격·재고·구매 링크의 사람 최종 확인
- 실제 피부과 진료 범주·의료진·주소·예약 정보 확인
- 외부 영상 사용권과 게시 기간 확인
- Production 배포와 Production DB·환경변수 변경
- 사진 비교 Staging migration 적용 (`DRAFT_DO_NOT_APPLY_care_photo_comparison.sql`) · private `care-photos` Storage bucket 생성
- 광고·제휴 계약 실제 활성화

## 승인 경계

작업 브랜치 코드·문서·테스트·dry-run·Preview는 반복 승인 없이 진행한다.

다음은 별도 명시 승인 전 실행하지 않는다.

- Production 배포
- Production DB write
- Production 환경변수 변경
- 파괴적 SQL·대량 삭제
- main 병합 (별도 승인)
