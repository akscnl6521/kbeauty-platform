# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-22

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
- 위험 신호와 전문가 상담 우선 분기
- 제품 추천 안전 필터와 Top 5 게이트
- **추천 자격(recommendation_ready)과 구매 가능(commerce) 분리** (Phase 2.5~2.6.2)
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- 체크인 이메일 dry-run provider (실제 발송 없음 · live 차단 · API 키 없음 · admin UI 후순위)
- 체크인 이메일 Resend live adapter 코드 준비 (실제 발송 없음 · API 키 미설정 · DNS 미변경 · staging allowlist · kill switch · Production 강제 차단)
- Preview 전용 관리자 체크인 이메일 테스트 발송 UI/API (mock self-test만 · in-memory rate limit · DB audit 없음 · 실제 발송은 Preview 배포 후 관리자 클릭 시만)
- Preview 이메일 미리보기 `siteOrigin` 서버 prop · Care admin readiness · service_role care SELECT · Preview `/admin/care` 육안 **통과**
- Preview `/admin/care/check-in-email-test` 육안 **통과** (2026-07-22 · 폼·미리보기 정상 · milestone/locale/kind 변경 정상 · migration/permission 오류 없음 · 실발송 없음)
- 체크인 이메일 큐 Schema A **Staging 적용·검증 완료** (2026-07-22 · Dashboard SQL · `verify:checkin-email-queue-staging` **통과** · Production **미적용**)
- Fast Execution System v1 **추가**
- 사진 비교 동의·저장·삭제 흐름 **코드·테스트 완료** (WQ-B · DRAFT migration 미적용 · `care-photos` bucket 미생성)
- 추천 구조 Phase 0/1: **핵심 추천 상황 30개 정의** + 갭 분석
- 시나리오 파일럿 Phase 2~2.6.2: A/B/C runtime Top · commerce 분리 · Staging A 엄격 RLS · Preview UI **종료**
- 재방문 대시보드 **코드·테스트 완료** (WQ-C)
- 체크인 스케줄링·채널별 동의 **코드·테스트 완료** (WQ-D · 실발송 없음)
- Care worker admin / dry-run delivery **코드·테스트 완료** (WQ-E · 실발송 없음)
- 관리자 제품·성분·검증·카탈로그 도구
- 한국 화장품 후보 수집·정규화·Staging 검수 구조
- 제품 갱신 정책과 due queue 자동화
- 피부과 후보 검수 계획 자동화
- 카탈로그·피부과 자동화 통합 안전 감사
- 제품 갱신·제품 예외·피부과 검수 통합 매니페스트
- 관리자 통합 검수 화면과 GET 전용 API
- 루틴·추천 결과·부위 화면 검증된 사용 가이드 연결
- AI 생성·광고·협찬·브랜드 제공·제휴 공용 disclosure 정책 및 UI 라벨

## 자동화 안전 상태

- 자동 게시 금지
- Production 쓰기 금지
- DB 쓰기 없는 dry-run·아티팩트 중심 (명시 Staging Dashboard만 예외)
- 제품·병원 최종 검증 자동 승격 금지
- Organic 추천과 광고·제휴 점수 분리 유지
- 공식 출처 미확보 데이터 생성 금지
- 권리 미확인 영상 게시 금지
- 사용 가이드·영상 유무가 Organic 추천 점수·순위에 영향 없음
- anon `product_offers` write 권한 0 (SELECT only)

## 현재 진행 단계

Master Plan v4.2 구현 우선순위의 **단계 5 리텐션 보강** + **WQ-F Phase 2+ 잔여**를 진행 중이다.

- 시나리오 파일럿 **Phase 2.6.2 종료** (2026-07-22 · commerce 분리 · Staging A 엄격 RLS · BOJ verified OOS · Preview 수동 UI 검수 완료)
- 단계 4 본기능: 코드·자동 테스트·Staging build 검증 **완료**
- 단계 5 Care/체크인 계열: 코드·Staging 큐 검증 **완료** (실발송·Production 미연결)
- main 미병합 · Production 미배포 · Production DB·환경변수 변경 없음

## Phase 2.6.2 — **종료** (2026-07-22)

- Staging Dashboard v2 적용: BOJ offer unverified→**verified**, stock **out_of_stock** 유지
- A 엄격 RLS: verified+in_stock **또는** verified official KR OOS/unknown (unverified 공개 없음)
- anon 가시 **20→21** (추가 BOJ 1건 · ROUND LAB unverified 비가시)
- C Top: COSRX / BOJ(OOS·CTA OFF) / Anua · Haruharu=availability_unknown
- Preview 수동 UI 검수 **완료**
- 문서: `docs/catalog/SCENARIO_PILOT_PHASE262_POST_APPLY_VERIFY.md`
- Rollback: `STAGING_ONLY_ROLLBACK_20260722_boj_verify_and_rls_a_v2.sql`

## Phase 2.6 — 완료 (2026-07-22)

- Staging SELECT + Preview Ready로 commerce 분리 실검증
- rollback flag OFF 시 C Top 0 복원 확인
- 문서: `docs/catalog/SCENARIO_PILOT_PHASE26_STAGING_PREVIEW.md`

## Phase 2.5 — 완료 (2026-07-22)

- Organic 추천 자격과 구매 가능 상태 코드 분리 (`RECOMMEND_COMMERCE_SEPARATION`)
- 문서: `docs/catalog/SCENARIO_PILOT_PHASE25_COMMERCE_SEPARATION.md`

## 다음 작업

1. (승인 대기) WQ-G Prelaunch integration / production readiness gate
2. (승인 대기) 사진 비교 Staging migration 적용 · `care-photos` bucket 생성
3. WQ-F Phase 2+ 잔여: D/E 보강 없이 런타임/스키마 확장은 별도 승인

## 최근 완료

- Phase 2.6.2 A 엄격 RLS + BOJ verified OOS + Preview UI (2026-07-22 · **종료**)
- Phase 2.5~2.6 commerce 분리 코드·Staging SELECT·Preview
- Scenario Top10 pilot enrichment / artifacts (2026-07-22)
- UI 스킬 설치 + kbeauty-match-design 초안 (페이지 재디자인 미실시)
- WQ-F → 추천 상황 Top10 풀 구축으로 재정의

## 현재 차단 또는 사람 확인이 필요한 항목

- Preview 관리자 로그인 후 Staging `catalog_product_media` 실제 미디어 육안
- Preview 원격 검수 JSON 주소와 환경변수 연결
- 공식 전성분 미확보 제품의 최종 검증
- 실제 제품 이미지·가격·재고·구매 링크의 사람 최종 확인
- 실제 피부과 진료 범주·의료진·주소·예약 정보 확인
- 외부 영상 사용권과 게시 기간 확인
- Production 배포와 Production DB·환경변수 변경
- 사진 비교 Staging migration 적용 · private `care-photos` Storage bucket 생성
- 광고·제휴 계약 실제 활성화

## 승인 경계

작업 브랜치 코드·문서·테스트·dry-run·Preview는 반복 승인 없이 진행한다.

다음은 별도 명시 승인 전 실행하지 않는다.

- Production 배포
- Production DB write
- Production 환경변수 변경
- 파괴적 SQL·대량 삭제
- main 병합 (명시 요청 시)
