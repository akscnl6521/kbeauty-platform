# RELEASE_DECISION.md — 출시 판정

최종 갱신: 2026-07-18  
브랜치: `automation-mvp-completion`

## 판정

| 범위 | 판정 | 이유 |
|------|------|------|
| **한국 MVP** | **NO-GO — 추천 제품 데이터 필요** | 공식몰 검증 import bundle **READY 7** 확보. 그러나 Staging 미연결로 DB 미등록·자동 Verified 금지 → **Preview 실노출 0**. 5건 이상 Preview 표시 전 GO 불가. |
| **전체 글로벌 플랫폼** | **NO-GO / 진행 중** | US/JP offer·다국어·운영 자동화·Prod 카탈로그 밀도 미완. |

## Blocker 분류

| 종류 | 상태 | 설명 |
|------|------|------|
| 코드 blocker | **완화됨** | `/results` UX·빈 상태·fixture 게이트. |
| 제품 데이터 blocker | **부분 완화 / 출시 차단 유지** | offline bundle 7 READY · Staging 등록·수동 Verified·verified offer 대기. |
| Staging blocker | **SKIPPED write** | 로컬 env=Production ref · SERVICE_ROLE 없음. |
| Preview blocker | **데이터 파이프라인** | needs_review만으로는 공개 추천 불가 (기준 유지). |

## 과장 금지 메모

- Preview 추천 카드 실노출 = **0** (검수 전)
- Production 앱 배포 = **0%**
- 자동 Verified = **없음**
- 품절/구매불가 제품을 in_stock으로 조작 = **없음**

## 다음 상태

**Staging 검수 등록 대기** — `docs/VERIFIED_PRODUCT_BATCH_REPORT.md` 절차. Production 배포·main 병합 금지.
