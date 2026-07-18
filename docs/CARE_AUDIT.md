# CARE_AUDIT.md — 지속 관리 기능 감사

최종 갱신: 2026-07-18  
브랜치: `automation-mvp-completion`  
판정: 코드 경로 기준 (문서 체크만 아님)

| 항목 | 상태 | 근거 |
|------|------|------|
| 루틴 생성 | **완료** | `POST /api/care/routines` · `/my/routine/new` · `buildRoutineDraft` |
| 루틴 수정 | **부분 완료** | 버전 생성·제안 적용 · 항목 단위 PATCH API 없음 |
| 루틴 삭제 | **부분 완료** | soft/pause로 비활성 · hard DELETE 권한 REVOKE |
| 아침/저녁 구분 | **완료** | `timeOfDay` am/pm/both · `/my/routine` 분리 표시 |
| 제품 중복 방지 | **부분 완료** | conflicts 휴리스틱 · 동일 슬롯 강제 DB unique 없음 |
| 체크인 생성 | **완료** | `createCheckInSchedule` / `calculateCheckinDates` |
| 예정일 계산 | **완료** | UTC 저장 + TZ 로컬 10시 앵커 (`schedule.ts`) |
| 3·7·15·30 일정 | **완료** | `CARE_CHECKIN_DAYS` · SSOT `checkinSchedule.ts` |
| 완료/건너뛰기 | **완료** | complete API + skip API + UI |
| 사용자 응답 저장 | **완료** | answers JSON · sanitize memo |
| 피부 변화 기록 | **완료** | `progress.ts` · `/my/progress` |
| 부작용·악화 신호 | **완료** | referral + `safetyGate` · emergency flags |
| 루틴 조정 제안 | **완료** | `buildRoutineSuggestions` · 자동 적용 금지 |
| 알림 설정 | **완료** | `/my/settings` notifications/emailOptIn/quietHours |
| 이메일 알림 | **부분 완료** | adapter + dry-run · live send Phase E 승인 전 차단 |
| 앱 내 알림 | **완료** | `/my/notifications` · merge fingerprint |
| 관리자 확인 | **완료** | `/admin/care/*` 집계 · PII 최소화 |
| 재시도 | **부분 완료** | worker tick · lock · checkpoint |
| 중복 발송 방지 | **완료** | notification fingerprint · email duplicate gate |
| 타임존 | **완료** | session/check-in timezone 필드 |
| 탈퇴·동의 철회 | **부분 완료** | consent 필드·설정 토글 · 계정 삭제 플로우는 후속 |
| Day별 질문 차별화 | **완료** | `checkinQuestions.ts` |
| Staging DB 쓰기 | **SKIPPED/BLOCKED** | 로컬 `.env` Production ref · Staging 미링크 |

**BLOCKED**
- 실제 Staging/Prod 스케줄러 크론 등록 (Phase E 승인 후)
- 실제 이메일 대량 발송
- 사진 업로드 파이프라인 (안전 구현 전 강제 안 함)
