import { NextResponse } from "next/server";
import {
  countRecommendationReadyInPool,
  getReadySlugsForScenario,
  listPilotPoolScenarioIds,
} from "@/lib/recommend/scenarios/pilotPhase2/pilotPoolArtifacts";
import { matchPilotScenario } from "@/lib/recommend/scenarios/pilotPhase2/matchPilotScenario";
import { recommendationToScenarioMatchInput } from "@/lib/recommend/scenarios/pilotPhase2/recommendationToMatchInput";
import { runScenarioPilotPhase2 } from "@/lib/recommend/scenarios/pilotPhase2/runScenarioPilotPhase2";
import type { Recommendation } from "@/lib/recommend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
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
    pools,
  });
}

export async function POST(request: Request) {
  const blocked = devOnly();
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
    fetchCandidatesBySlugs: async () => [],
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
      status: result.status,
      snapshot: result.snapshot,
      rankedCount: result.ranked.length,
      usedScenarioPoolOnly: result.usedScenarioPoolOnly,
    },
  });
}
