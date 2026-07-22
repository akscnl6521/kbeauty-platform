# Phase 3.1 — Face landmark auto-capture

최종 갱신: 2026-07-22 (3.1.2 diagnosis + false no_face fix)

## BLOCKER 원인 (3.1.2)

첨부 화면처럼 얼굴이 중앙인데도 “얼굴을 화면 중앙에 맞춰 주세요”만 반복된 이유:

1. `FaceLandmarkerSession.detect()`가 `video.currentTime` 동일 시 `null` 반환
2. Android Chrome에서 muted 미리보기 `currentTime`이 거의 안 바뀌거나 반복됨
3. `null` → `evaluateAlignment` → **`no_face` / `no_snapshot`**
4. 문구가 잘못 “중앙에 맞춰 주세요”로 공통 처리되어 **실제 fail reason이 가려짐**

좌표 center_x 실패가 아니라 **검출 스킵을 no_face로 오인**한 것이 핵심.

## 수정

- currentTime gate 제거 → `minIntervalMs` 스로틀 + MediaPipe 단조 증가 timestamp
- skip 시 최근 snapshot 재사용 · `ageMs > 700`이면 `stale_landmark`
- Preview/dev **진단 패널 상시** (fail, display/video center, Δ, cover, mirror count)
- fail reason별 문구 분리 (center_x/y, size, stale, transform, no_face)
- mirror는 `displaySpace`에서 **1회만**

## 실기기

Cursor는 Android를 직접 확인할 수 없음 → **실기기 미확인**.  
Preview에서 진단 패널의 `fail=` / `dispC=` / `Δx` 값을 사용자가 읽어 확인.

## Preview / commit

- Preview: `https://kbeauty-platform-mnk60iebw-akscnl6521s-projects.vercel.app`
- commit: `64a4681`
- 진단: 카메라 화면 좌상단 패널 · `fail=` / `dispC=` / `Δx` 확인 (서버 전송 없음)
- **실기기 자동 촬영 성공 여부: Cursor 미확인 — 사용자 Android 재검수 필요**
