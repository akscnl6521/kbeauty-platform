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
8. [ ] **백업 브랜치 커밋·push** + **Preview 배포** (V4 · official_global)
9. [ ] Preview `/results` 다브랜드 Top5 동작 확인(대체 가능하면 Staging API)
10. [ ] 다음 플랫폼 확대 (공개 풀·카테고리·문진 UX 중 가장 빠른 1건)

## 현재 단일 작업

**커밋 → push → Preview 배포** — Staging 다양성·Preview offer 모드·캐시 V4를 Preview에 반영.
