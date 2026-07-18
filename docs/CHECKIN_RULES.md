# CHECKIN_RULES.md — 3·7·15·30 체크인 규칙

SSOT 코드: `src/lib/care/checkinSchedule.ts` · `src/lib/care/schedule.ts` · `src/lib/care/checkinQuestions.ts` · `src/lib/care/safetyGate.ts`

## 일정

- 기준일: 분석 완료일(또는 루틴 시작일) ISO UTC
- 마일스톤: Day **3 · 7 · 15 · 30**
- 저장: UTC ISO · 표시: 사용자 timezone
- 로컬 시각: 해당 일자 **10:00** 앵커
- 중복: `preventDuplicateSchedule` / `dedupeCheckInsByDay`
- 완료·스킵된 마일스톤 재생성 금지: `filterOutCompletedMilestones`
- 재분석: 이전 세션의 미완료 scheduled/due → `cancelled`, 새 세션에 새 일정
- 루틴 중단: 해당 routineId의 미래 scheduled/due → `cancelled`

## Day별 초점

| Day | 초점 |
|-----|------|
| 3 | 초기 자극·사용법·이상 반응 |
| 7 | 적응·누락·새 제품 |
| 15 | 중간 변화·지속 가능성·보완 |
| 30 | 한 달 요약·재분석·다음 계획 |

## 안전 분기

명시적 규칙 (`evaluateSafetyGate` / `evaluateDermatologyReferral`):

- 호흡 곤란 · 지속 출혈 · 즉각 심한 반응 · 심한 붓기 → 긴급 안내
- 수포 · 심한 통증 · 눈 주변 심한 반응 · 급격 악화 → 신속 상담 안내
- 의료 진단 금지 · 새 제품 추천 억제 · 사용 중단 고려 안내

## 제안

- 규칙 기반 제안만 · **자동 루틴 변경 금지** (`requiresUserConfirm: true`)
