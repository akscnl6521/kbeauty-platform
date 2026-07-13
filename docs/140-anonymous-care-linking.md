# 140 — Anonymous Care Linking

최종 갱신: 2026-07-13

로그인/가입 직후 local care 데이터가 있으면 `/auth/link-local`에서 확인.
확인 시에만 `POST /api/care/analyses/attach`. 거절 시 로컬 유지·설정에서 재연결.
localStorage 자동 삭제 금지. 중복 session/day/fingerprint 방지.
