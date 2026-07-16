# 124 — Follow-up Check-ins

최종 갱신: 2026-07-13

## 일정

분석 또는 루틴 시작일 기준:

| Day | 목적 |
|-----|------|
| 3 | 초기 자극·사용 가능 여부 |
| 7 | 적응·건조·유분·붉음·트러블 |
| 15 | 고민 변화·준수·만족도 |
| 30 | 전반 결과·재분석·루틴 조정 |

## 상태

`scheduled` → `due` → `completed` | `skipped` | `expired` | `cancelled`

- due 후 3일 미완료 → `expired`
- 동일 session+day 중복 생성 금지
- 완료된 체크인 재알림 금지

## UX

짧고 모바일 친화적. 0~10 또는 선택형. 긴 설문 금지.
Timezone: 사용자 timezone 우선, 기본 `Asia/Seoul`.
