# Scenario Pilot Enrichment (2026-07-22)

Offline enrichment of the five-scenario Top10 pilot toward `recommendation_ready`.  
**No** WQ-G, DB write, Staging write, Production, UI, runtime recommend wiring, CAPTCHA bypass, or mass crawl.

Artifact dir: `data/catalog/scenario-pilot-enrichment/2026-07-22/`

## Root cause: reuseRate 0% (original pilot)

Confirmed from `scripts/_gen-scenario-pilot-top10.cjs` + `data/catalog/scenario-pilot/2026-07-22/SUMMARY.json`:

1. Each scenario curated **unique** products — no shared `productIdentity` across pools (`uniqueProductIdentities: 50`, `reuseRate: 0`).
2. No global product registry / multi-scenario membership model.
3. Category tags were **single-valued**; pools built **in isolation**.
4. Name variants were never merged across scenarios.

**Fix:** global `products.json` + `scenario-pools.json` many-to-many membership; reuse target **15–35%**. This enrichment run: **unique 42 / slots 50 → reuseRate 0.16**.

Legitimate A↔B cross-membership (documented cream/serum barrier exceptions) for eight barrier products; C/D/E remain category-faithful.

## Readiness rules

`promoteReadiness` (`src/lib/catalog/multiSource/readinessPromote.ts`):

| Ingredient status | Result |
|-------------------|--------|
| `needs_review` | `review_required` |
| `verified` \| `cross_source_confirmed` + official image + verified offer + identity | `recommendation_ready` |
| `source_verified_candidate` | `ingredient_candidate` |
| `ingredient_incomplete` + identity + offer/image | `catalog_ready` |
| identity only | `trend_candidate` |

`recommendation_ready` is **never** forced with fake INCI. Marketplace live fetch is `blocked_by_policy` / `skipped` in `source-evidence.json`.

## Results (this run)

| Metric | Value |
|--------|-------|
| Scenarios × slots | 5 × 10 |
| Unique products | 42 |
| reuseRate | **0.16** (target met) |
| recommendation_ready (slot count) | **8** |
| Per-scenario ready | A3 · B3 · C1 · D0 · E1 |
| Target ≥5/scenario & ≥30 total | **Shortfall** — honest; limited official INCI+image+offer packs |

Affiliate/ad never in organic score. Brand cap default ≤2. Organic score fields absent.

## multiSource files

- `src/lib/catalog/multiSource/types.ts`
- `src/lib/catalog/multiSource/sourceTrust.ts` (oliveyoung → B when official channel flag)
- `src/lib/catalog/multiSource/ingredientMerge.ts` (trust via A>B>C>D rank, not string `<=`)
- `src/lib/catalog/multiSource/productIdentity.ts`
- `src/lib/catalog/multiSource/readinessPromote.ts`
- `src/lib/catalog/multiSource/pilotEnrichment.ts`
- `src/lib/catalog/multiSource/index.ts`

## Commands

```bash
node scripts/run-scenario-pilot-enrichment.cjs
npm run test:recommendation-pilot-enrichment
```

## Limits

- Evidence pack prefers official brand / CPNP pages only; no invented INCI/prices/stock.
- Naver / Coupang / Olive Young live PDP not fetched (policy).
- Aestura sunscreen mineral SKU not mapped onto unrelated cream identity.
- No runtime wiring of enrichment into recommend engine.
