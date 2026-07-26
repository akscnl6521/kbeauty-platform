import { NextResponse } from "next/server";
import { fetchCandidateProductsBySlugs } from "@/lib/recommend/fetchCandidateProducts";
import { isScenarioPilotPhase2Enabled } from "@/lib/recommend/scenarios/pilotPhase2";
import {
  countRecommendationReadyInPool,
  getReadySlugsForScenario,
  listPilotPoolScenarioIds,
} from "@/lib/recommend/scenarios/pilotPhase2/pilotPoolArtifacts";
import { matchPilotScenario } from "@/lib/recommend/scenarios/pilotPhase2/matchPilotScenario";
import {
  buildScenarioPilotPreviewSamples,
  isScenarioPilotPreviewDebugEnabled,
} from "@/lib/recommend/scenarios/pilotPhase2/previewDebug";
import { recommendationToScenarioMatchInput } from "@/lib/recommend/scenarios/pilotPhase2/recommendationToMatchInput";
import { runScenarioPilotPhase2 } from "@/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2";
import type { Recommendation } from "@/lib/recommend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function previewOrDevOnly(): NextResponse | null {
  if (!isScenarioPilotPreviewDebugEnabled(process.env)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = previewOrDevOnly();
  if (blocked) return blocked;

  const pools = listPilotPoolScenarioIds().map((scenarioId) => ({
    scenarioId,
    recommendationReady: countRecommendationReadyInPool(scenarioId),
    readySlugs: getReadySlugsForScenario(scenarioId),
  }));

  return NextResponse.json({
    ok: true,
    pilot: "scenario-phase2",
    artifactDate: "2026-07-22",
    debugEnv: process.env.NODE_ENV === "production" ? "preview" : "development",
    phase2Enabled: isScenarioPilotPhase2Enabled(),
    pools,
    samples: buildScenarioPilotPreviewSamples().map((sample) => ({
      id: sample.id,
      label: sample.label,
      expectation: sample.expectation,
    })),
  });
}

export async function POST(request: Request) {
  const blocked = previewOrDevOnly();
  if (blocked) return blocked;

  const body = (await request.json()) as { recommendation?: Recommendation };
  const recommendation = body.recommendation;
  if (!recommendation || !Array.isArray(recommendation.skinConcerns)) {
    return NextResponse.json(
      { ok: false, error: "recommendation.skinConcerns required" },
      { status: 400 }
    );
  }

  const matchInput = recommendationToScenarioMatchInput(recommendation);
  const match = matchPilotScenario(matchInput);

  const result = await runScenarioPilotPhase2({
    recommendation,
    fetchCandidatesBySlugs: (slugs) =>
      fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
  });

  return NextResponse.json({
    ok: true,
    matchInput,
    match: match
      ? {
          scenarioId: match.scenario.scenarioId,
          confidence: match.confidence,
          reason: match.reason,
        }
      : null,
    result: {
      phase2Enabled: isScenarioPilotPhase2Enabled(),
      status: result.status,
      snapshot: result.snapshot,
      rankedCount: result.ranked.length,
      usedScenarioPoolOnly: result.usedScenarioPoolOnly,
      ranked: result.ranked.map((row, index) => ({
        rank: index + 1,
        productId: row.product.id,
        slug: row.product.slug,
        brand: row.product.brand,
        nameKo: row.product.name_ko,
        matchedIngredients: row.matchedIngredients,
        excludedIngredients: row.excludedIngredients,
        reason:
          row.product.recommendation_reason_ko ??
          row.product.recommendation_reason ??
          null,
      })),
      details: result.details,
    },
  });
}
