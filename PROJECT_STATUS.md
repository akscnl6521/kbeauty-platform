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
- **Phase 3.0 안내형 얼굴 촬영 MVP + AI 분석 대기 UX** (카메라 우선·3각도·로컬 품질·진행 화면 · Storage/migration 없음)
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- 체크인 이메일 dry-run / Resend adapter 코드 준비 (실발송 없음)
- Preview Care admin · 체크인 이메일 테스트 UI 육안 통과
- 체크인 이메일 큐 Schema A Staging 적용·검증 완료 (Production 미적용)
- 사진 비교 동의·저장·삭제 흐름 코드·테스트 완료 (WQ-B · DRAFT migration 미적용 · care-photos 미생성)
- 시나리오 파일럿 Phase 2~2.6.2 종료
- 재방문 대시보드 · 체크인 스케줄 · Care worker dry-run (WQ-C/D/E)
- 관리자 제품·성분·검증·카탈로그·사용 가이드·disclosure

## 자동화 안전 상태

- 자동 게시 금지 · Production 쓰기 금지
- Organic과 광고·제휴 점수 분리
- anon `product_offers` write 권한 0
- Phase 3.0 사진은 브라우저 임시 object URL만 · Storage 영구 저장 없음

## 현재 진행 단계

Master Plan v4.2 **Phase 3.0 안내형 촬영 MVP** 코드·selftest·build 완료. Preview 배포·수동 검수 대기.

- Phase 2.6.2 종료
- `NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE` 기본 ON (`0`이면 기존 단일 업로드)
- main 미병합 · Production 미배포 · care-photos/migration 미적용

## Phase 3.0 — 안내형 촬영 MVP (2026-07-22 · 코드 완료)

- 입력: 카메라 우선 / 갤러리 / 문진만 fallback
- 필수 3장: 정면 · 왼쪽 45° · 오른쪽 45°
- 로컬 품질: 해상도·밝기·선명도·파일·형식 · pose=`pose_check_unavailable`
- 분석 대기: 단계형 진행 + soft 0–90% · 완료 후 100% · timeout/retry
- **3.0.2**: 일반 사용자 갤러리 업로드 금지 · 카메라/문진만 · Master Plan §22 반영
- **3.0.1 BLOCKER fix**: 권한 허용 후 스트림이 effect cleanup에 끊기던 문제 수정
- 문서: `docs/analyze/PHASE30_GUIDED_CAMERA_CAPTURE.md`
- 테스트: `npm run test:guided-capture`

## 다음 작업

1. Phase 3.0 Preview 수동 검수 (모바일 Safari/Chrome · 권한 거부 · 갤러리 · 문진)
2. (이후) 위/아래 각도 · 자동 촬영 · landmark
3. (승인 대기) 사진 비교 Staging migration · `care-photos`
4. (승인 대기) WQ-G — 이번 우선 아님

## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
