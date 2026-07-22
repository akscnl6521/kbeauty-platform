# Phase 3.1 — Face landmark auto-capture + voice countdown

최종 갱신: 2026-07-22 (3.1.1 alignment BLOCKER fix)  
기준: MASTER_PLAN.md §22

## 1. 조사 결과 (요약)

| 영역 | 현황 |
| --- | --- |
| CameraCapturePanel | landmark loop · auto/manual · voice · debug toggle |
| 좌표 | MediaPipe video-norm → **object-fit:cover display-norm** (+ mirror) |
| 템플릿 | 절대: 중심/크기/pose · **상대(face bounds)**: 눈·코·입·턱 |
| 판정 | 필수=얼굴1·중심·크기·yaw·roll·밝기·선명도 · 보조=눈·코·입·턱(soft) |
| 갤러리 | 일반 사용자 금지 |

## 2. BLOCKER 원인 (3.1.1)

1. **object-fit: cover crop 미보정** — detector는 video frame, overlay는 CSS box → 눈·코 가이드 불일치
2. **눈·코·입·턱을 화면 절대 좌표로 hard fail** — 얼굴형·안경에서 aligned 불가
3. **가이드 타원이 길고 좁음** — template 절대 box에서 파생한 장식 타원

## 3. 수정

- `displaySpace.ts`: video↔display 공용 변환 (overlay·engine 동일)
- front/left/right 허용 완화 · feature는 face-relative · `softFeaturesOnly`
- FaceGuideOverlay: 둥근 안내 타원 + liveBounds 기반 허용 영역
- Preview/dev **정렬 디버그** 토글 (`?landmarkDebug=1` 또는 버튼)
- 안경: 눈 landmark 없어도 bounds+nose+pose로 aligned 가능

## 4. 기술

`@mediapipe/tasks-vision` FaceLandmarker 0.10.32 · Apache-2.0  
WASM `/mediapipe/wasm` · model `/models/face_landmarker.task` (~3.7MB)

## 5. Feature flags

- `NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE` (default ON)
- `NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN` (default ON)
- `NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG` / `?landmarkDebug=1`

## 6. 테스트

`npm run test:guided-landmark` · `npm run test:guided-capture` · `npm run build`

## 7. 미룸

실기기 Android/iOS 육안 재확인 · 위/아래 각도 · Storage · Production · WQ-G

## 8. Preview / commit (3.1.1)

- Preview: `https://kbeauty-platform-6crs10vnz-akscnl6521s-projects.vercel.app`
- commit: `de0ffab`
- Debug: Preview에서「정렬 디버그 ON」또는 `?landmarkDebug=1`
