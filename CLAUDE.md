# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**K-Beauty Match** — an AI skincare *intelligence* platform (explicitly **not** a shop, marketplace, or price-comparison site), live at `https://www.kbeautymatch.com`. Core flow: understand skin → match ingredients → recommend verified products → routine → follow-up care. Next.js 16 (App Router) + React 19 + Tailwind 4 + Supabase (PostgreSQL) + TypeScript strict.

The user is Korean and not comfortable with English terminal output. **Report results in Korean**, state exactly what to click and which value to check, and never ask them to interpret logs or paste key values into chat.

## Commands

```bash
npm run dev            # predev hook runs patch:analyze-concerns first
npm run build          # prebuild hook runs patch:analyze-concerns first
npm run lint           # eslint (flat config)
npx tsc --noEmit       # typecheck
```

`patch:analyze-concerns` is a **codegen patch**, not a test: `scripts/patch-analyze-concern-observations.ts` rewrites `src/app/analyze/page.tsx` in place to wire in the concern-observation panel. It is idempotent (detects an already-integrated file). If a build unexpectedly modifies `analyze/page.tsx`, this is why.

### Tests

There is no test framework. Every test is a standalone script executed with `tsx`, asserting with `node:assert/strict` and printing `... self-test: ok` on success. ~150 of them are registered as `npm run test:*` / `check:*` scripts in [package.json](package.json).

```bash
npm run test:symptom-safety                          # a registered suite
npx --yes tsx scripts/clinic-referral-ranking-selftest.ts   # run one directly
npx --yes tsx scripts/pipeline-diagnostic-selftest.ts recommend-score   # legacy suites take a name arg
```

Naming: `scripts/<feature>-selftest.ts` = pure-logic assertions (safe, offline). `scripts/run-<feature>.ts` (exposed as `check:*`) = runners that emit evidence bundles into `artifacts/<feature>/`. `scripts/verify-*-staging.mjs` / `gate:*` / `apply:*` touch Staging and require approval.

`tsconfig.json` **excludes** `scripts/` and `**/*selftest.ts`, so `tsc --noEmit` does not typecheck them — a broken selftest only surfaces when you run it.

CI: [.github/workflows/core-journey-ci.yml](.github/workflows/core-journey-ci.yml) is the authoritative regression list (core journey suites + `test:journey` + build); [ci.yml](.github/workflows/ci.yml) builds and rejects `CREATE OR REPLACE POLICY` in migrations (PostgreSQL has no such statement).

## Architecture

### Layout

- `src/app/` — App Router. Public journey (`/quiz`, `/analyze`, `/results`, `/routine`, `/face-explorer`, `/ingredients/[slug]`), authenticated `/my`, and a separate `/admin` console with its own login. `src/app/api/` splits into `admin/`, `care/`, `public/`, `catalog/`, `clinics/`, `commerce/`, `track/`, `health/`.
- `src/lib/` — the bulk of the system, organized by domain: `recommend/`, `ai/`, `care/`, `catalog/`, `pipeline/`, `clinic/`, `commercial/`, `auth/`, `publicData/`, `ops/`, `release/`. Business rules live here as pure functions so selftests can exercise them without a DB.
- `src/proxy.ts` — Next 16's middleware equivalent. Shallow Supabase cookie refresh, sets `x-pathname`, gates `/my` and `/onboarding`, redirects logged-in users away from `/login`. It deliberately does **not** query `admin_users` or decide roles.
- `supabase/migrations/`, `config/`, `data/`, `design-system/`, `docs/` (~166 files), `artifacts/` (generated evidence).

### Supabase clients — pick the right one

