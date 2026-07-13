# 90 — Autonomous Draft Catalog

고신뢰 discovery candidate → `products` **draft** (`active=false`, `verified_at=null`).

- 마이그레이션 없음: draft = `active=false`
- 추천 Top5: `active=false` 제외 (`fetchCandidateProducts`)
- `recommendationEligible=false` (offer=0 / draft)
- 자동 published·verified offer·overwrite·DELETE 금지
- config: `allowDraftProductInsert` (기본 true)

구현: `src/lib/pipeline/draft-product.ts`, `catalog-enrich.ts`
