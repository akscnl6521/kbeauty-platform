# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-23

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
- **Phase 3.0 안내형 얼굴 촬영 MVP + AI 분석 대기 UX** (기본 UX)
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
- Phase 3.x 사진은 브라우저 임시 object URL만 · Storage 영구 저장 없음 · 랜드마크 좌표 미저장

## 현재 진행 단계

**WQG-P0-001 완료** — 사진 AI 오인·동의·카피 정합 (vision 미도입 · 문구만).

- 공용 카피: `ANALYSIS_SCOPE_COPY_KO` (`src/lib/analyze/guidedCapture/inputPolicy.ts`)
- 동의·촬영·진행·결과·홈 문구: 픽셀 외부 AI 미전송 · 문진 기반 안내 · 3장=품질/각도
- WQ-G 문서: `docs/prelaunch/WQ-G_PRELAUNCH_GATE.md`
- Preview: 배포 후 육안 확인 권장 (이전 `…89ry68u2h…`)
- **출시 가능으로 보지 않음**
  - **WQG-P0-002** = `RELEASE_GATE_PENDING` (Production `AI_PROVIDER`는 **배포 직전** 최종 확인 · feature 중 중복 확인 생략 · 키 값 문서/로그 금지)
  - 잔여: P0-003 Preview 육안 · P1 코드/검수
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

1. **WQG-P1-002** — landmark/`CameraCapturePanel` **dynamic import** (flag OFF 기본 경로 번들·모바일 부하)
2. P0-003 / P1-003·005 Preview·실기기 육안 (대시보드 아님 · 사람 검수)
3. **WQG-P0-002** — `RELEASE_GATE_PENDING` (Production 배포 직전 최종 확인 · 지금 미실행)
4. Phase 3.1 자동 정렬은 **보류** 유지
5. (승인 대기) 사진 비교 Staging migration · `care-photos`


## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
