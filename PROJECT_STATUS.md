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
- **Phase 3.0 안내형 얼굴 촬영 MVP + AI 분석 대기 UX**
- **Phase 3.1 얼굴 랜드마크 표준 정렬 + 자동 촬영 + 다국어 음성 카운트다운** (신원 인식 아님 · Storage/migration 없음)
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

Master Plan v4.2 **Phase 3.1.4** raw_bounds·loop·수동 촬영·debug UI 수정 완료. Android 실기기 재검수 대기.

- **실기기 미확인**
- main 미병합 · Production 미배포

## Phase 3.1 — 랜드마크 자동 촬영 (2026-07-23)

- **3.1.4**: robust landmark parse · restart≤2 · loop 유지 · 수동 촬영 분리 · debug 기본 OFF(카메라 아래)
- **3.1.3**: 좌표 폭주 차단 · matrix=pose only · inference finally
- **3.1.2**: false no_face · 진단 패널
- **3.1.1**: cover transform · soft features
- 테스트: `npm run test:guided-landmark`


## Phase 3.0 — 안내형 촬영 MVP (요약)

- 카메라/문진만 · 3각도 · 로컬 품질 · 분석 대기 UX
- 3.0.1 stream 유지 수정 · 3.0.2 갤러리 금지
- 문서: `docs/analyze/PHASE30_GUIDED_CAMERA_CAPTURE.md`

## 다음 작업

1. Phase 3.1 Preview · Android Chrome / iPhone Safari 육안 검수
2. (이후) 위/아래 각도 · QR 이어촬영
3. (승인 대기) 사진 비교 Staging migration · `care-photos`
4. (승인 대기) WQ-G — 이번 우선 아님

## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
