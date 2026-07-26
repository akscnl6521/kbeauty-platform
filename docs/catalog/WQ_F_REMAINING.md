# WQ-F ? Recommendation Scenario Top10 Pools

> **2026-07-22 Phase 0/1 redirect:** WQ-F is no longer mass brand SKU registration.
> Goal: curated recommendation scenarios with candidate pool of 10, then personal Top 3-5.
> Official crawl + product_discovery_candidates remain as ingestion feeds into pools.
> See docs/catalog/RECOMMENDATION_SCENARIOS.md and RECOMMENDATION_SCENARIO_PHASE2_SCHEMA.md.
> Forbidden: WQ-G, Production, main merge, auto-publish, CAPTCHA bypass, affiliate-ranked organic.

---

# WQ-F Catalog Remaining

Korean cosmetics official crawl → normalize → quality gate → dry-run → Staging candidate bulk register → exceptions-only admin review → non-PII backup.

## Scope

- Popular KR brands (priority): COSRX, Beauty of Joseon, Anua, ROUND LAB, Isntree, SOME BY MI, SKIN1004, Torriden
- Limits (env): `WQF_MAX_BRANDS` (default 5), `WQF_MAX_PRODUCTS_PER_BRAND` (default 10)
- Robots-aware crawl only · no CAPTCHA/login bypass · blogs are not truth sources
- New rows go to `product_discovery_candidates` only (never auto-publish `products`)

## Commands

```bash
# Unit tests
npm run test:catalog-quality-status
npm run test:catalog-exception-queue
npm run test:catalog-refresh
npm run test:catalog-refresh-due

# Dry-run crawl + reports (default, no DB write)
WQF_DRY_RUN=1 npm run catalog:wq-f-remaining

# After dry-run looks safe — Staging candidate upsert only
WQF_COMMIT_STAGING=1 npm run catalog:wq-f-remaining
```

Windows PowerShell:

```powershell
$env:WQF_DRY_RUN="1"; $env:WQF_MAX_BRANDS="5"; $env:WQF_MAX_PRODUCTS_PER_BRAND="10"; npm run catalog:wq-f-remaining
$env:WQF_COMMIT_STAGING="1"; npm run catalog:wq-f-remaining
```

## Outputs

Under `data/catalog/wq-f-remaining/<stamp>/`:

- `dry-run-report.json`
- `exception-queue.json`
- `crawl-summary.json`
- `manifest.json`

Readonly backup: `data/backups/wq-f-<stamp>/` (via `BACKUP_OUT` → `backup-staging-catalog-readonly.mjs`)

## Quality statuses

`staging_ready` | `review_required` | `source_unverified` | `ingredient_incomplete` | `image_missing` | `offer_missing` | `duplicate` | `unavailable` | `discontinued` | `blocked_by_policy`

Priority (first match): blocked → duplicate → discontinued → unavailable → source_unverified → ingredient_incomplete → image_missing → offer_missing → review_required → staging_ready

## Admin

- Unified review filter: `/admin/review?source=catalog_exception`
- Catalog shell links to the same filter + artifact path note

## Safety

- Staging linked ref only (`jfnjufmldiqlgvgyugfd`)
- Production (`rhfrmvkjsummaylpzmns`) forbidden
- No `run-pipeline-worker.mjs` / Task Scheduler
- No main merge / Production deploy from this sprint
