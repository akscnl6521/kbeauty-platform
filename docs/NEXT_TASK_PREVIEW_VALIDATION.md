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

1~20. [x] 다양성 · UX · tab 동기화
21. [x] **페이스 탐색 노출** (헤더·홈·푸터) → Preview READY (`e5261c6`)
22. [x] **페이스 탐색 부위 → 도메인 연결** → Preview READY (`234516e`)
23. [x] **페이스 탐색 모바일 터치** (호버 없이 탭 선택·CTA)
24. [ ] **베이스 문진 노출** (홈·퀴즈 내비에서 `/quiz/base` 도달 확인·보강)

## 현재 단일 작업

**베이스 문진 노출** — `/quiz/base`가 홈·문진 도메인 내비에서 쉽게 열리는지 확인하고 필요 시 CTA 보강.
