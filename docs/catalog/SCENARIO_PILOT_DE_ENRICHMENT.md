# Scenario Pilot D/E Enrichment (2026-07-22)

Offline **D/E-only** recommendation_ready pass layered on the base enrichment run.  
**No** WQ-G, DB/Staging write, Production, UI/runtime wiring, CAPTCHA bypass, or mass crawl.

Artifact dir: `data/catalog/scenario-pilot-enrichment-de/2026-07-22/`

## Scope

| Scenario | ID | Focus |
|----------|-----|--------|
| D | `kr-uv-sunscreen-sensitive` | KR/US SKU split, mineral vs chemical filters, SPF/PA |
| E | `kr-aging-eye-cream` | Official PDP INCI, eye-category fidelity, retinal caution |

A/B/C pools are **unchanged** (same ready counts as base enrichment).

## Method

1. Base pack: `data/catalog/scenario-pilot-enrichment/2026-07-22/_evidence-pack.json`
2. Overlay: `_de-evidence-overlay.json` (patches + pool replacements + candidate adds)
3. Logic: `src/lib/catalog/multiSource/pilotDeEnrichment.ts`
4. Runner: `node scripts/run-scenario-pilot-de-enrichment.cjs`

### D rules applied

- **KR/US separation:** `round-lab-birch-juice-moisturizing-sunscreen-us` (US UVLock) replaces ambiguous combined id; `review_required` until KR SPF50+ label cross-check.
- **SKU correction:** `aestura-derma-uv365-barrier-hydro-mineral-sunscreen` replaces mismatched hydro-chemical id; **int.aestura.com INCI kept as reference evidence only** (trust C / `authorized_retailer`) — **not** `recommendation_ready` without KR official label or KR authorized-retailer INCI.
- **Regional conflict:** BOJ Relief Sun Rice+Probiotics vs US Daily Relief SPF40 — **not merged**; stays `review_required`.
- Naver / Olive Young / Coupang: `blocked_by_policy` (no live fetch).

### E rules applied

- BOJ Revive Eye Serum: CPNP/SCPN ingredient table + PDP image/offer → `recommendation_ready`; **retinal** caution recorded.
- COSRX Advanced Snail Peptide Eye Cream: unchanged `recommendation_ready`.
- Illiyoon / Pyunkang Yul / Torriden Dive-In eye: official PDP not captured (403/404/KR-only) — **not promoted**.
- Innisfree Green Tea Seed Eye Cream: US handle 404 (line renamed) — stays `trend_candidate`.
- Sulwhasoo: image+offer only; full INCI absent on US PDP → `catalog_ready`.

## Pool replacements (max 2 per scenario)

| Scenario | Out | In | Reason |
|----------|-----|-----|--------|
| D | `aestura-derma-uv-365-barrier-hydro-sunscreen` | `aestura-derma-uv365-barrier-hydro-mineral-sunscreen` | Global mineral SKU identity; reference INCI only |
| D | `round-lab-birch-juice-moisturizing-sunscreen` | `round-lab-birch-juice-moisturizing-sunscreen-us` | KR/US filter SKU split |
| E | — | — | No replacements (insufficient verified evidence for swap) |

## Results

| Metric | Base (2026-07-22) | D/E pass |
|--------|-------------------|----------|
| **D ready** | 1 | **1** |
| **E ready** | 2 | **2** |
| **Total ready** | 21 | **21** |
| D review_required | 3 | **2** |
| D ingredient_candidate | 0 | **1** (Aestura global reference INCI) |
| Target D/E ≥4, total ≥27 | — | **Shortfall** (documented) |

### D `recommendation_ready` (1)

- `cosrx-aloe-soothing-sun-cream` — official Full Ingredients (cosrx.com)

### D below ready (identity preserved)

- `aestura-derma-uv365-barrier-hydro-mineral-sunscreen` — `ingredient_candidate` (int.aestura.com reference INCI; KR label pending)
- `round-lab-birch-juice-moisturizing-sunscreen-us` — `review_required` (US UVLock; KR formula not cross-confirmed)
- `beauty-of-joseon-relief-sun-rice-probiotics` — `review_required` (US/KR SKU conflict)

### E `recommendation_ready` (2)

- `cosrx-advanced-snail-peptide-eye-cream`
- `beauty-of-joseon-revive-eye-serum` (CPNP + PDP)

### Evidence coverage (D/E slots, 20 total)

| Pack | Count |
|------|-------|
| Verified / cross-source INCI (ready slots) | 3 |
| Reference INCI (ingredient_candidate) | 1 |
| Official image (ready + catalog + candidate) | 6 |
| Verified offer (ready + catalog + candidate) | 6 |
| Regional / SKU conflict flags | 3 |

## Commands

```bash
node scripts/run-scenario-pilot-de-enrichment.cjs
npm run test:recommendation-pilot-enrichment    # base regression
npm run test:recommendation-pilot-de-enrichment # D/E selftest
```

## Limits (unchanged)

- No invented INCI, prices, or stock.
- Single general-seller INCI → `ingredient_candidate` only (none forced to ready).
- International official INCI without KR label → reference evidence only, never `recommendation_ready`.
- Superseded pilot ids marked `unavailable` in overlay to prevent erroneous canonical-url merge.
- Organic / affiliate score fields absent from artifacts.

## Next honest steps (not in this pass)

- KR official label / Olive Young·Naver brand-store INCI for Aestura, Isntree, Torriden, Dr.G, Make P:rem sunscreens (when policy allows).
- Illiyoon / Pyunkang Yul eye cream via KR brand mall (blocked 403 in this pass).
- Sulwhasoo / Dr.Jart full INCI from official ingredient disclosure pages.
