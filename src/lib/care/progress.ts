/**
 * Progress deltas from check-in answers. No exaggerated efficacy claims.
 */

import type {
  CareCheckIn,
  CareCheckInAnswers,
  CareProgressDelta,
  CareProgressMetric,
  CareTrend,
} from "@/lib/care/types";

function score(
  answers: CareCheckInAnswers | null,
  metric: CareProgressMetric
): number | null {
  if (!answers) return null;
  switch (metric) {
    case "dryness":
      return answers.dryness;
    case "oiliness":
      return answers.oiliness;
    case "sensitivity":
      return avg([answers.sting, answers.itch]);
    case "redness":
      return answers.redness;
    case "breakouts":
      return answers.breakouts;
    case "pigmentation":
      return null; // not collected in short form yet
    case "texture":
      return answers.peeling;
    case "satisfaction":
      return answers.satisfaction;
    case "adherence":
      return answers.adherence;
    default:
      return null;
  }
}

function avg(vals: Array<number | null>): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number");
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * For irritation-like metrics, lower is better.
 * For satisfaction/adherence, higher is better.
 */
function trendFor(
  metric: CareProgressMetric,
  from: number | null,
  to: number | null
): CareTrend {
  if (from == null || to == null) return "insufficient_data";
  const delta = to - from;
  const higherBetter =
    metric === "satisfaction" || metric === "adherence";
  if (Math.abs(delta) < 0.75) return "similar";
  if (higherBetter) return delta > 0 ? "improved" : "worsened";
  return delta < 0 ? "improved" : "worsened";
}

export function computeProgressDeltas(
  previous: CareCheckInAnswers | null,
  current: CareCheckInAnswers
): CareProgressDelta[] {
  const metrics: CareProgressMetric[] = [
    "dryness",
    "oiliness",
    "sensitivity",
    "redness",
    "breakouts",
    "texture",
    "satisfaction",
    "adherence",
  ];
  return metrics.map((metric) => {
    const from = score(previous, metric);
    const to = score(current, metric);
    return {
      metric,
      from,
      to,
      trend: trendFor(metric, from, to),
    };
  });
}

export function summarizeProgress(
  checkIns: CareCheckIn[]
): CareProgressDelta[] {
  const completed = checkIns
    .filter((c) => c.status === "completed" && c.answers)
    .sort((a, b) => a.day - b.day);
  if (completed.length < 2) {
    const last = completed[0];
    if (!last?.answers) return [];
    return computeProgressDeltas(null, last.answers);
  }
  const first = completed[0]!;
  const last = completed[completed.length - 1]!;
  return computeProgressDeltas(first.answers, last.answers!);
}

export function hasWorseningSignal(deltas: CareProgressDelta[]): boolean {
  return deltas.some(
    (d) =>
      d.trend === "worsened" &&
      (d.metric === "redness" ||
        d.metric === "sensitivity" ||
        d.metric === "breakouts" ||
        d.metric === "dryness")
  );
}
