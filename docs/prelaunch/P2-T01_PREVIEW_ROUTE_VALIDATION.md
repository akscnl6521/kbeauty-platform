# P2-T01 — Automated Preview / local route validation

최종 갱신: 2026-07-24
분류: `verified_complete` (자동화 인프라·selftest) · 사람 Preview/실기기 육안은 `external_only`

## 목적

공개·여정·관리자 진입 라우트에 대해 **반복 가능한** 로컬/Preview 자동 검증을 제공한다.

- 공개: `/`, `/analyze`, `/results`, `/routine`, `/login`, …
- 프로필·안내: `/my`, `/my/profile`, `/my/guidance` (미인증 → `/login`)
- 관리자 검수 진입: `/admin/review`, `/admin/login` (미인증 → `/admin/login`)
- loading / empty / error 소스 마커
- viewport: **320 / 390 / 768 / 1440**
- 스크린샷 + machine-readable JSON
- **시각(육안) 승인 주장 금지** (`visualApprovalClaimed: false`)

## 명령

```bash
# 계약·인벤토리 selftest (서버 불필요)
npm run test:preview-routes

# 정적 인벤토리 + JSON 아티팩트
npm run check:preview-routes

# 실행 중 앱 HTTP (로컬 또는 Preview)
BASE_URL=http://127.0.0.1:3000 npm run check:preview-routes -- --mode=http
PREVIEW_BASE_URL=https://….vercel.app npm run check:preview-routes -- --mode=http

# Playwright 스크린샷 (chromium 필요)
npx tsx scripts/run-preview-route-validation.ts --mode=browser --base-url=http://127.0.0.1:3000
```

Playwright 준비(최초 1회):

```bash
npm i -D playwright
npx playwright install chromium
```

## 아티팩트

| 경로 | 내용 |
|------|------|
| `artifacts/preview-route-validation/latest-result.json` | machine-readable 결과 |
| `artifacts/preview-route-validation/latest-summary.md` | 사람용 요약 |
| `artifacts/preview-route-validation/screenshots/*.png` | viewport 스크린샷 (browser 모드) |

아티팩트는 gitignore 대상이다.

## 재사용

- HTTP/정적 패턴: `scripts/smoke-test.mjs` (`npm run test:smoke`)
- Preview SSO 취급: `scripts/preview-concern-quality-smoke.mjs`와 동일 — 보호 응답은 우회하지 않고 기록
- 계약 소스: `src/lib/validation/previewRouteValidation.ts`

## 정직 경계

| 항목 | 상태 |
|------|------|
| 라우트 파일 존재·계약·UI 마커 | 자동 검증 가능 |
| 미인증 redirect / API 401 | `BASE_URL` 있을 때 HTTP 검증 |
| 스크린샷 | browser 모드 증거만 · **육안 승인 아님** |
| Preview SSO·실기기·법무 | `external_only` (사람) |

로그인/CAPTCHA/SSO 우회 금지 · Production 호스트 거부 · 비밀키 출력 금지.
