# 72 — Product Extraction

## 우선순위

JSON-LD Product/Offer → Shopify JSON → OpenGraph → meta → semantic HTML → visible text

## 정책

- 필드별 confidence / source / method
- 원문 HTML 전체 저장 금지 (정제 텍스트·hash)
- 가격/재고는 offer_candidate만 (verified offer 금지)
- 가짜 링크/성분 생성 금지

구현: `product-extraction.ts` + 기존 `import/extract-product`
