# P3-T03 — Automated refresh and exception operations

최종 갱신: 2026-07-24
상태: **코드·fixture dry-run 완료** · 실 live 운영 스케줄러·DB 쓰기는 `external_only`

## 목적

제품·병원 **통합 갱신·예외 운영 레이어**를 제공한다.

포함:

- due queues
- stale detection
- retry / exponential backoff
- resume checkpoints
- source-change diffs
- exception prioritization
- audit logs
- admin review manifests
- scheduler-ready commands (일일 제품 · 주 2회 병원)

## 구현 범위

| 항목 | 내용 |
|------|------|
| 통합 계약 | `RefreshEntityRecord` · master-prompt §19 상태·타임스탬프 |
| Due queue | 제품/병원/통합 · 우선순위 정렬 |
| Stale | 제품 30/90일 · 병원 90/180일 |
| Retry/backoff | 결정적 지수 백오프 · max 5회 · 네트워크 sleep 없음 |
| Checkpoint | 재개 가능 · retryable/terminal 분리 |
| Source diff | 필드 단위 변경 · 고영향(성분/운영상태 등) → 수동 검수 |
| Exception | 점수·우선순위·reviewGroup |
| Admin manifest | 제품 갱신·병원 갱신·예외 통합 |
| Scheduler | `refresh:product-daily` · `refresh:clinic-twice-weekly` 아티팩트 전용 |

## 금지 (강제)

- 자동 게시 (`publishAllowed=false` · `autoPublishAttempted=false`)
- 파괴적 DB 갱신 (`destructiveUpdateAllowed=false` · `databaseTouched=false`)
- 유료 외부 인프라·Production 스케줄 생성
- CAPTCHA/로그인 우회 · 유료 API

## 코드

| 경로 | 역할 |
|------|------|
| `src/lib/ops/automatedRefresh/*` | 계약·큐·stale·retry·checkpoint·diff·예외·audit·pipeline |
| `scripts/automated-refresh-ops-selftest.ts` | selftest |
| `scripts/run-automated-refresh-ops.ts` | dry-run 러너 |
| `scripts/run-product-refresh-daily.ts` | 일일 제품 스케줄러 준비 명령 |
| `scripts/run-clinic-refresh-twice-weekly.ts` | 주 2회 병원 스케줄러 준비 명령 |

## 명령

```bash
npm run test:automated-refresh-ops
npm run check:automated-refresh-ops
npm run refresh:product-daily
npm run refresh:clinic-twice-weekly
```

## 스케줄러 힌트 (사람이 연결 · 에이전트 미생성)

| 대상 | cron (UTC) | 의미 |
|------|------------|------|
| 제품 | `20 0 * * *` | 매일 09:20 KST |
| 병원 | `40 0 * * 1,4` | 매주 월·목 09:40 KST |

기존 GitHub Actions artifact 워크플로와 동일 시각 힌트 · **이 작업은 Production 스케줄/유료 인프라를 만들지 않음**.

## 안전 플래그 (항상)

- `publishAllowed=false`
- `publicVisible=false`
- `autoPublishAttempted=false`
- `destructiveUpdateAllowed=false`
- `databaseTouched=false`
- `writeAttempted=false`
- `productionTouched=false`
- `externalScheduleCreated=false`
- `paidApiUsed=false`

## 미검증 (`external_only`)

- 실 카탈로그/병원 live 소스 갱신
- 운영자 스케줄러(Task Scheduler / GH schedule) 실제 등록
- Staging/Production DB 반영 · 게시

## 관련

- `docs/autopilot/MASTER_EXECUTION_QUEUE.md` · VC-38
- 기존 `catalog/refreshPolicy` · `clinic/clinicRefreshPolicy` · exception queue (하위 정책 재사용 가능 · 본 모듈이 통합 오케스트레이션)
