# 141 — Care Auth E2E

최종 갱신: 2026-07-13

흐름: 가입 → 이메일 인증 → 로그인 → (link-local) → 온보딩 → 분석/루틴 저장 → 체크인 4개 → `/my` hydrate → 체크인 완료 → progress/suggestion/notification.

보호: `/my/**` · `/api/care/**`(API 401). Cursor는 실메일 발송 E2E 미실행.
