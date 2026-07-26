# P3-T01 — Official Korean product source onboarding

최종 갱신: 2026-07-24
상태: **코드·fixture dry-run 완료** · 실 공식 사이트 live 수집·사람 검수·Staging import는 `external_only`

## 목적

한국 뷰티 제품을 **공식 출처 우선**으로 온보딩하는 production-safe 파이프라인.

다루는 범위:

- 브랜드 공식 페이지
- 공식 한국몰 페이지
- 공식 전성분(INCI) 공개
- 제품 이미지 · variants · 가격 · 재고 · 국가 가용성 · 사용 가이드
- 필드 단위 provenance

## 금지 (강제)

- CAPTCHA 우회
- 로그인/인증 스크래핑
- 유료 API 호출
- 약관 위험 자동화
- 미확인 필드 발명 (가격·재고·배송국·전성분 등)
- fixture / 미검증 후보 공개·게시
- Production / Staging DB 쓰기 · main 병합

## 코드

| 경로 | 역할 |
|------|------|
| `src/lib/onboarding/officialKoreanProductSource/*` | 계약·매니페스트·dedupe·stale·checkpoint·eligibility·pipeline |
| `scripts/official-kr-product-source-selftest.ts` | selftest |
| `scripts/run-official-kr-product-source.ts` | dry-run 러너 → `artifacts/official-kr-product-source/` |

## 명령

```bash
npm run test:official-kr-product-source
npm run check:official-kr-product-source
```

## 안전 플래그 (항상)

- `publishAllowed=false`
- `publicVisible=false`
- `databaseTouched=false`
- `writeAttempted=false`
- `productionTouched=false`
- `paidApiUsed=false`
- `captchaBypassAttempted=false`
- `authenticatedScrapeAttempted=false`

## 정책 요약

| 항목 | 규칙 |
|------|------|
| 출처 우선순위 | brand official / official KR mall / official INCI ≫ authorized ≫ marketplace/fixture |
| 미확인 필드 | `null` / `unknown` 유지 |
| dedupe | brand+name+volume (결정적) · URL 보조 |
| refresh | offer 30일 · 제품 메타 90일 |
| stale | 180일 초과 시 게시 차단 |
| fixture | `fixture_cannot_publish` · 비공개 |
| 재개 | `ResumableManifestCheckpoint` · slice 단위 |

## 미검증 (`external_only`)

- 실 브랜드/공식몰 live 수집
- 사람 전성분·이미지 권리 검수
- Staging import 승인
- publishable 전환

## 관련

- P2-T04 실데이터 온보딩 준비 (`realDataOnboarding`)
- T03 제품 자동화 (`productAutomation`)
- `docs/29-korean-product-data-guide.md`
