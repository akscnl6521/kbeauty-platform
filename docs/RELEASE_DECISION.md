# RELEASE_DECISION.md — Phase E 출시 판정

최종 갱신: 2026-07-18  
브랜치: `automation-mvp-completion`

## 판정

| 범위 | 판정 | 이유 |
|------|------|------|
| **한국 MVP** | **GO WITH MANUAL CHECKS** | 핵심 여정 코드·정적 테스트 PASS. Preview 육안·Auth/SITE_URL/AI_PROVIDER 대시보드 확인 필요. Production 배포는 별도 승인. |
| **전체 글로벌 플랫폼** | **NO-GO / 진행 중** | US/JP offer·다국어·운영 자동화·Prod 카탈로그 밀도 미완. |

## Blocker 분류

| 종류 | 상태 | 설명 |
|------|------|------|
| 코드 blocker | **없음 (치명)** | Phase E에서 auth next 보존·privacy 케어 문구 보강. lint 기존 WARN은 신규와 구분. |
| 테스트 blocker | **없음** | check:mvp 필수 PASS. |
| Preview blocker | **MANUAL** | SSO/육안 필요 · 자동 E2E 없음. |
| 환경변수 blocker | **배포 직전** | Production AI_PROVIDER=mock · SITE_URL 불일치 시 배포 NO-GO. 로컬은 Prod ref 감지되어 DB 쓰기 SKIPPED(정상). |
| Auth blocker | **배포 직전 MANUAL** | Supabase Auth URL 정합 미확인. |
| Production DB blocker | **해당 없음(미변경)** | 본 브랜치 Prod DB 미수정. |
| 제품 데이터 blocker | **PARTIAL** | Staging recommendable~58 · 잔여 INCI 27 BLOCKED. KR MVP 최소 운영 가능 수준이나 밀도 확대는 Staging 재실행 후. |
| 이메일/cron blocker | **MVP 비차단** | 앱내 알림으로 대체 가능. live는 승인 후. |

## 과장 금지 메모

- Production 앱 배포 = **0%**
- main 병합(본 자동화 브랜치) = **미실행**
- Lighthouse = **SKIPPED**
- Staging live 카탈로그 쓰기 = **SKIPPED** (자격증명)

## 다음 상태

**Production 승인 대기** (대시보드 수동 확인 후 「Production 배포 진행」 승인 시에만 배포)
