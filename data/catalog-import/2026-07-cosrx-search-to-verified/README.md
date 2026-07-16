# COSRX Search-to-Verified 첫 검증 사례 (2026-07)

## 입력
- `input/cosrx-products.json` — catalog 제품 3개
- `input/cosrx-offers.json` — 공식몰 offer 3개 (unverified / stock unknown)

## 적용 결과 (Staging만)
- Verified 전환: **0** (전성분·재고 미검증 → 자동 Verified 금지)
- needs_review: **3**
- 기존 제품 매칭: **2** (Snail 96 → productId=1, Snail 92 → productId=10)
- 신규 products 행: **0** (블레미쉬 패드는 candidate만)
- products 총행: 적용 전후 **11 유지**
- productId 4~11 본문: **변경 없음**
- 재실행: candidate/offer/provenance **증분 0** (idempotent)

## 산출물
- `normalized/products.json`
- `verification-report.json`
- `staging-apply-result.json`

## 실행
```bash
node scripts/run-apply-cosrx-s2v-staging.mjs
```
Production ref면 즉시 중단. service_role DELETE 권한은 부여하지 않음.
