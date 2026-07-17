# NEXT_TASK — Preview 반영 · 플랫폼 속도 우선

최종 갱신: 2026-07-17

## 운영 원칙 (사용자 지시 2026-07-17)

- **에이전트가 볼 수 없는 항목은 건너뛴다** (Supabase Auth URL 대시보드, 수동 승인 대기 등)
- Production main 병합·Production 배포·Production DB는 별도 명시 전까지 **안 함**
- Staging / Preview / 코드로 플랫폼을 **최대한 빠르게** 진행

## 건너뜀 (나중에 일괄)

- [skip] Production Auth URL Configuration
- [skip] Production 진행 승인 질문
- [skip] 잔여 27 INCI (BLOCKED)

## 작업 순서

1~7f. [x] Staging 다양성·KRW·skin_concern·캐시 V4 코드
8. [x] 백업 브랜치 커밋·push + Preview 배포 (`6bf5e5c`)
9. [x] Staging 대체 Top5 확인 — 적격 **14** · 브랜드 **6** · 부적격 0 (Preview SSO 스킵)
10. [x] Top5 브랜드 다양성 쿼터 (max 2 · 캐시 V5) → Preview (`e62e556`)

## 현재 단일 작업

**다음 플랫폼 확대 1건** — INCI 없이 가능한 것 우선 (문진→Top5 재랭킹, 카테고리 UX, 또는 INCI 확보된 SKU만 승격). Production 금지.
