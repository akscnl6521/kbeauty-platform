/**
 * P3-T05 consolidated human review package builder + markdown.
 */

import { STAGING_IMPORT_AUTOMATED_COMMANDS } from "./automatedCommands";
import { STAGING_IMPORT_BRANCH_EXPECTED } from "./constants";
import { buildStagingHumanReviewSteps } from "./humanReview";
import type {
  StagingImportCommandRunResult,
  StagingImportHumanReviewPackage,
  StagingImportPackageResult,
} from "./types";

export function assertStagingImportHonesty(
  packageResult: StagingImportPackageResult | null,
): void {
  const steps = buildStagingHumanReviewSteps();
  if (!steps.every((s) => s.onceOnly === true)) {
    throw new Error("all human review steps must be onceOnly");
  }
  if (!steps.every((s) => s.productionForbidden === true)) {
    throw new Error("all human steps must forbid Production");
  }
  if (packageResult) {
    if (packageResult.stagingImportExecuted !== false) {
      throw new Error("package must not claim staging import executed");
    }
    if (packageResult.publishAllowed !== false) {
      throw new Error("package must not allow publish");
    }
  }
  const required = STAGING_IMPORT_AUTOMATED_COMMANDS.filter(
    (c) => c.requiredForGate,
  );
  if (required.length < 10) {
    throw new Error("P3-T05 required automated commands incomplete");
  }
}

export function buildStagingImportHumanReviewPackage(
  commandResults: readonly StagingImportCommandRunResult[],
  packageResult: StagingImportPackageResult | null,
  generatedAt: string = new Date().toISOString(),
): StagingImportHumanReviewPackage {
  assertStagingImportHonesty(packageResult);

  const requiredIds = new Set(
    STAGING_IMPORT_AUTOMATED_COMMANDS.filter((c) => c.requiredForGate).map(
      (c) => c.id,
    ),
  );
  const relevant = commandResults.filter((r) => requiredIds.has(r.commandId));
  const automatedPassed = relevant.filter((r) => r.status === "pass").length;
  const automatedFailed = relevant.filter((r) => r.status === "fail").length;
  const automatedSkipped = relevant.filter((r) => r.status === "skipped").length;

  const humanReviewSteps =
    packageResult?.humanReviewSteps ?? buildStagingHumanReviewSteps();
  const sections = packageResult?.sections ?? [];

  return {
    taskId: "P3-T05",
    generatedAt,
    branchExpected: STAGING_IMPORT_BRANCH_EXPECTED,
    writeAttempted: false,
    stagingImportExecuted: false,
    stagingImportApprovalClaimed: false,
    mainMergeAttempted: false,
    productionDeployAttempted: false,
    publishAllowed: false,
    publicVisible: false,
    sections,
    humanReviewSteps,
    automatedCommands: STAGING_IMPORT_AUTOMATED_COMMANDS,
    commandResults,
    packageResult,
    summary: {
      automatedRequired: requiredIds.size,
      automatedPassed,
      automatedFailed,
      automatedSkipped,
      productRows: packageResult?.totals.productRows ?? 0,
      clinicRows: packageResult?.totals.clinicRows ?? 0,
      structurallyStagingImportEligible:
        packageResult?.totals.structurallyStagingImportEligible ?? 0,
      humanStepCount: humanReviewSteps.length,
    },
    honestyNotesKo: [
      "fixture/dry-run ≠ 실 Staging import 실행",
      "structurallyStagingImportEligible ≠ 사람 승인 완료",
      "selftest 통과 ≠ Preview/실기기/공식 live 검수 완료",
      "제휴·스폰서 레인 ≠ Organic Staging 적격",
      "Production/main 미실행 · 출시 가능으로 보지 않음",
    ],
  };
}

export function formatStagingImportHumanReviewMarkdown(
  report: StagingImportHumanReviewPackage,
): string {
  const lines: string[] = [
    `# P3-T05 Integrated Staging import · human review package`,
    ``,
    `생성: ${report.generatedAt}`,
    `브랜치(기대): \`${report.branchExpected}\``,
    ``,
    `## 정직 플래그`,
    ``,
    `| 플래그 | 값 |`,
    `|---|---|`,
    `| writeAttempted | ${report.writeAttempted} |`,
    `| stagingImportExecuted | ${report.stagingImportExecuted} |`,
    `| stagingImportApprovalClaimed | ${report.stagingImportApprovalClaimed} |`,
    `| mainMergeAttempted | ${report.mainMergeAttempted} |`,
    `| productionDeployAttempted | ${report.productionDeployAttempted} |`,
    `| publishAllowed | ${report.publishAllowed} |`,
    `| publicVisible | ${report.publicVisible} |`,
    ``,
    `## 요약`,
    ``,
    `| 자동 필수 | 통과 | 실패 | 생략 | 제품 | 병원 | 구조적 import 적격 | 사람 단계 |`,
    `|---|---|---|---|---|---|---|---|`,
    `| ${report.summary.automatedRequired} | ${report.summary.automatedPassed} | ${report.summary.automatedFailed} | ${report.summary.automatedSkipped} | ${report.summary.productRows} | ${report.summary.clinicRows} | ${report.summary.structurallyStagingImportEligible} | ${report.summary.humanStepCount} |`,
    ``,
    `## 자동 명령 결과`,
    ``,
  ];

  for (const r of report.commandResults) {
    lines.push(
      `- \`${r.npmScript}\` · **${r.status}** · exit=${r.exitCode ?? "n/a"} · ${r.notesKo}`,
    );
  }

  lines.push(``, `## 번들 섹션`, ``);
  for (const section of report.sections) {
    lines.push(`### ${section.id} — ${section.titleKo}`);
    lines.push(``);
    lines.push(section.purposeKo);
    lines.push(``);
    lines.push(`항목 수: ${section.itemCount}`);
    for (const n of section.notesKo) {
      lines.push(`- ${n}`);
    }
    lines.push(``);
  }

  if (report.packageResult) {
    lines.push(`## 게이트·상업 분리`, ``);
    lines.push(
      `- organicOrderUnchanged=${report.packageResult.commercialIndependence.organicOrderUnchanged}`,
    );
    lines.push(
      `- stagingEligibilityIgnoresPaidLane=${report.packageResult.commercialIndependence.stagingEligibilityIgnoresPaidLane}`,
    );
    lines.push(
      `- ${report.packageResult.commercialIndependence.noteKo}`,
    );
    lines.push(``);
  }

  lines.push(`## 1회성 사람 검수 절차 (이후 Staging import용)`, ``);
  for (const step of report.humanReviewSteps) {
    lines.push(`### ${step.id} — ${step.titleKo}`);
    lines.push(``);
    lines.push(`1. 위치: ${step.whereKo}`);
    lines.push(`2. 확인: ${step.checkKo}`);
    lines.push(`3. 통과: ${step.passCriteriaKo}`);
    lines.push(`4. 실패: ${step.failActionKo}`);
    lines.push(
      `5. Staging import 단계: ${step.stagingImport ? "예 (승인 후 사람 실행)" : "아니오"}`,
    );
    lines.push(``);
  }

  lines.push(`## 정직 메모`, ``);
  for (const n of report.honestyNotesKo) {
    lines.push(`- ${n}`);
  }
  lines.push(``);

  return lines.join("\n");
}
