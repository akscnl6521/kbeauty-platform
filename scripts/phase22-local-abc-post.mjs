/**
 * Local A/B/C scenario POST equivalent (SELECT via recommend fetch).
 * No DB write. Uses Staging env from .env.staging / .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import { fetchCandidateProductsBySlugs } from "../src/lib/recommend/fetchCandidateProducts.ts";
import {
  buildScenarioPilotPreviewSamples,
} from "../src/lib/recommend/scenarios/pilotPhase2/previewDebug.ts";
import { matchPilotScenario } from "../src/lib/recommend/scenarios/pilotPhase2/matchPilotScenario.ts";
import { recommendationToScenarioMatchInput } from "../src/lib/recommend/scenarios/pilotPhase2/recommendationToMatchInput.ts";
import { runScenarioPilotPhase2 } from "../src/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2.ts";
import {
  countRecommendationReadyInPool,
  getReadySlugsForScenario,
} from "../src/lib/recommend/scenarios/pilotPhase2/pilotPoolArtifacts.ts";

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

const env = {
  ...loadEnv(".env.staging"),
  ...loadEnv(".env.preview.staging"),
  ...loadEnv(".env.local"),
};
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] == null) process.env[k] = v;
}

const ref = extractRef(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
if (ref === PROD) throw new Error("ABORT Production");
if (ref !== STAGING) throw new Error(`ABORT unexpected ref ${ref}`);

process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 =
  process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 || "true";

const samples = buildScenarioPilotPreviewSamples().filter((s) =>
  ["A", "B", "C"].includes(s.id)
);

const out = [];
for (const sample of samples) {
  const scenarioId = {
    A: "kr-redness-sensitive-cream",
    B: "pilot-dryness-barrier-serum",
    C: "kr-acne-pores-toner",
  }[sample.id];

  const matchInput = recommendationToScenarioMatchInput(sample.recommendation);
  const match = matchPilotScenario(matchInput);
  const result = await runScenarioPilotPhase2({
    recommendation: sample.recommendation,
    fetchCandidatesBySlugs: (slugs) =>
      fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
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
    rankedCount: result.ranked.length,
    ranked: result.ranked.map((r, i) => ({
      rank: i + 1,
      slug: r.product.slug,
      brand: r.product.brand,
      matchedIngredients: r.matchedIngredients,
    })),
    aesturaInRanked: result.ranked.some(
      (r) => r.product.slug === "aestura-atobarrier365-cream"
    ),
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: "local_abc_post_equivalent_SELECT",
      projectRef: `${STAGING.slice(0, 4)}***${STAGING.slice(-3)}`,
      write: 0,
      samples: out,
    },
    null,
    2
  )
);
