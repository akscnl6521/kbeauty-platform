# CARE_OPERATION_GUIDE.md — 지속 관리 운영 가이드

최종 갱신: 2026-07-18  
정책: `docs/AUTOMATION_POLICY.md` · 감사: `docs/CARE_AUDIT.md`

## 사용자 화면

| 경로 | 역할 |
|------|------|
| `/my` | 오늘 할 일 · 분석 저장 · 다음 체크인 |
| `/my/routine` | 아침/저녁 · 제안 적용 · 일시중지/중단 |
| `/my/routine/new` | 루틴 초안 |
| `/my/check-ins` | 일정 목록 |
| `/my/check-ins/[id]` | 단계형 체크인 · 완료/건너뛰기 · 안전 안내 |
| `/my/notifications` | 앱 내 알림 센터 |
| `/my/progress` | 변화 |
| `/my/settings` | 알림·이메일 희망·quiet hours |

## 관리자

- `/admin/care` · `/admin/care/check-ins` (Day/상태 필터) · `/admin/care/alerts` · engagement
- PII·메모 전체 노출 없음 · Production 대량 조작 없음

## Worker

```bash
npm run care:dry-run
npm run care:scheduler
npm run care:notify
npm run test:care
```

- 기본 dry-run · Production ref면 DB 쓰기 차단
- Staging + service role 있을 때만 apply 가능 (별도 승인 운영)
- **Production 크론 등록은 Phase E 승인 후**
- 권장 주기(문서만): 매일 1회 due refresh + 알림 upsert · 사용자 TZ 반영은 dueAt 기준

## 이메일

- `src/lib/care/email/adapter.ts`
- opt-in 필수 · opt-out 즉시 skip · duplicate fingerprint
- provider/자격증명 없으면 `dry_run` / `SKIPPED`
- 긴급 신호는 이메일로 자동 판정하지 않음 (체크인 완료 시 앱 내 안내)

## 개인정보

- 체크인 목적: 루틴 적응·안전 신호·재방문 케어 (진단 아님)
- 사진: 선택 · 업로드 파이프라인 준비 전 강제 안 함
- freeMemo: 길이 제한·HTML strip · 로그에 원문 금지
- privacy/terms와 충돌 시: 기능이 동의를 전제로 하며, 법률 확정 문구는 본 문서에서 단정하지 않음

## Staging

현재 로컬 `.env`가 Production ref를 가리키면 care DB 쓰기는 **SKIPPED**.  
코드·UI·dry-run·테스트는 완료 가능.
