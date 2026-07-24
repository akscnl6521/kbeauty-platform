/**
 * P3-T04 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never activates commercial agreements.
 *
 * Usage:
 *   npx tsx scripts/run-revenue-readiness.ts
 *   npx tsx scripts/run-revenue-readiness.ts --mode=fixture
 *   npx tsx scripts/run-revenue-readiness.ts --mode=dry_run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertNoCommercialActivation,
  runRevenueReadiness,
} from "../src/lib/commercial/revenueReadiness";
import type { RevenueReadinessMode } from "../src/lib/commercial/revenueReadiness";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as RevenueReadinessMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 제휴·스폰서 계약 활성화는 사람 승인 후. 이 러너는 fixture/dry_run만 허용.",
    );
  }

  const result = runRevenueReadiness({
    mode,
    now: new Date("2026-07-24T12:00:00.000Z"),
    humanApprovedIds: ["aff-ok-kr-001", "sp-rail-001", "sp-clinic-aside-003"],
  });
  assertNoCommercialActivation(result);

  const outDir = path.join(process.cwd(), "artifacts", "revenue-readiness");
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");

  writeJson(path.join(outDir, `audit-${stamp}.json`), result.audit);
  writeJson(path.join(outDir, "audit-latest.json"), result.audit);
  writeJson(path.join(outDir, `candidates-${stamp}.json`), {
    runId: result.runId,
    candidates: result.candidates,
    commercialAgreementsActivated: false,
    publishAllowed: false,
  });
  writeJson(path.join(outDir, "candidates-latest.json"), {
    runId: result.runId,
    candidates: result.candidates,
    commercialAgreementsActivated: false,
    publishAllowed: false,
  });
  writeJson(path.join(outDir, `events-${stamp}.json`), {
    runId: result.runId,
    eventValidations: result.eventValidations,
    privacyBoundary: result.privacyBoundary,
  });
  writeJson(path.join(outDir, "events-latest.json"), {
    runId: result.runId,
    eventValidations: result.eventValidations,
    privacyBoundary: result.privacyBoundary,
  });
  writeJson(path.join(outDir, `independence-${stamp}.json`), {
    runId: result.runId,
    organicIndependence: result.organicIndependence,
  });
  writeJson(path.join(outDir, "independence-latest.json"), {
    runId: result.runId,
    organicIndependence: result.organicIndependence,
  });
  writeJson(path.join(outDir, "summary-latest.json"), {
    taskId: result.taskId,
    mode: result.mode,
    runId: result.runId,
    generatedAt: result.generatedAt,
    totals: result.audit.totals,
    publishAllowed: false,
    publicVisible: false,
    commercialAgreementsActivated: false,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    paidApiUsed: false,
    inventedCommissionRates: false,
    inventedLiveUrls: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        outDir: "artifacts/revenue-readiness",
        commercialAgreementsActivated: false,
        publishAllowed: false,
        totals: result.audit.totals,
      },
      null,
      2,
    ),
  );
}

main();
