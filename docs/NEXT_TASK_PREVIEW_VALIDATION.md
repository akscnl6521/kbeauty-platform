# NEXT_TASK — WQ-G Preview·실기기 검수

최종 갱신: 2026-07-23

## 완료 (반복 금지)

- WQ-G Prelaunch gate 문서
- **WQG-P0-001** 사진 AI 오인·동의·카피 정합 (vision 미도입)
- **WQG-P1-002** CameraCapturePanel/landmark dynamic import (SSR-safe loading fallback·회귀 테스트)
- 로컬 테스트: `test:guided-capture` · `test:photo-comparison` · `test:symptom-safety` 통과

## WQG-P0-002 상태

| 항목 | 값 |
|------|-----|
| 상태 | **`RELEASE_GATE_PENDING`** |
| 이유 | Production `AI_PROVIDER` 확인은 **Production 배포 직전**에 수행. feature 개발 중 중복 확인 생략 |
| 키 값 | 문서·로그·채팅에 **기록 금지** |
| 재확인 | Production 배포 **승인 전 최종 체크리스트**에서 다시 확인 |
| 지금 | **미실행** |

## 남은 작업 (사람 검수)

| 보낼 말 | 실행 내용 |
|---------|-----------|
| **Preview 검수** | P0-003 / P1-003: A/B/C 추천·CTA·빈 상태와 3장 촬영 문구 육안 확인 |
| **실기기 검수** | P1-005: Android Chrome·iPhone Safari·320px 수동 촬영 UX 확인 |
| **정책 검수** | P1-006: 앱 서버 일시 전송·영구 저장 없음 문구의 정책·법무 확인 |

## 금지

- Production env 변경·배포 · main 병합 · DB/Storage/migration · 자동 landmark 재수정
