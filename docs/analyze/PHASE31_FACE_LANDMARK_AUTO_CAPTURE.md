# Phase 3.1 — Face landmark auto-capture

최종 갱신: 2026-07-23 (3.1.4 raw_bounds + manual shutter + debug OFF)

## BLOCKER (3.1.4)

실기기: `fail=invalid_landmark_data` · `invalid=raw_bounds` · `loop=0` · `restart=11`  
→ 자동 정렬 불가 + 디버그 패널이 얼굴을 가림 + 수동 촬영도 어려움.

### 원인

1. **raw_bounds**: MediaPipe landmark 리스트 형태(array / nested / TypedArray / pixel-space) 파싱이 부족해 유효점이 0으로 계산됨
2. **loop=0 / restart=11**: invalid 지속 시 hardRestart 무한 반복 → 실패 시 모드 전환으로 rAF 루프 종료
3. **수동 촬영 차단**: landmark 실패·품질·countdown 상태와 수동 셔터가 결합됨
4. **디버그 UI**: Preview에서 진단 패널이 카메라 위를 덮음

### 수정

- `landmarkParse.ts`: 런타임 구조 검사 · valid/invalid count · pixel→norm 변환(클램프 위장 금지)
- hardRestart **최대 2회** · 이후 수동 우선이지만 **loop 유지** · landmark 정상 복귀 시 자동 재개
- 수동 촬영: video ready만 필요 · landmark 불필요 · 품질 경고로 차단하지 않음
- 디버그: 기본 OFF · 카메라 **아래** 접이식 · `?landmarkDebug=1`만 자동 펼침
- 사용자 문구: 기술 용어 없이 “촬영 버튼을 눌러 주세요”
- 수동 fallback 가이드 단순화(외곽·눈·코·입)

## 실기기

Cursor는 Android를 직접 확인할 수 없음 → **실기기 미확인**.

확인:
- 자동: rawBounds 정상 · loop=1 · 거의 맞았어요 → 3·2·1 → 자동 촬영
- 수동: 자동 실패 시에도 **촬영** 버튼으로 미리보기까지

## Preview / commit

- (배포 후 갱신)
- 테스트: `npm run test:guided-landmark` · build OK
