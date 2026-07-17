# NEXT_TASK — Preview 반영 · 플랫폼 속도 우선

최종 갱신: 2026-07-17

## 운영 원칙 (사용자 지시 2026-07-17)

- **에이전트가 볼 수 없는 항목은 건너뛴다** (Supabase Auth URL 대시보드, 수동 승인 대기 등)
- Production main 병합·Production 배포·Production DB는 별도 명시 전까지 **안 함**
- Staging / Preview / 코드로 플랫폼을 **최대한 빠르게** 진행
- Staging 카탈로그 INSERT/UPDATE는 **운영 분리**로 에이전트 금지 → 공개 SKU 승격은 운영자/별도 승인

## 건너뜀 (나중에 일괄)

- [skip] Production Auth URL Configuration
- [skip] Production 진행 승인 질문
- [skip] 잔여 27 INCI (BLOCKED)
- [skip] Staging INCI SKU 자동 승격 (운영 DB 쓰기)

## 작업 순서

1~19. [x] 다양성 · UX · 성분 가이드
20. [ ] **results `?tab=` ↔ 도메인 탭 동기화** → 커밋·Preview

## 현재 단일 작업

**문진→결과 탭 연결** — 메이크업/헤어 문진이 해당 탭을 연다.
