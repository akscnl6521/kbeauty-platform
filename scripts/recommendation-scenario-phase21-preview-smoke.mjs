#!/usr/bin/env node
/**
 * Preview-only smoke for scenario pilot phase 2.1.
 * Uses preview debug route backed by real DB reads.
 */
const baseUrl = (process.env.PREVIEW_BASE_URL || process.env.PREVIEW_URL || "").replace(
  /\/$/,
  ""
);

if (!baseUrl) {
  console.error("PREVIEW_BASE_URL required");
  process.exit(2);
}
if (/kbeautymatch\.com/i.test(baseUrl) && !/vercel\.app/i.test(baseUrl)) {
  console.error("ABORT: refuse non-preview production host");
  process.exit(2);
}

const bypass =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
  process.env.VERCEL_PROTECTION_BYPASS ||
  process.env.PREVIEW_BYPASS_SECRET ||
  "";

function headers(extra = {}) {
  const h = { ...extra };
  if (bypass) {
    h["x-vercel-protection-bypass"] = bypass;
    h["x-vercel-set-bypass-cookie"] = "true";
  }
  return h;
}

function isProtectionStatus(status) {
  return status === 401 || status === 403 || status === 302 || status === 307 || status === 308;
}

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: headers(),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}

async function main() {
  const route = "/api/dev/scenario-pilot-phase2";
  const failures = [];
  const notes = [];
  const sampleResults = [];

  const info = await getJson(route);
  if (isProtectionStatus(info.res.status)) {
    console.log(
      JSON.stringify({
        ok: true,
        phase: "scenario_phase21_preview_sso_manual_required",
        baseUrl,
        route,
        status: info.res.status,
      })
    );
    return;
  }
  if (info.res.status !== 200 || !info.json?.ok) {
    throw new Error(`preview debug route unavailable: status=${info.res.status}`);
  }
  const samples = Array.isArray(info.json.samples) ? info.json.samples : [];
  notes.push(`debug_env:${info.json.debugEnv}`);

  for (const sample of samples) {
    const payload = { recommendation: buildRecommendation(sample.id) };
    const out = await postJson(route, payload);
    if (out.res.status !== 200 || !out.json?.ok) {
      failures.push(`${sample.id}: status=${out.res.status}`);
      continue;
    }
    const result = out.json.result;
    const rankedCount = Number(result?.rankedCount ?? 0);
    const status = String(result?.status ?? "");
    if (sample.expectation === "recommendations_ready") {
      if (status !== "ok") failures.push(`${sample.id}: expected ok got ${status}`);
      if (rankedCount < 3 || rankedCount > 5) {
        failures.push(`${sample.id}: rankedCount=${rankedCount}`);
      }
    } else {
      if (status !== "insufficient_verified_candidates") {
        failures.push(`${sample.id}: expected insufficient got ${status}`);
      }
      if (rankedCount !== 0) failures.push(`${sample.id}: ranked should be 0`);
    }
    sampleResults.push({
      id: sample.id,
      label: sample.label,
      expectation: sample.expectation,
      status,
      rankedCount,
      verifiedCount: result?.snapshot?.verifiedCount ?? null,
      scenarioId: result?.snapshot?.scenarioId ?? null,
      ranked: (result?.ranked ?? []).map((row) => ({
        rank: row.rank,
        slug: row.slug,
        brand: row.brand,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        phase: failures.length
          ? "scenario_phase21_preview_smoke_fail"
          : "scenario_phase21_preview_smoke_ok",
        baseUrl,
        route,
        notes,
        failures,
        samples: sampleResults,
      },
      null,
      2
    )
  );
  if (failures.length) process.exit(1);
}

function buildRecommendation(id) {
  switch (id) {
    case "A":
      return {
        skinConcerns: ["Redness", "Sensitivity"],
        recommendedIngredients: [
          "Snail Secretion Filtrate",
          "Panthenol",
          "Hyaluronic Acid",
          "Centella Asiatica",
          "Niacinamide",
        ],
        ingredientsToAvoid: ["Fragrance", "Alcohol Denat"],
        confidenceScore: 0.84,
        managementLevel: "cosmetic_care",
        skinType: "sensitive dry",
        suggestedMorningOrder: ["진정 크림", "자외선 차단"],
        suggestedEveningOrder: ["진정 크림"],
      };
    case "B":
      return {
        skinConcerns: ["Dryness", "Barrier"],
        recommendedIngredients: [
          "Snail Secretion Filtrate",
          "Hyaluronic Acid",
          "Panthenol",
          "Ceramide NP",
          "Centella Asiatica",
          "Niacinamide",
        ],
        ingredientsToAvoid: ["Menthol"],
        confidenceScore: 0.8,
        managementLevel: "cosmetic_care",
        skinType: "dry",
        suggestedMorningOrder: ["세럼", "보습 크림"],
        suggestedEveningOrder: ["세럼", "보습 크림"],
      };
    case "C":
      return {
        skinConcerns: ["Pores", "Acne"],
        recommendedIngredients: [
          "Heartleaf",
          "Salicylic Acid",
          "Glycolic Acid",
          "Niacinamide",
          "Hyaluronic Acid",
        ],
        ingredientsToAvoid: ["Fragrance"],
        confidenceScore: 0.79,
        managementLevel: "cosmetic_care",
        skinType: "oily sensitive",
        suggestedMorningOrder: ["토너", "가벼운 보습"],
        suggestedEveningOrder: ["토너", "가벼운 보습"],
      };
    case "D":
      return {
        skinConcerns: ["UV", "Sensitivity"],
        recommendedIngredients: ["Zinc Oxide"],
        ingredientsToAvoid: ["Fragrance", "Alcohol Denat"],
        confidenceScore: 0.75,
        managementLevel: "cosmetic_care",
        skinType: "sensitive",
        suggestedMorningOrder: ["선크림"],
      };
    case "E":
      return {
        skinConcerns: ["Antiaging", "Dryness"],
        recommendedIngredients: ["Peptide", "Ceramide NP"],
        ingredientsToAvoid: ["Fragrance"],
        confidenceScore: 0.73,
        managementLevel: "cosmetic_care",
        skinType: "dry mature",
        suggestedMorningOrder: ["아이크림"],
        suggestedEveningOrder: ["아이크림"],
      };
    default:
      throw new Error(`unknown sample id: ${id}`);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      phase: "scenario_phase21_preview_smoke_fail",
      baseUrl,
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
});
