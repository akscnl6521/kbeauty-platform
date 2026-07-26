# Stage 6 — 증상 기반 피부과 후보·상담 리드

최종 갱신: 2026-07-23

## 범위 (이번 구현)

- 공식 병원 후보 수집 **어댑터** (`fixture` / `dry_run` / `live_blocked`)
- 주소·운영시간·언어·예약 URL·근거 필드 검증 게이트
- 거리·언어·예산대 필터 (랭킹)
- Organic vs 제휴 병원 **분리 표시**
- `/my/guidance` 실사용자 흐름 연결 + 상담 리드 최소정보 동의 (**dry-run only**)
- 관리자 `/admin/clinics` 검수 화면 (읽기 전용)
- Preview 원격 검수 JSON: `/api/public/unified-review-manifest` + `UNIFIED_REVIEW_MANIFEST_URL` / `VERCEL_URL` 자동 경로

## 게시 규칙

| 상태 | 사용자 노출 |
|------|-------------|
| discovered ~ fields_verified | 아니오 |
| admin_reviewed | 아니오 (관리자만) |
| publishable + 필드 통과 + fixtureOnly=false | 예 |
| fixtureOnly | 항상 아니오 (demoPreview 라벨만) |

## 금지

- 가짜 병원 게시
- CAPTCHA/로그인 우회 수집
- Production DB 리드 저장
- 진단 문구

## 검증

```bash
npm run test:clinic-stage6
npm run test:clinic-referral
npm run test:unified-review-remote
```
