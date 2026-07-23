# NEXT_TASK — WQG-P1-002 landmark dynamic import

최종 갱신: 2026-07-23

## 완료 (반복 금지)

- WQ-G Prelaunch gate 문서
- **WQG-P0-001** 사진 AI 오인·동의·카피 정합 (vision 미도입)
- 로컬 테스트: `test:guided-capture` · `test:photo-comparison` · `test:symptom-safety` 통과

## WQG-P0-002 상태

| 항목 | 값 |
|------|-----|
| 상태 | **`RELEASE_GATE_PENDING`** |
| 이유 | Production `AI_PROVIDER` 확인은 **Production 배포 직전**에 수행. feature 개발 중 중복 확인 생략 |
| 키 값 | 문서·로그·채팅에 **기록 금지** |
| 재확인 | Production 배포 **승인 전 최종 체크리스트**에서 다시 확인 |
| 지금 | **미실행** |

## 남은 작업 (단일 · 코드)

| 보낼 말 | 실행 내용 |
|---------|-----------|
| **계속하자** | **WQG-P1-002** — `GuidedCaptureFlow`에서 `CameraCapturePanel`(landmark 정적 import 포함)을 `dynamic()` 분리해 flag OFF 기본 경로 번들·모바일 부하 감소 |

## 금지

- Production env 변경·배포 · main 병합 · DB/Storage/migration · 자동 landmark 재수정
