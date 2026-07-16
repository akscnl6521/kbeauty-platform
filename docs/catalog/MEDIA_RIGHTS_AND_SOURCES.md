# Media Rights and Sources

## Source tiers

| Tier | Examples |
|------|----------|
| 1 | Brand official mall / CDN / PDF |
| 2 | Approved Olive Young / Coupang partner / distributor |
| 3 | Public ingredient/product DB |
| 4 | Manual / other (review) |

## Rights review checklist

1. Is the URL on the official product page or brand CDN?
2. Does retailer ToS allow remote display / caching?
3. Is Storage copy licensed?
4. If unclear → `external_link_only` or `needs_review`
5. If search/UGC/AI → `prohibited`

## After staging DB is connected

1. `.\scripts\verify-catalog-staging-env.ps1`
2. Apply migrations including `20260714040000_beauty_taxonomy_media_variants.sql`
3. Dry-run only; `CATALOG_AUTO_PROMOTE=false`
4. Media download/storage copy remains false until rights review
5. Store remote official URLs only in first pass

## Forbidden operational actions on shared Production

- Media insert
- Image fetch jobs
- Migration apply
- Real crawl