`src/lib/supabase/browser.ts` (anon + RLS), `server.ts` (SSR cookies), `admin.ts` (service role, `import "server-only"`, lazily constructed so missing env doesn't break unrelated builds). Never import `admin.ts` from a client component. Admin route handlers wrap with `withAdminAuth(handler, allowedRoles)` from [src/lib/auth/withAdminAuth.ts](src/lib/auth/withAdminAuth.ts), which returns `{ ok: false, error: { code, message } }` on failure.

### Env access

Read env through [src/lib/config/env.ts](src/lib/config/env.ts) / `runtime.ts`, which expose **presence booleans only** — values, keys, and Supabase project refs must never reach health responses, logs, docs, or chat. `assertProductionEnvSafe()` hard-fails production on missing config or `AI_PROVIDER=mock`. Never create a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

### Recommendation pipeline

`src/lib/recommend/` (re-exported through `index.ts` — import from `@/lib/recommend`, not deep paths):

1. `fetchCandidateProducts` → `filterCandidatesBySafety` → `applyUserIngredientPreferences` → `rankProducts` (ingredient canonicalization + concern match − avoid penalty + KR-brand boost) → `filterRankedByMatchEvidence` → offer eligibility (`productOffer.ts`) → `persistTopRankedProducts`.
2. **Internal candidate pool is Top 10; the user sees Top 3–5.** Keep that split.
3. Ingredient names go through `normalizeIngredient` / `concernAliases` canonicalization; brand names through `canonicalBrandName` — **never auto-translate brand names**, and keep product name and brand name separate.
4. `resultExposurePolicy.ts` is the safety gate on the results screen: management level `urgent_check` hides products and purchase info entirely, `expert_first` downgrades to supportive reference only (no CTA, no price/retailer). `src/lib/ai/symptomSafety.ts` classifies red flags (pain, bleeding, oozing, breathing difficulty…) into those levels. Redness, severe inflammation, pain, oozing, and worsening always route to professional consultation before product recommendation.
5. Organic recommendations and affiliate/sponsored placements are separated (`src/lib/commercial/`, `commerce-separation-selftest.ts`) with explicit disclosure.

**Do not change scoring weights, safety filters, or Korean-offer eligibility unless explicitly asked.**

### Catalog: search-to-verified

Products advance `discovered → sale_checked → ingredients_checked → evidence_checked → safety_checked → verified → published`. Only `published` products enter core recommendations. `src/lib/pipeline/` is an autonomous ingestion pipeline (brand discovery → crawl → extraction → ingredient normalization → evidence link → quality gate → `needs_review`); it may auto-save normal results but **auto-`published` is forbidden** — humans review only `needs_review`. Data model separates Product / ProductVariant / ProductOffer / ProductIngredient / IngredientEvidence. A product with no verified offer is `eligibility=false`; marketplace sellers are excluded.

Never fabricate products, prices, stock, purchase links, reviews, statistics, or efficacy claims — including as filler for empty states.

### Migrations

Filename prefix encodes intent: `YYYYMMDDHHMMSS_*.sql` = normal, `DRAFT_DO_NOT_APPLY_*` = designed but deliberately unapplied, `STAGING_ONLY_APPLY_*` / `STAGING_ONLY_ROLLBACK_*` / `STAGING_ONLY_DIAGNOSE_*` = Staging-scoped. Many are applied by a human in the Supabase Dashboard SQL Editor, not by tooling.

## Operating rules

These come from [PROJECT_RULE.md](PROJECT_RULE.md) and `.cursor/rules/*.mdc`, and are also enforced by hooks in `.claude/hooks/` plus deny rules in `.claude/settings.json`.

**Stop and get explicit approval for:** merging to `main`, Production deploy, Production DB or env changes, `DROP`/`TRUNCATE`/bulk `DELETE`, real user email/SMS/push sends, PII migrations, ad activation. Automatic progress on a feature branch through Staging/Preview is expected without per-step questions.

**Do not run from an agent session:** `node scripts/run-pipeline-worker.mjs` or `run-pipeline.ps1`, Windows Task Scheduler registration/inspection loops, Supabase operational INSERT/UPDATE/DELETE on live catalog data, ad-hoc operational SQL. Development and operations are separated — the operator owns the fixed `KBeautyMatch-Pipeline` task and `config/pipeline-operation.json`.

Standard order of work: check state → read code + DB → plan → minimal change → `npm run build` → verify screen → git backup → (approved) Supabase change → verify by read → data backup → update docs. One task at a time; don't mix a connectivity check with a DB change.

Errors are not fixed improvisationally: diagnose cause → plan → minimal fix. On failure, don't re-run the same command — establish cause and partial-completion state first.

### Documentation is part of "done"

Finishing a task requires updating [PROJECT_STATUS.md](PROJECT_STATUS.md) (current truth, with a `next_task:` line), [CHANGELOG.md](CHANGELOG.md), and [ROADMAP.md](ROADMAP.md) when sequencing changes. Precedence when documents conflict: `MASTER_PLAN.md` → `PROJECT_RULE.md` → `PROJECT_STATUS.md` → `ROADMAP.md`/`CHANGELOG.md` → `docs/*`.

### Resuming work

When the user says 계속하자 / 다음 작업 / 진행해 / 작업 재개 (or similar), read `PROJECT_STATUS.md` → `ROADMAP.md` → `WORK_QUEUE.md` → `CHANGELOG.md`, then take the single `status: active` task from `WORK_QUEUE.md` (or `npm run project:status` / `project:next`). Do not re-run already-completed items, and don't make the user restate the prompt.

Non-personal catalog data is backed up to `data/backups/YYYY-MM-DD/{products,product-offers,ingredients,manifest}.json`. Code/docs/migrations live in GitHub; real product, ingredient, offer, price, stock, and verification data live in Supabase — one side alone is not "done".

## UI work

Read [design-system/MASTER.md](design-system/MASTER.md) and `.cursor/rules/kbeauty-ui-design.mdc` before UI changes. Warm-paper palette (`--background: #faf7f5`, `--brand: #c2185b`) defined in `src/app/globals.css`; sticky-header offset is shared via `--site-header-height`. Reject spa / e-commerce / marketplace / price-comparison / generic SaaS-dashboard patterns, purple AI gradients, dark-OLED defaults, `#2563EB` blue, "Buy now" urgency, and fake badges. One job per page, mobile-first, long INCI text must stay readable. Preserve the existing recommendation, safety, and care logic. Auto-progress to Preview only.
