# RELEASE_DECISION.md — 출시 판정

최종 갱신: 2026-07-18  
브랜치: `automation-mvp-completion`

## 판정

| 범위 | 판정 | 이유 |
|------|------|------|
| **한국 MVP** | **NO-GO — 추천 제품 데이터 필요** | Preview `/results`에서 verified+active+recommendable 핵심 추천·둘러보기 제품이 **0건**. 코드/레이아웃/빈 상태 UX는 보완했으나, 판매처까지 검증된 추천 가능 제품 데이터가 출시 차단. |
| **전체 글로벌 플랫폼** | **NO-GO / 진행 중** | US/JP offer·다국어·운영 자동화·Prod 카탈로그 밀도 미완. |

## Blocker 분류

| 종류 | 상태 | 설명 |
|------|------|------|
| 코드 blocker | **완화됨** | `/results` 2단 레이아웃·정직한 빈 상태·이미지 fallback·Preview fixture Production 게이트. |
| 테스트 blocker | **없음** | build/smoke/journey/quality/recommendable/responsive/release-security/prod-safety/check:mvp 대상. |
| Preview blocker | **데이터** | 체험용 완전 fixture 없음(백업 offer unverified). 가짜 제품 미생성. |
| 환경변수 blocker | **배포 직전** | Production AI_PROVIDER=mock · SITE_URL 불일치 시 배포 NO-GO. |
| Auth blocker | **배포 직전 MANUAL** | Supabase Auth URL 정합 미확인. |
| Production DB blocker | **해당 없음(미변경)** | 본 브랜치 Prod DB 미수정. |
| 제품 데이터 blocker | **출시 차단** | recommendable 핵심 추천 0 · 공개 browse 0 가능. Staging에 verified KR offer+in_stock 확보 전까지 GO 불가. |
| 이메일/cron blocker | **MVP 비차단** | 앱내 알림으로 대체 가능. |

## 과장 금지 메모

- Production 앱 배포 = **0%**
- main 병합(본 자동화 브랜치) = **미실행**
- Preview fixture 발명 = **없음**
- 이전 「GO WITH MANUAL CHECKS」는 Preview 검수 후 **철회** (추천 제품 0건)

## 다음 상태

**추천 제품 데이터 확보 대기** — Staging에서 verified+active+KR offer(in_stock)·이미지까지 갖춘 recommendable 제품 투입 후 Preview 재검수. Production 배포·main 병합 금지.
