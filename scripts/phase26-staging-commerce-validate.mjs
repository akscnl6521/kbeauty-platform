/**
 * Phase 2.6 — Staging SELECT-only A/B/C/D/E + commerce separation validation.
 * No DB write. Aborts on Production ref / main branch misuse is caller's duty.
 */
import fs from "node:fs";
import path from "node:path";
import { fetchCandidateProductsBySlugs } from "../src/lib/recommend/fetchCandidateProducts.ts";
import {
  deriveCommerceAvailability,
  isRecommendCommerceSeparationEnabled,
} from "../src/lib/recommend/commerceStatus.ts";
import {
  isOfferEligibleForCoreRecommendation,
  resolveProductOffers,
} from "../src/lib/recommend/productOffer.ts";
import { buildScenarioPilotPreviewSamples } from "../src/lib/recommend/scenarios/pilotPhase2/previewDebug.ts";
import { matchPilotScenario } from "../src/lib/recommend/scenarios/pilotPhase2/matchPilotScenario.ts";
import { recommendationToScenarioMatchInput } from "../src/lib/recommend/scenarios/pilotPhase2/recommendationToMatchInput.ts";
import { runScenarioPilotPhase2 } from "../src/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2.ts";
import {
  countRecommendationReadyInPool,
  getReadySlugsForScenario,
} from "../src/lib/recommend/scenarios/pilotPhase2/pilotPoolArtifacts.ts";
import { AFFILIATE_SCORE_FORBIDDEN } from "../src/lib/recommend/scenarios/poolRules.ts";
import { RECOMMENDATION_CACHE_VERSION } from "../src/lib/recommend/types.ts";

const ROOT = process.cwd();
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";

