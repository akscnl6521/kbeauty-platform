# 84 — Pipeline Dry-Run Validation

## dry_run 허용

브랜드 탐색, 사이트 판별, crawl, 추출, dedupe, 성분 파싱, 분류, quality/skin 점수,
batch/job/provenance/score DB 저장

## dry_run 금지

discovery candidate INSERT, verification queue INSERT, products INSERT,
product_offers INSERT, published 변경

## 검증 체크리스트

1. `npm run test:pipeline`
2. `npm run build`
3. dry_run worker 1회
4. `pipeline_batches` / `pipeline_jobs` row 생성
5. products/ingredients count 불변
6. discovery/offers 무단 INSERT 0
7. 자동 published 0
