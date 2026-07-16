# 70 — Brand Discovery

## 원칙

- 브랜드 목록을 소스코드에 하드코딩하지 않는다.
- seed: `products.brand` distinct + `brands` 테이블 enrichment.
- 공식 사이트 없으면 **crawl 금지** → `needs_review`.
- 검색 결과 후보는 공식 사이트 검증 전까지 unverified.

## 커넥터

`generic_sitemap` / `shopify` / `woocommerce` / `nextjs` / `static` / `custom_fallback`  
브랜드 예외는 `connectors.ts` 설정 데이터로 관리.

## API

- `GET /api/admin/brands`
- `GET /api/admin/brands/[id]`
- `POST /api/admin/brands/resolve-official-site` (SSRF 검증, DB 영구 저장은 migration 후)
