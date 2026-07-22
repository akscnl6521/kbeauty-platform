# Phase 3.1 — Face landmark auto-capture + voice countdown

최종 갱신: 2026-07-22  
기준: MASTER_PLAN.md §22 · Phase 3.0 / 3.0.1 / 3.0.2 완료 상태

## 1. 조사 결과

| 영역 | 현황 |
| --- | --- |
| CameraCapturePanel | getUserMedia → attach/play · FaceGuideOverlay · landmark loop · 자동/수동 셔터 |
| GuidedCaptureFlow | requesting_permission → capturing · 갤러리 제거됨 (카메라/문진만) |
| captureSession | idle/requesting/capturing/reviewing/ready |
| cameraStart | preferred+fallback · stream identity cleanup |
| video 좌표 | CSS `scale-x-[-1]` 전면 미러(표시) · 랜드마크도 display-space로 mirror · 캡처 canvas 별도 미러 |
| locale | `useLocale` + `resolveCaptureVoiceLocale` (ko/en/ja/zh-CN/es, else en) |
| SpeechSynthesis | Web Speech API · 실패해도 자동 촬영 유지 |
| CSP / Permissions | `camera=(self)` · `wasm-unsafe-eval` · `worker-src 'self' blob:` |
| connect-src | same-origin `/models` · `/mediapipe/wasm` (CDN 모델 fetch 없음) |
| Feature flags | `NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE` · `NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN` (기본 ON) |

## 2. 기술 선택

**`@mediapipe/tasks-vision` FaceLandmarker (Apache-2.0, 0.10.32)**

이유:
- 브라우저 로컬 추론 · 프레임 서버 전송 없음
- 478 landmarks + facialTransformationMatrix (yaw/pitch/roll)
- 신원 embedding / 본인인증 API 아님
- Android Chrome · iOS Safari 실사용 사례 다수

자산 (same-origin):
- WASM: `/mediapipe/wasm` (패키지에서 복사)
- Model: `/models/face_landmarker.task` (~3.7MB float16)

GPU 실패 시 CPU delegate 1회 재시도. CDN 모델 fetch 금지.

## 3. yaw/pitch/roll

MediaPipe `facialTransformationMatrixes[0]` (column-major 4×4)에서 Euler 분해.
전면 카메라 display-space에서는 yaw 부호를 반전하여 화면 왼쪽/오른쪽 안내와 일치시킨다.

## 4. 템플릿

| id | 용도 |
| --- | --- |
| `front_template_v1` | 정면 · yaw ±12° |
| `left_45_template_v1` | 화면 왼쪽 방향 · yaw −55~−25° |
| `right_45_template_v1` | 화면 오른쪽 방향 · yaw 25~55° |

모든 좌표는 0~1 normalized. `stableHoldMs=1000`.

## 5. 자동 촬영

조건: 모델 로드 · faceCount=1 · 템플릿 정렬 · 크기/yaw/pitch/roll · 밝기·선명도 · ≥1초 안정.
흐름: adjusting → ready → countdown 3·2·1 → capturing(각도당 1회).
이탈 시 즉시 cancel + speech cancel. 품질 fail 시 해당 각도만 재촬영.

## 6. 개인정보

- 랜드마크 좌표·행렬·프레임: 메모리만 · 로그/Storage/DB 금지
- 진단 로그: 로딩 성공/실패 · inference ms · fallback · 상태 코드만
- 얼굴 신원 식별·embedding 금지

## 7. Fallback

모델/WASM/느린 inference → `alignmentMode=manual_guidance` + 수동 셔터  
또는 문진만 · **갤러리 없음**

## 8. 테스트

`npm run test:guided-landmark` · `npm run test:guided-capture`

## 9. 미룸

위/아래 각도 · QR 이어촬영 · Storage/비교 DB · Production env · WQ-G · 실기기 Android/iOS 육안 수치 확정
