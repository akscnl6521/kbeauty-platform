# COSRX Seed Pack (2026-07)

## 기준
- 출처: cosrx.com 공식 제품 페이지 (확인일 2026-07-14)
- 제외: Advanced Snail 96 Mucin Power Essence (기존 등록)
- productId=3 변경·삭제 금지
- 외부 이미지 URL은 canonical로 쓰지 않음 → ZIP → private Storage

## Staging 등록 결과 (2026-07-14)
- CLI: `node scripts/run-register-cosrx-seed-staging.mjs`
- 성공 8 / 실패 0 → `productId` 4~11
- 미등록(검수): Ultra-Light Invisible Sunscreen SPF50, Full Fit Propolis Synergy Toner
- 상세: `staging-register-result.json`

## 등록 방법 (재실행 시)
1. 관리자 → 제품 일괄등록 **또는** 위 CLI
2. `products.csv` + `product-images.zip`
3. needs_review 행은 선택 해제 유지
4. Staging에만 등록 (slug 중복 시 차단)

## 재검증
- `validation-report.json`의 registerable / needs_review 확인
- Staging REST: id 4~11 slug 존재 확인 완료
