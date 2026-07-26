# Scenario Top10 Pilot (2026-07-22)

Offline pilot only. **No** runtime recommendation wiring, UI surfacing, DB migration, or multiSource implementation in this drop.

## Purpose

- Build five honest Top10 candidate pools with **real KR products**
- Keep `recommendation_ready` rare unless identity + usable INCI + image evidence + offer URL + no major conflict
- Measure unique product reuse and readiness distribution
- List multiSource capabilities still needed before pools can be filled automatically

## Scenarios

| File | scenarioId | Notes |
|------|------------|-------|
| A-kr-redness-sensitive-cream.json | `kr-redness-sensitive-cream` | COSRX Snail 92 + AESTURA Atobarrier365 ? `recommendation_ready` (prior official INCI research) |
| B-pilot-dryness-barrier-serum.json | `pilot-dryness-barrier-serum` | `coreScenarioRef`: `kr-dryness-barrier-essence` |
| C-kr-acne-pores-toner.json | `kr-acne-pores-toner` | Actives cautioned (AHA/BHA/PHA) |
| D-kr-uv-sunscreen-sensitive.json | `kr-uv-sunscreen-sensitive` | ROUND LAB birch ? `ingredient_candidate` (KR vs US filter SKU conflict); BOJ Relief Sun ? `catalog_ready` (PDP OK, INCI not extracted) |
| E-kr-aging-eye-cream.json | `kr-aging-eye-cream` | Retinal caution on BOJ eye serum |

Artifact path: `data/catalog/scenario-pilot/2026-07-22/`

**Enrichment (reuse + readiness, offline):** see `docs/catalog/SCENARIO_PILOT_ENRICHMENT.md` and `data/catalog/scenario-pilot-enrichment/2026-07-22/` (`npm run test:recommendation-pilot-enrichment`).

## Honesty about readiness

Expect **few** `recommendation_ready` rows. Most slots are `catalog_ready`, `ingredient_candidate`, or `trend_candidate` with an explicit `rejectionReason`. Fake products and padded ready counts are forbidden.

## Rules

- Exactly 10 candidates per scenario after filtering `unavailable`
- `brandCapDefault` = 2
- `affiliateOrAdInScore` always false (never in organic score)

## Validate

```bash
npm run test:recommendation-pilot
```

Pure logic: `src/lib/recommend/scenarios/pilotPoolValidate.ts`  
Selftest: `scripts/recommendation-pilot-selftest.ts`  
Regen (kept): `node scripts/_gen-scenario-pilot-top10.cjs`

## multiSource needed features (list only)

1. Retail PDP fetch with robots.txt respect
2. INCI merge across sources
3. Image evidence capture
4. Offer freshness checks
5. SKU regional conflict detection (sunscreen filters KR vs US)
6. CAPTCHA/block detection ? switch source
7. No affiliate / ad signals in organic score

## Phase 2 schema suggestions

See append in `docs/catalog/RECOMMENDATION_SCENARIO_PHASE2_SCHEMA.md` for `roleTags[]`, `sourceTrust`, `trendEvidence`, and readiness transition fields.
