# 151 — Release Smoke Test

최종 갱신: 2026-07-13

```bash
# 기본: 라우트 파일 정적 검사 (서버 불필요)
npm run test:smoke

# HTTP: 실행 중인 앱 대상
BASE_URL=https://staging.example.com SMOKE_MODE=http npm run test:smoke
```

검사: `/` `/analyze` `/login` `/signup` `/privacy` `/terms` `/ingredients` `/sitemap.xml` `/api/health`  
미인증 `/my` `/onboarding` redirect · Care/Admin API 401 · 외부 `next` callback 차단.

실메일·회원가입·운영 row 생성 없음.
