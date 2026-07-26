# Recommendation Scenarios (Phase 0 / 1)

K-Beauty Match is **not** a storefront or price-comparison site.
Flow: user analysis -> scenario candidate pool (10) -> personal Top 3-5 -> usage order -> Day 3/7/15/30 care.

## Modeling rules

1. Scenarios are curated, not a Cartesian product of all axes.
2. Pool keys: primary_concern, product_category, sensitivity_level, body_area (+ optional secondary_concern).
3. Ranking modifiers only (do not create pools): age_group, climate, country, budget_range, current_routine, avoid_ingredients, allergies, purchase_availability.
4. One product may appear in multiple scenarios and hold multiple roles (popular / safety / rising / value / emerging).
5. Role coverage is checked; exact role counts are not forced.
6. Brand cap: default <=2 per scenario; <=3 only with clear quality evidence.
7. Affiliate / ad fees never affect organic candidacy or rank.
8. expert_first / urgent_check block pool entry (symptomSafety).

## KR core scenarios (30)

Areas (5 each): redness_sensitive, dry_barrier, acne_sebum, uv_suncare, aging_firmness, eye_neck.

Source of truth: src/lib/recommend/scenarios/krCoreScenarios.json
Loader: src/lib/recommend/scenarios/krCoreScenarios.ts

## Readiness (product)

trend_candidate -> catalog_ready -> ingredient_candidate -> recommendation_ready / review_required / unavailable

recommendation_ready requires: identity, ingredients or trusted evidence, image, >=1 offer, safety filterable, no critical source conflict.

## Code map

| Module | Role |
|--------|------|
| scenarios/types.ts | Types / readiness / roles |
| scenarios/matchScenario.ts | Match + medical block |
| scenarios/rankingModifiers.ts | Within-pool re-rank only |
| scenarios/poolRules.ts | Brand cap, role coverage, affiliate forbidden |
| scenarios/gapAnalysis.ts | Offline gap heuristics |
| officialCrawl / WQ-F sprint | Ingestion feed (kept, demoted) |
| product_discovery_candidates | Staging discovery input to pools |

## Tests

npm run test:recommendation-scenarios
npm run analyze:scenario-catalog-gap

## Forbidden

WQ-G, Production writes, main merge, auto-publish, CAPTCHA bypass, fake pool fill, mass storefront UI.

## Pilot Top10 (2026-07-22)

Offline honest Top10 pools (5 scenarios): data/catalog/scenario-pilot/2026-07-22/.
Doc: docs/catalog/SCENARIO_TOP10_PILOT.md. Validate: pm run test:recommendation-pilot.
No runtime/UI/DB/multiSource wiring in this pilot.
