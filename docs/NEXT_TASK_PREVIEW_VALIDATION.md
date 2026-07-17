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

1~10. [x] Staging 다양성 · Preview · 브랜드 쿼터 V5
11. [ ] **문진→Top5 재랭킹** (캐시 V6) → 커밋·Preview 배포

## 현재 단일 작업

**문진 concern으로 핵심 Top5 재랭킹** — `/results?concern=…`에서 Evidence+랭킹 실행 (`ai=1`은 유지).
