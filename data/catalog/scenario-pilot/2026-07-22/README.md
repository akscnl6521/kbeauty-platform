# Scenario Top10 Pilot ? 2026-07-22

Offline pilot artifacts for 5 recommendation scenarios (exactly 10 candidates each after filtering `unavailable`).

## Purpose

- Demonstrate honest Top10 pools with real KR products
- Show low `recommendation_ready` rates when evidence is incomplete
- Document multiSource gaps needed before runtime fill
- **No** runtime wiring, UI, DB migration, or multiSource implementation

## Files

| File | scenarioId |
|------|------------|
| A-kr-redness-sensitive-cream.json | kr-redness-sensitive-cream |
| B-pilot-dryness-barrier-serum.json | pilot-dryness-barrier-serum (coreScenarioRef: kr-dryness-barrier-essence) |
| C-kr-acne-pores-toner.json | kr-acne-pores-toner |
| D-kr-uv-sunscreen-sensitive.json | kr-uv-sunscreen-sensitive |
| E-kr-aging-eye-cream.json | kr-aging-eye-cream |
| SUMMARY.json | aggregate metrics |
| README.md | this file |

## Rules baked into artifacts

- brandCapDefault = 2
- affiliateOrAdInScore = false (never in organic score)
- recommendation_ready only with identity + usable INCI + image + offer URL + no major conflict

## multiSource needed features (list only ? not implemented)

1. Retail PDP fetch with robots.txt respect
2. INCI merge across sources
3. Image evidence capture
4. Offer freshness checks
5. SKU regional conflict detection (sunscreen filters KR vs US)
6. CAPTCHA/block detection ? switch source
7. No affiliate / ad signals in organic score

## Regen

```bash
node scripts/_gen-scenario-pilot-top10.cjs
```

Generator is kept for regeneration.

## Validate

```bash
npm run test:recommendation-pilot
```
