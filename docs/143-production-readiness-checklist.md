# 143 — Production Readiness Checklist

최종 갱신: 2026-07-13

실행: `npm run check:production` (비밀값 미출력, 존재 여부만)

- NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 존재
- SERVICE_ROLE은 서버 전용 · browser 번들 미포함
- `/auth/callback` `/reset-password` `/privacy` `/terms` 존재
- worker hard lock · auto publish/delete false
- `.env.local` git 제외
- mock provider production 차단 검사
