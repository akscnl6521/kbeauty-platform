# NEXT_TASK — WQ-G Preview·실기기 검수

최종 갱신: 2026-07-24

## 완료 (반복 금지)

- WQ-G Prelaunch gate 문서
- **WQG-P0-001** 사진 AI 오인·동의·카피 정합 (vision 미도입)
- **WQG-P1-002** CameraCapturePanel/landmark dynamic import (SSR-safe loading fallback·회귀 테스트)
- 로컬 테스트: `test:guided-capture` · `test:photo-comparison` · `test:symptom-safety` 통과
- **Stage 6 코드 기반** (병원 어댑터·검증·안내 UI·리드 dry-run·`/admin/clinics`) · 실병원 게시 없음
- **Preview 원격 검수 JSON 경로** (공개 artifact + VERCEL_URL 자동 · fixture)
- **T06** 최종 통합·릴리스 증거 (코드·selftest·build) · Preview/실기기 위장 없음
- **P2-T01** Preview/local 라우트 자동 검증 인프라 (`test:preview-routes` · `check:preview-routes` · viewport 스크린샷 파이프라인) · **육안 승인 미주장**
- **P2-T05** Final Preview 증거 패키지 (`test:phase2-final-evidence` · `check:phase2-final-evidence` · 6버킷·1회성 사람 절차) · **육안/실기기/Dashboard/Production 위장 없음**

## 자동 검증 (사람 육안 대체 아님)

| 명령 | 용도 |
|------|------|
| `npm run test:preview-routes` | 계약·인벤토리 selftest |
| `npm run check:preview-routes` | 정적 인벤토리 + JSON |
| `BASE_URL=… npm run check:preview-routes -- --mode=http` | 로컬/Preview HTTP·redirect |
| `npx tsx scripts/run-preview-route-validation.ts --mode=browser --base-url=…` | 320/390/768/1440 스크린샷 증거 |
| `npm run test:phase2-final-evidence` | P2-T05 증거 패키지 selftest |
| `npm run check:phase2-final-evidence` | Phase 2 필수 회귀 + 증거 아티팩트 |

상세: `docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md` · `docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md`

## WQG-P0-002 상태

| 항목 | 값 |
|------|-----|
| 상태 | **`RELEASE_GATE_PENDING`** |
| 이유 | Production `AI_PROVIDER` 확인은 **Production 배포 직전**에 수행. feature 개발 중 중복 확인 생략 |
| 키 값 | 문서·로그·채팅에 **기록 금지** |
| 재확인 | Production 배포 **승인 전 최종 체크리스트**에서 다시 확인 |
| 지금 | **미실행** |

## 남은 작업 (사람 검수 / 승인)

| 보낼 말 | 실행 내용 |
|---------|-----------|
| **Preview 검수** | P0-003 / P1-003: A/B/C 추천·CTA·빈 상태와 3장 촬영 문구 육안 확인 (P2-T05 §1) |
| **실기기 검수** | P1-005: Android Chrome·iPhone Safari·320px 수동 촬영 UX 확인 (P2-T05 §3–4) |
| **정책 검수** | P1-006: 앱 서버 일시 전송·영구 저장 없음 문구의 정책·법무 확인 (P2-T05 §8) |
| **병원 실데이터** | T07-02 HIRA 서울 피부과 수집 파이프라인(코드) 완료 · live 검수→publishable은 Autopilot `T07` (`external_only` · fixture 게시 금지) |

## 금지

- Production env 변경·배포 · main 병합 · DB/Storage/migration · 자동 landmark 재수정
- 자동 스크린샷을 Preview 육안 승인으로 위장
