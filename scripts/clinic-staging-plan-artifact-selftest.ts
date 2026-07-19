import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "clinic-plan-artifact-"));
const snapshotsFile = join(dir, "source-snapshots.json");
const existingFile = join(dir, "existing-clinics.json");
const outputFile = join(dir, "clinic-staging-sync-plan.json");

writeFileSync(
  snapshotsFile,
  JSON.stringify([
    {
      sourceUrl: "https://clinic.example.com",
      sourceType: "official_site",
      fetchedAt: "2026-07-19T00:00:00.000Z",
      sourceHash: "source-hash-1",
      name: "Example Dermatology",
      officialSiteUrl: "https://clinic.example.com",
      bookingUrl: null,
      specialties: [],
      symptomTags: ["acne"],
      isActive: true,
      partnershipType: "none",
      partnershipDisclosure: null,
    },
  ]),
  "utf8"
);
writeFileSync(existingFile, "[]", "utf8");

execFileSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "scripts/build-clinic-staging-sync-plan.ts",
    snapshotsFile,
    existingFile,
    outputFile,
  ],
  { stdio: "pipe" }
);

const artifact = JSON.parse(readFileSync(outputFile, "utf8")) as {
  mode: string;
  publishAllowed: boolean;
  productionTouched: boolean;
  audit: { valid: boolean; issueCount: number };
  reviewSummary: Record<string, number>;
  reviewQueue: Array<{
    priority: string;
    recommendedReviewAction: string;
    publishAllowed: boolean;
  }>;
};

assert.equal(artifact.mode, "dry_run");
assert.equal(artifact.publishAllowed, false);
assert.equal(artifact.productionTouched, false);
assert.equal(artifact.audit.valid, true);
assert.equal(artifact.audit.issueCount, 0);
assert.equal(artifact.reviewQueue.length, 1);
assert.equal(artifact.reviewQueue[0].priority, "medium");
assert.equal(
  artifact.reviewQueue[0].recommendedReviewAction,
  "complete_symptom_and_specialty_tags"
);
assert.equal(artifact.reviewQueue[0].publishAllowed, false);
assert.equal(artifact.reviewSummary.medium, 1);

console.log("clinic staging plan artifact self-test passed");