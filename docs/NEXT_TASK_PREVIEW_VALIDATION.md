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
21. [x] **페이스 탐색 노출** → Preview READY (`e5261c6`)
22. [x] **페이스 탐색 부위 → 도메인 연결** → Preview READY (`234516e`)
23. [x] **페이스 탐색 모바일 터치** → Preview READY (`7893766`)
24. [x] **베이스 문진 노출** → Preview READY (`82490c8`)
25. [x] **립 문진 홈 노출** → `9c0f3e6`
26. [x] **홈 CTA 정리** → Preview READY (`7af2a24`)
27. [x] **푸터 문진 링크 정리** → Preview READY (`ffdfa9c`)
28. [x] **성분 가이드 푸터 링크**
29. [ ] **홈에 성분 가이드 CTA** (`/ingredients` 홈 노출)

## 현재 단일 작업

**홈에 성분 가이드 CTA** — 홈 주 CTA 또는 보조 링크에 `/ingredients`를 추가한다.
