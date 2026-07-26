# P3-T02 — Verified product pool and category expansion

최종 갱신: 2026-07-24
상태: **코드·fixture dry-run 완료** · 실 live verified SKU·공개 Top 5 게시는 `external_only`

## 목적

승인된 공식 출처 매니페스트와 **비공개 dry-run 기록**만으로 검증 후보 풀을 확장한다.

대상 카테고리:

- skincare
- makeup
- hair/scalp
- body
- lip/eye

## 구현 범위

| 항목 | 내용 |
|------|------|
| 카테고리 정규화 | `categoryNormalize` — 힌트 → 5풀 매핑 · 용량/브랜드/이름 정규화 |
| 안전 적격 | blocking safety flags → `safety_hold` |
| 중복 병합 | brand+name+volume 결정적 키 · 풍부한 게이트 우선 유지 |
| 추천 준비 | 출처·전성분·이미지 권리·구매 offer 4기둥 |
| 거절 사유 | `REJECTION_REASON_CATALOG` 기계 판독 코드 |
| 공개 Top 5 게이트 | 4기둥 미검증·fixture·dry-run → **진입 금지** |
| 감사 카운트 | `VerifiedPoolAuditTotals` JSON |

## 금지 (강제)

- 미승인 매니페스트 · 마켓 단독 · 유료 API · CAPTCHA/로그인 우회
- 미확인 필드 발명
- fixture/dry-run 공개·게시
- Production / Staging DB 쓰기 · main 병합

## 코드

| 경로 | 역할 |
|------|------|
| `src/lib/catalog/verifiedProductPool/*` | 계약·정규화·게이트·dedupe·Top5·audit·pipeline |
| `scripts/verified-product-pool-selftest.ts` | selftest |
| `scripts/run-verified-product-pool.ts` | dry-run 러너 → `artifacts/verified-product-pool/` |

## 명령

```bash
npm run test:verified-product-pool
npm run check:verified-product-pool
```

## 안전 플래그 (항상)

- `publishAllowed=false`
- `publicVisible=false`
- `databaseTouched=false`
- `writeAttempted=false`
- `productionTouched=false`
- `paidApiUsed=false`
- fixture/dry_run 모드에서 `publicTop5=[]`

## 공개 Top 5 증명

다음 중 **하나라도** 없으면 공개 Top 5 진입 불가:

1. verified official source
2. verified full ingredients (INCI)
3. verified image rights
4. verified purchase offer

회귀: live-shaped probe로 각 기둥 누락 시 `evaluatePublicTop5Eligibility.allowed === false`.

## 미검증 (`external_only`)

- 실 브랜드/공식몰 live 수집
- 사람 전성분·이미지 권리 검수
- Staging import · publishable · 실제 공개 Top 5 게시

## 관련

- P3-T01 공식 한국 제품 출처 온보딩
- T03 제품 자동화 (`productAutomation`)
- EX-11 제품 live verified SKU
