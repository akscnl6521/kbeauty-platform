# T06 — Final integration · release evidence

최종 갱신: 2026-07-23
브랜치: `feature/recommendation-usage-guide-display-20260720`
계약: `docs/autopilot/EXECUTION_CONTRACT.md`
코드 계약: `src/lib/release/finalIntegrationEvidence.ts`

## 1. 목적

T00–T05에서 구현된 사용자 여정을 **코드 수준에서 연결 검증**하고, Preview·실기기·법무·Production 게이트는 **위장하지 않고** `external_only`로 남긴다.

## 2. 기본 촬영·랜드마크

| 항목 | 검증 | 분류 |
|------|------|------|
| 수동 3각도 (정면·좌45·우45) | Phase 3.0 기본 UX | `verified_complete` |
| `NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE` 기본 OFF | `isFaceLandmarkAutoCaptureEnabled({}) === false` | `verified_complete` |
| Voice countdown | landmark OFF 시 비활성 | `verified_complete` |
| Phase 3.1 자동 정렬 | 코드 보존 · Android blocker | `deferred` |

## 3. 여정 연결 (코드)

| 단계 | 분류 | 비고 |
|------|------|------|
| 홈 → 분석/문진 | `verified_complete` | 갤러리 금지 |
| 수동 촬영 · 품질 | `verified_complete` | 픽셀 외부 AI 미전송 카피 |
| 안전 게이트 · 전문가 라우트 | `verified_complete` | 급성 시 제품 추천 중단 |
| 결과·추천 | `partial` | Preview A/B/C 육안 잔여 |
| 사용 가이드 · disclosure | `verified_complete` | 빈/fallback `role="status"` |
| Organic/제휴/스폰서 레인 | `verified_complete` | 실제휴 URL은 external |
| 루틴·로컬 저장 | `verified_complete` | |
| BeautyProfile | `partial` | Staging migration 미적용 |
| 3/7/15/30 follow-up | `partial` | 실발송 미연결 |
| 병원 안내 | `partial` | 공식 publishable 0 |
| 사진 동의·프라이버시 | `verified_complete` | Storage/migration external |

## 4. empty / loading / error / a11y (코드 점검)

| 표면 | 조치 | 검증 |
|------|------|------|
| `ProductUsageGuide` | empty·fallback `role="status"` | selftest |
| `PhotoAssetsSettingsPanel` | loading `aria-busy` · empty/migration `role="status"` | selftest |
| `PhotoConsentPanel` | 검증 실패 `role="alert"` · 정직한 동의 카피 | selftest |
| `GuidedCaptureFlow` | error `role="alert"` · status · dynamic camera | selftest |
| 모바일·실기기 터치 | — | **미검증** (`external_only`) |

## 5. Preview / 실기기 증거

| 항목 | 상태 | 분류 |
|------|------|------|
| P0-003 / P1-003 Preview 육안 | **미검증** (사람) | `external_only` |
| P1-005 Android Chrome · iPhone Safari · 320px | **미검증** (사람) | `external_only` |
| P1-006 개인정보 전송 범위 법무 | **미검증** (사람) | `external_only` |
| WQG-P0-002 Production `AI_PROVIDER` | `RELEASE_GATE_PENDING` · 지금 미실행 | `external_only` |

에이전트가 Preview/실기기 통과를 `verified_complete`로 표기하지 않는다.

## 6. 자동 검증 (이번 번들 · 실측 2026-07-23)

| 명령 | 결과 |
|------|------|
| `npm run test:final-integration` | **통과** |
| `npm run test:journey` | **통과** |
| `npm run test:master-execution` | **통과** |
| `npm run test:guided-capture` | **통과** |
| `npm run test:guided-landmark` | **통과** |
| `npm run test:photo-comparison` | **통과** |
| `npm run test:symptom-safety` | **통과** |
| `npm run test:commercial-separation` | **통과** |
| `npm run test:content-disclosure` | **통과** |
| `npm run test:autopilot-queue` | **통과** |
| `npm run check:release-security` | **통과** |
| 변경 파일 ESLint · `tsc --noEmit` | **통과** |
| `npm run build` (public env 없음 · placeholder) | **통과** |

## 7. 출시 판단

**출시 가능으로 보지 않는다.**
코드 통합·로컬 자동 검증은 T06 범위에서 완료 가능하나, Preview·실기기·법무·공식 병원·Production 게이트는 잔여다.

## 8. 금지 유지

- main 병합 · Production 배포 · Production DB/Storage/env 변경
- landmark 기본 ON
- Preview/실기기 위장 완료
- commit/push (outer runner 담당)
