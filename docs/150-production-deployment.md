# 150 — Production Deployment

최종 갱신: 2026-07-13

## 환경변수 (필수)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버만)
- `AI_PROVIDER` = openai|anthropic (mock 금지)
- `NEXT_PUBLIC_SITE_URL` = `https://kbeautymatch.com`

## 절차 (사용자 승인 후)

1. staging smoke·health 통과 확인
2. production 환경변수 설정
3. Supabase Auth Site URL = production
4. Redirect URLs에 production `/auth/callback`
5. 배포 · `/api/health` · HTTP smoke
6. worker는 **별도 운영 PC/스케줄러** — 웹 배포와 분리
7. **main 병합은 별도 승인**

## 금지

자동 publish/delete · 실메일 대량 발송 테스트 · Cursor 운영 DB 쓰기
