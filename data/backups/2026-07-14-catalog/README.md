# Staging catalog backup — 2026-07-14

## 개요
- 환경: **staging** (project ref 미기록)
- 방식: 읽기 전용 SELECT → 로컬 JSON
- Git: `47f850a8496a` / `backup-sprint14-20260713`
- 스키마: `20260714060000`
- 검증: **통과**

## 파일별 행 수
- `catalog-sources.json` ← `catalog_sources` : 5
- `change-history.json` ← `product_change_history` : 2
- `data-sources.json` ← `data_sources` : 1
- `discovery-candidates.json` ← `product_discovery_candidates` : 3
- `field-provenance.json` ← `product_field_provenance` : 15
- `ingredients.json` ← `ingredients` : 129
- `product-ingredients.json` ← `product_ingredients` : 257
- `product-media.json` ← `catalog_product_media` : 11
- `product-offers.json` ← `product_offers` : 2
- `product-variants.json` ← `product_variants` : 0
- `products.json` ← `products` : 11
- `verification-queue.json` ← `verification_queue` : 3

## 민감정보
- signed URL 토큰: 제거/null 처리
- 자격증명·JWT·email 패턴: 미검출
- 자유 텍스트의 DB role 명칭은 `[db_role]`로 치환

## 복원 순서 (실행하지 않음 — 절차만)
1. 동일 migration 적용된 Staging(또는 전용 DB)
2. INSERT 순서:
   1. `catalog_sources`
   2. `data_sources`
   3. `ingredients`
   4. `products`
   5. `product_variants`
   6. `product_ingredients`
   7. `catalog_product_media`
   8. `product_offers`
   9. `product_discovery_candidates`
   10. `verification_queue`
   11. `product_field_provenance`
   12. `product_change_history`
3. manifest SHA-256 대조 → products/ingredients·FK 재검증
4. media는 storage:// 또는 재업로드만 사용

## 재실행
```bash
node scripts/backup-staging-catalog-readonly.mjs
```