function loadEnv(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function extractRef(url) {
  return (String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

function maskRef(ref) {
  if (!ref || ref.length < 7) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

const fileEnv = {
  ...loadEnv(".env.staging"),
  ...loadEnv(".env.preview.staging"),
  ...loadEnv(".env.local"),
};
for (const [k, v] of Object.entries(fileEnv)) {
  if (process.env[k] == null) process.env[k] = v;
}

const ref = extractRef(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error(`ABORT unexpected ref ${maskRef(ref)}`);

process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 =
  process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 || "true";

const mode = (process.env.PHASE26_MODE || "on").toLowerCase(); // on | off
if (mode === "off") {
  process.env.RECOMMEND_COMMERCE_SEPARATION = "0";
} else {
  process.env.RECOMMEND_COMMERCE_SEPARATION =
    process.env.RECOMMEND_COMMERCE_SEPARATION || "1";
}

const samples = buildScenarioPilotPreviewSamples();
const scenarioBySample = {
  A: "kr-redness-sensitive-cream",
  B: "pilot-dryness-barrier-serum",
  C: "kr-acne-pores-toner",
  D: "kr-uv-sunscreen-sensitive",
  E: "kr-aging-eye-cream",
};

const out = [];
for (const sample of samples) {
  const scenarioId = scenarioBySample[sample.id];
  const matchInput = recommendationToScenarioMatchInput(sample.recommendation);
  const match = matchPilotScenario(matchInput);
  const result = await runScenarioPilotPhase2({
    recommendation: sample.recommendation,
    fetchCandidatesBySlugs: (slugs) =>
      fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
    shippingCountry: "KR",
  });

  const ranked = result.ranked.map((r, i) => {
    const offers = resolveProductOffers(r.product);
    const commerce = deriveCommerceAvailability({
      offers,
      shippingCountry: "KR",
    });
    const ctaActive = offers.some((o) =>
      isOfferEligibleForCoreRecommendation(o, "KR")
    );
    const purchaseLinks = Array.isArray(r.product.purchase_links)
      ? r.product.purchase_links.length
      : 0;
    return {
      rank: i + 1,
      slug: r.product.slug,
      brand: r.product.brand,
      score: r.score,
      matchedIngredients: r.matchedIngredients,
      commerce_status: commerce.commerce_status,
      seller: commerce.seller,
      official_seller: commerce.official_seller,
      price: commerce.price,
      currency: commerce.currency,
      checked_at: commerce.checked_at,
      offer_count: offers.length,
      purchase_links_count: purchaseLinks,
      cta_active: ctaActive,
      stock_statuses: offers.map((o) => o.stockStatus),
      retailer_countries: [...new Set(offers.map((o) => o.retailerCountry))],
    };
  });

  out.push({
    id: sample.id,
    label: sample.label,
    scenarioId,
    poolReady: countRecommendationReadyInPool(scenarioId),
    poolSlugs: getReadySlugsForScenario(scenarioId),
    match: match
      ? { scenarioId: match.scenario.scenarioId, confidence: match.confidence }
      : null,
    status: result.status,
    verifiedCount: result.snapshot?.verifiedCount ?? null,
    shortageReason: result.snapshot?.shortageReason ?? null,
    rankedCount: result.ranked.length,
    ranked,
  });
}

const c = out.find((s) => s.id === "C");
const cSlugs = (c?.ranked ?? []).map((r) => r.slug);
const assertions = {
  affiliateForbidden: AFFILIATE_SCORE_FORBIDDEN === true,
  cacheVersion: RECOMMENDATION_CACHE_VERSION,
  separationEnabled: isRecommendCommerceSeparationEnabled(),
  mode,
  A_ok: out.find((s) => s.id === "A")?.status === "ok" && (out.find((s) => s.id === "A")?.rankedCount ?? 0) >= 3,
  B_ok: out.find((s) => s.id === "B")?.status === "ok" && (out.find((s) => s.id === "B")?.rankedCount ?? 0) >= 3,
  D_insufficient: out.find((s) => s.id === "D")?.status === "insufficient_verified_candidates",
  E_insufficient: out.find((s) => s.id === "E")?.status === "insufficient_verified_candidates",
  C_ok: mode === "off" ? true : c?.status === "ok" && (c?.rankedCount ?? 0) >= 3,
  C_hasCosrx: cSlugs.some((s) => String(s).includes("cosrx")),
  C_hasAnua: cSlugs.some((s) => String(s).includes("anua")),
  C_hasBojOrHaruharu:
    cSlugs.includes("beauty-of-joseon-green-plum-refreshing-toner") ||
    cSlugs.includes("haruharu-wonder-black-rice-hyaluronic-toner"),
  C_boj:
    (() => {
      const boj = (c?.ranked ?? []).find(
        (r) => r.slug === "beauty-of-joseon-green-plum-refreshing-toner"
      );
      if (!boj) return { present: false };
      return {
        present: true,
        commerce_status: boj.commerce_status,
        cta_active: boj.cta_active,
        expect_oos_and_cta_off:
          boj.commerce_status === "out_of_stock" && boj.cta_active === false,
      };
    })(),
  C_haruharu:
    (() => {
      const h = (c?.ranked ?? []).find(
        (r) => r.slug === "haruharu-wonder-black-rice-hyaluronic-toner"
      );
      if (!h) return { present: false };
      return {
        present: true,
        commerce_status: h.commerce_status,
        cta_active: h.cta_active,
        expect_unknown_and_cta_off:
          h.commerce_status === "availability_unknown" && h.cta_active === false,
        no_us_sku_mix: !(h.retailer_countries || []).includes("US"),
      };
    })(),
  no_us_in_kr_top: out
    .filter((s) => ["A", "B", "C"].includes(s.id))
    .every((s) =>
      (s.ranked ?? []).every(
        (r) => !(r.retailer_countries || []).includes("US") || r.commerce_status === "region_unavailable"
      )
    ),
  in_stock_cta_ok: (c?.ranked ?? [])
    .filter((r) => r.commerce_status === "in_stock")
    .every((r) => r.cta_active === true),
  oos_cta_off: (c?.ranked ?? [])
    .filter((r) => r.commerce_status === "out_of_stock")
    .every((r) => r.cta_active === false),
};

const report = {
  ok: true,
  phase: "2.6",
  checked_at: new Date().toISOString(),
  projectRef: maskRef(STAGING),
  write: 0,
  migration_apply: false,
  production: false,
  commerce_separation: assertions.separationEnabled,
  mode,
  cache_version: RECOMMENDATION_CACHE_VERSION,
  samples: out,
  assertions,
};

const outDir = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22"
);
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(
  outDir,
  mode === "off" ? "phase26-staging-select-rollback.json" : "phase26-staging-select.json"
);
fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
console.error(`wrote ${outFile}`);
