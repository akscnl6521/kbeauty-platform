# Scenario Pilot Phase 2 — Runtime (A/B/C only)

**Status:** Local pilot on feature branch. **Not** Production / Staging write / DB migration applied.

## Scope

- **A** `kr-redness-sensitive-cream` — 6 `recommendation_ready`
- **B** `pilot-dryness-barrier-serum` — 7 `recommendation_ready`
- **C** `kr-acne-pores-toner` — 5 `recommendation_ready`
- **D/E** matched but **not** wired → `insufficient_verified_candidates`

Artifact source: `data/catalog/scenario-pilot-enrichment-de/2026-07-22/`

## Runtime entry

`persistTopRankedProducts` → when `NEXT_PUBLIC_SCENARIO_PILOT_PHASE2` is not `false`:

1. Evidence attach (unchanged)
2. `urgent_check` → empty ranked (unchanged)
3. `runScenarioPilotPhase2` — **replaces full-catalog `fetchCandidateProducts` scan**
4. Pool slugs → `fetchCandidateProductsBySlugs` (active + verified only)
5. KR offer → safety → rank → personal re-rank → brand cap → Top 3–5 (no padding)

Disable rollback: `NEXT_PUBLIC_SCENARIO_PILOT_PHASE2=false`

## Snapshot (check-in tracking)

Stored on `Recommendation.scenarioPilot` in localStorage + care `recommendationSnapshot`:

- `scenarioId`, `scenarioVersion`, `candidatePoolVersion`, `productEvidenceVersion`
- `matchConfidence`, `matchReason`, `status`, `verifiedCount`

Details (usage/limitations): `Recommendation.scenarioPilotDetails`

## Preview / admin verify

- **GET** `/api/dev/scenario-pilot-phase2` — pool ready counts (dev only)
- **POST** `/api/dev/scenario-pilot-phase2` — body `{ recommendation }` → match + dry-run status (no DB fetch in POST mock path when slugs empty)

## Tests

```bash
npm run test:recommendation-scenario-phase2
npm run test:recommendation-scenarios
npm run test:care-auto-save
```

## DB migration

**DRAFT only** — see `docs/catalog/RECOMMENDATION_SCENARIO_PHASE2_SCHEMA.md` (not applied).

## Principles enforced

| Rule | Implementation |
|------|----------------|
| A/B/C only runtime | `PILOT_RUNTIME_ABC_SCENARIO_IDS` |
| D/E insufficient | `isPilotInsufficientScenario` early return |
| No sub-ready products | `getReadySlugsForScenario` filters `recommendation_ready` |
| No Top N padding | `clampTopNWithoutPadding` + min 3 gate |
| No affiliate in score | `AFFILIATE_SCORE_FORBIDDEN` + pool flag |
| symptomSafety first | analyze API + `urgent_check` block in pilot runner |
| Regional SKU | `isRegionalSkuExcludedForKr` (`-us` suffix) |
