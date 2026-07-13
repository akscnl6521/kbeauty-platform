# 149 — Staging Deployment

최종 갱신: 2026-07-13

## 전제

- 코드에 `vercel.json` 없음 → **Vercel 권장** (또는 Node `next start`)
- Node 20 · Next.js 16 · `npm run build` → `npm run start`
- 도메인: `kbeautymatch.com` (apex canonical, www→apex 301)
- Cursor는 **실제 배포 명령을 실행하지 않음**

## Staging 절차 (사용자)

1. Preview/Staging 프로젝트에 `.env.example` 항목 설정 (비밀은 플랫폼 시크릿)
2. `AI_PROVIDER` ≠ mock · Site URL ≠ localhost
3. Auth Redirect URL에 staging origin + `/auth/callback` 추가
4. 배포 후 `GET /api/health` · `BASE_URL=… SMOKE_MODE=http npm run test:smoke`
5. 가입·온보딩·`/my` 수동 E2E (실운영 row 최소화)

## 검사

```bash
npm run check:deployment-env
npm run check:production
npm run test:smoke
```
