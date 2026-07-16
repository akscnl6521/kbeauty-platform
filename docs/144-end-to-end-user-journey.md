# 144 — End-to-End User Journey

최종 갱신: 2026-07-13

익명: `/` → `/analyze` → `/results` → 가입/로그인 → `/auth/callback` → `/auth/link-local` → `/onboarding` → `/my`

로그인: `/` → `/analyze` → `/results` → 저장 → (온보딩 필요 시) → `/my`

중복 방지: 분석/체크인/활성 cycle · 온보딩 완료 시 재강제 없음.
테스트: `npm run test:journey` (실메일·운영 DB 쓰기 없음)
