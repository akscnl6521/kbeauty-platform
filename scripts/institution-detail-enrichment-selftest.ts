/**
 * T07-03 Institution detail enrichment self-test.
 * Fixture / dry-run only — no Production writes, no publish.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DETAIL_CACHE_TTL_HOURS,
  HIRA_DEPT_INFO_SAFE_URL,
  HIRA_DERMATOLOGY_DEPT_CODES,
  INSTITUTION_DETAIL_ENRICHMENT_TASK_ID,
  MAX_ENRICHMENT_CONCURRENCY,
  SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO,
  buildDermatologistEvidence,
  computeEvidenceStrength,
  createDetailCache,
  createEmptyEnrichmentCheckpoint,
  createFixtureDetailFetcher,
  getFixtureEnrichmentCandidates,
  getFreshCacheEntry,
  isOfficialDermatologyDept,
  mapWithConcurrency,
  nameImpliesDermatologyButNotOfficial,
  parseOfficialSpecialistCount,
  putCacheEntry,
  resolvePendingIds,
  runFixtureInstitutionDetailEnrichment,
  runInstitutionDetailEnrichment,
} from "../src/lib/publicData/institutionDetailEnrichment";

async function main() {
  assert.equal(INSTITUTION_DETAIL_ENRICHMENT_TASK_ID, "T07-03");
  assert.ok(HIRA_DERMATOLOGY_DEPT_CODES.includes("14"));
  assert.ok(!HIRA_DEPT_INFO_SAFE_URL.includes("serviceKey"));
  assert.ok(!HIRA_DEPT_INFO_SAFE_URL.includes("?"));
  assert.ok(DETAIL_CACHE_TTL_HOURS > 0);
  assert.ok(MAX_ENRICHMENT_CONCURRENCY >= 3);
  assert.ok(SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO.includes("증상"));

  // --- Specialist count: unknown stays unknown ---
  assert.deepEqual(parseOfficialSpecialistCount(null), {
    count: null,
    known: false,
  });
  assert.deepEqual(parseOfficialSpecialistCount(""), {
    count: null,
    known: false,
  });
  assert.deepEqual(parseOfficialSpecialistCount("2"), {
    count: 2,
    known: true,
  });
  assert.deepEqual(parseOfficialSpecialistCount(0), {
    count: 0,
    known: true,
  });

  // --- Never infer dermatologist from name alone ---
  assert.equal(
    nameImpliesDermatologyButNotOfficial({
      name: "마케팅용 피부과 간판",
      departments: [
        { departmentCode: "01", departmentName: "내과", specialistCount: 1, specialistCountKnown: true },
      ],
    }),
    true,
  );
  assert.equal(
    isOfficialDermatologyDept({
      departmentCode: null,
      departmentName: "피부관리실",
    }),
    false,
    "non-exact name must not count as official derm",
  );
  assert.equal(
    isOfficialDermatologyDept({
      departmentCode: "14",
      departmentName: "피부과",
    }),
    true,
  );

  // --- Evidence strength + conflict ---
  const conflict = buildDermatologistEvidence({
    name: "출처충돌",
    departmentItems: [{ dgsbjtCd: "01", dgsbjtCdNm: "내과", dgsbjtPrSftCnt: "1" }],
    priorDepartmentCode: "14",
    priorDepartmentName: "피부과",
    verifiedAt: "2026-07-24T05:00:00.000Z",
  });
  assert.equal(conflict.evidence.conflictingSourceState, "conflict");
  assert.ok(
    conflict.manualReviewReasons.includes("conflicting_department_sources"),
  );
  assert.equal(
    computeEvidenceStrength({
      dermatologyDeptOfficial: true,
      dermatologySpecialistCount: 2,
      departments: [
        {
          departmentCode: "14",
          departmentName: "피부과",
          specialistCount: 2,
          specialistCountKnown: true,
        },
      ],
      conflictingSourceState: "none",
    }),
    "strong",
  );

  // --- Symptom expertise always separate / empty ---
  const strong = buildDermatologistEvidence({
    name: "공식 피부과",
    departmentItems: [
      { dgsbjtCd: "14", dgsbjtCdNm: "피부과", dgsbjtPrSftCnt: "2" },
    ],
    verifiedAt: "2026-07-24T05:00:00.000Z",
  });
  assert.equal(strong.evidence.dermatologyDeptOfficial, true);
  assert.equal(strong.evidence.dermatologySpecialistCount, 2);
  assert.equal(strong.evidence.evidenceStrength, "strong");

  // --- Bounded concurrency preserves order ---
  const started: number[] = [];
  const concResults = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
    started.push(n);
    await new Promise((r) => setTimeout(r, 5));
    return n * 10;
  });
  assert.deepEqual(concResults, [10, 20, 30, 40, 50]);
  assert.equal(started.length, 5);

  // --- Cache fresh hit ---
  const cache = createDetailCache();
  const now = new Date("2026-07-24T06:00:00.000Z");
  putCacheEntry(cache, {
    institutionId: "FIXTURE-YKIHO-SEOUL-DERM-001",
    fetchedAt: "2026-07-24T05:00:00.000Z",
    departmentItems: [
      { dgsbjtCd: "14", dgsbjtCdNm: "피부과", dgsbjtPrSftCnt: "2" },
    ],
    facilityItems: [],
    usedFixture: true,
    safeEndpoint: HIRA_DEPT_INFO_SAFE_URL,
  });
  assert.ok(
    getFreshCacheEntry(cache, "FIXTURE-YKIHO-SEOUL-DERM-001", now),
  );

  // --- Checkpoint resume ---
  const ids = ["A", "B", "C"];
  const cp = createEmptyEnrichmentCheckpoint({
    runId: "t07-03-test",
    mode: "fixture",
    nowIso: now.toISOString(),
    pendingInstitutionIds: ids,
  });
  cp.processedInstitutionIds = ["A"];
  assert.deepEqual(resolvePendingIds(ids, cp), ["B", "C"]);

  // --- Full fixture enrichment ---
  const full = await runFixtureInstitutionDetailEnrichment({
    concurrency: 3,
    now: new Date("2026-07-24T06:00:00.000Z"),
  });
  assert.equal(full.taskId, "T07-03");
  assert.equal(full.mode, "fixture");
  assert.equal(full.publishAllowed, false);
  assert.equal(full.databaseTouched, false);
  assert.equal(full.writeAttempted, false);
  assert.equal(full.productionTouched, false);
  assert.equal(full.audit.publishAllowed, false);
  assert.ok(full.totals.inputCandidates >= 6);
  assert.ok(full.totals.dermatologyOfficialTrue >= 2);
  assert.ok(full.totals.conflicts >= 1);
  assert.ok(full.totals.failedRetryable >= 1);
  assert.ok(full.totals.specialistCountUnknown >= 1);

  const marketing = full.candidates.find((c) =>
    c.institutionId.includes("FAKE-DERM-NAME"),
  );
  assert.ok(marketing);
  assert.equal(marketing!.dermatologistEvidence.dermatologyDeptOfficial, false);
  assert.ok(
    marketing!.manualReviewReasons.includes(
      "dermatology_name_without_official_dept",
    ),
  );
  assert.equal(marketing!.status, "needs_manual_review");

  const conflictRow = full.candidates.find((c) =>
    c.institutionId.includes("CONFLICT"),
  );
  assert.ok(conflictRow);
  assert.equal(
    conflictRow!.dermatologistEvidence.conflictingSourceState,
    "conflict",
  );

  const strongRow = full.candidates.find(
    (c) => c.institutionId === "FIXTURE-YKIHO-SEOUL-DERM-001",
  );
  assert.ok(strongRow);
  assert.equal(strongRow!.dermatologistEvidence.dermatologySpecialistCount, 2);
  assert.equal(strongRow!.dermatologistEvidence.evidenceStrength, "strong");
  assert.equal(
    strongRow!.symptomExpertise.claimedFromInstitutionDetail,
    false,
  );
  assert.deepEqual(strongRow!.symptomExpertise.claims, []);

  const noCount = full.candidates.find((c) =>
    c.institutionId.includes("NOCOUNT"),
  );
  assert.ok(noCount);
  assert.equal(noCount!.dermatologistEvidence.dermatologyDeptOfficial, true);
  assert.equal(noCount!.dermatologistEvidence.dermatologySpecialistCount, null);
  assert.ok(
    noCount!.manualReviewReasons.includes("specialist_count_absent"),
  );

  // --- Resume with maxInstitutions + cache ---
  const first = await runInstitutionDetailEnrichment({
    mode: "fixture",
    fetcher: createFixtureDetailFetcher(),
    candidates: getFixtureEnrichmentCandidates().slice(0, 3),
    concurrency: 2,
    maxInstitutions: 1,
    now: new Date("2026-07-24T07:00:00.000Z"),
  });
  assert.equal(first.checkpoint.status, "paused");
  assert.equal(first.candidates.length, 1);

  const second = await runInstitutionDetailEnrichment({
    mode: "fixture",
    fetcher: createFixtureDetailFetcher(),
    candidates: getFixtureEnrichmentCandidates().slice(0, 3),
    checkpoint: first.checkpoint,
    cacheSeed: first.cacheSnapshot,
    concurrency: 2,
    now: new Date("2026-07-24T07:01:00.000Z"),
  });
  assert.equal(second.checkpoint.status, "completed");
  assert.ok(second.candidates.length >= 2);

  // Artifact for operators (gitignore)
  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "institution-detail-enrichment",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-audit-latest.json"),
    JSON.stringify(full.audit, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: full.taskId,
        totals: full.totals,
        checkpointStatus: full.checkpoint.status,
        publishAllowed: false,
        databaseTouched: false,
        writeAttempted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
