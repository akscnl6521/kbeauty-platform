# Phase 3.1 — Face landmark auto-capture

최종 갱신: 2026-07-22 (3.1.3 coordinate explosion + inference loop)

## BLOCKER 원인 (3.1.3)

실기기 진단: `dispC`/`w`/`h`가 1e16~1e17, `age≈17s`, `fail=stale_landmark`, pitch/roll 비현실.

핵심:

1. **비정상 landmark/bounds가 alignment·캐시·UI까지 도달** (finite/범위 미검증)
2. **transformation matrix를 위치/bounds에 섞을 위험** · pose와 위치 분리 미흡
3. **추론 루프가 throw/early-return 후 rAF 미재개** → age 폭증 → stale
4. 비정상 결과를 “최근 정상”으로 재사용해 판정 오염

## 수정 (3.1.3)

- `landmarkSanity`: finite + 범위 검사 · invalid → `invalid_landmark_data` · **clamp/위장 금지**
- bounds = 검증된 landmark x/y min/max만 · matrix translation 미사용
- pose = matrix **복사본**에서만 Euler · 배열 mutate 금지 · 비정상 pose는 `detector_unreliable` + landmark front 대체
- display 변환: video px → cover scale → crop → client norm → mirror **1회** · width/height는 두 모서리 변환 차
- 추론: `finally`에서 lock 해제 · rAF 항상 재스케줄 · timestamp `performance.now()` 단조 증가
- stale: 재사용 ≤250ms · >700ms stale · >2s detector restart → 실패 시 manual_guidance
- 진단: rawC / preMirrorC / dispC / invalidStage / infer / loop / lock / restart · 비정상은 `INVALID`

## 이전 (3.1.2)

- currentTime gate 제거 → minInterval + monotonic timestamp
- false `no_face` / 잘못된 “중앙에 맞춰” 문구 분리

## 실기기

Cursor는 Android를 직접 확인할 수 없음 → **실기기 미확인**.  
Preview 진단에서 `fail=` / `rawC=` / `dispC=` / `w`/`h`(0~1) / `age<300` / `loop=1` 확인.

## 테스트

`npm run test:guided-landmark` · `npm run test:guided-capture` · `npm run build`
