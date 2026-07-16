# 98 — Autonomous Offer Discovery

공식 제품 페이지 JSON-LD Offer / Shopify / 페이지 URL에서 offer 후보를 발견한다.

- 등급: official_brand_store → authorized_retailer → marketplace_official_store
- marketplace_seller·SNS·어필리에이트만 있는 URL 기본 제외
- legacy link는 재검증 전 verified 금지
- SSRF 보호 재사용

구현: `src/lib/pipeline/offers/*`
