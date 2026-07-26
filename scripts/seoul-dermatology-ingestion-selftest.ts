/**
 * T07-02 Seoul dermatology ingestion self-test.
 * Fixture / dry-run only — no Production writes, no publish.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CANDIDATE_STALE_MAX_AGE_DAYS,
  HIRA_DERMATOLOGY_DEPT_CODES,
  HIRA_HOSP_LIST_SAFE_URL,
  SEOUL_DERMATOLOGY_INGESTION_TASK_ID,
  SEOUL_SIDO_CD,
  applyStalePolicy,
  createEmptyCheckpoint,
  createFixturePageFetcher,
  dedupeCandidates,
  deterministicDedupeKey,
  evaluateCandidateFilters,
  isDermatologyOfficialFields,
  isSeoulOfficialFields,
  resolveResumePageNo,
  runFixtureSeoulDermatologyIngestion,
  runSeoulDermatologyIngestion,
} from "../src/lib/publicData/seoulDermatologyIngestion";
import type { SeoulDermatologyCandidate } from "../src/lib/publicData/seoulDermatologyIngestion";

async function main() {
  assert.equal(SEOUL_DERMATOLOGY_INGESTION_TASK_ID, "T07-02");
  assert.equal(SEOUL_SIDO_CD, "110000");
  assert.ok(HIRA_DERMATOLOGY_DEPT_CODES.includes("14"));
  assert.ok(!HIRA_HOSP_LIST_SAFE_URL.includes("serviceKey"));
  assert.ok(!HIRA_HOSP_LIST_SAFE_URL.includes("?"));

  // --- Official field filters ---
  assert.equal(
    isSeoulOfficialFields({ sidoCd: "110000", sidoCdNm: "서울" }).pass,
    true,
  );
  assert.equal(
    isSeoulOfficialFields({
      sidoCd: "210000",
      sidoCdNm: "부산",
      addr: "부산광역시",
    }).pass,
    false,
  );
  assert.equal(
    isSeoulOfficialFields({
      addr: "서울특별시 강남구",
    }).pass,
    false,
    "address alone must not pass Seoul filter",
  );

  assert.equal(
    isDermatologyOfficialFields({
      departmentItems: [{ dgsbjtCd: "14", dgsbjtCdNm: "피부과" }],
    }).pass,
    true,
  );
  assert.equal(
    isDermatologyOfficialFields({
      listItem: { yadmNm: "강남 피부과 클리닉" },
      departmentItems: [{ dgsbjtCd: "01", dgsbjtCdNm: "내과" }],
    }).pass,
    false,
    "marketing name alone must not pass",
  );
  const keywordReject = evaluateCandidateFilters({
    listItem: {
      ykiho: "X",
      yadmNm: "마케팅용 피부과",
      sidoCd: "110000",
      sidoCdNm: "서울",
    },
    departmentItems: [{ dgsbjtCd: "01", dgsbjtCdNm: "내과" }],
  });
  assert.equal(keywordReject.pass, false);
  assert.ok(
    keywordReject.reasons.includes(
      "dermatology_name_keyword_without_official_dept",
    ),
  );

  // --- Full fixture run with list dept filter ---
  const full = await runFixtureSeoulDermatologyIngestion({
    numOfRows: 10,
    now: new Date("2026-07-24T04:00:00.000Z"),
  });
  assert.equal(full.taskId, "T07-02");
  assert.equal(full.mode, "fixture");
  assert.equal(full.publishAllowed, false);
  assert.equal(full.databaseTouched, false);
  assert.equal(full.writeAttempted, false);
  assert.equal(full.productionTouched, false);
  assert.equal(full.audit.publishAllowed, false);
  assert.ok(full.checkpoint.status === "completed" || full.checkpoint.status === "paused");
  assert.ok(full.totals.uniqueCandidates >= 2, "at least 2 unique Seoul derm");
  assert.ok(full.totals.duplicates >= 1, "fixture includes intentional duplicate");
  assert.ok(full.totals.candidateReady >= 2);

  for (const c of full.candidates.filter((x) => x.status === "candidate_ready")) {
    assert.equal(c.publishAllowed, false);
    assert.ok(c.fields.institutionId);
    assert.ok(c.fields.name);
    assert.ok(c.provenance.length >= 8, "field-level provenance");
    assert.ok(
      c.provenance.every((p) => !/serviceKey|ServiceKey/i.test(p.sourceUrl)),
      "provenance URL must not embed API key",
    );
    assert.equal(c.fields.sidoCode, SEOUL_SIDO_CD);
    assert.ok(
      c.fields.departmentCode === "14" || c.fields.departmentName === "피부과",
    );
  }

  // --- Unfiltered list: exercise reject paths (ENT, marketing name, Busan excluded by sido) ---
  const open = await runSeoulDermatologyIngestion({
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
    dgsbjtCd: null,
    numOfRows: 20,
    now: new Date("2026-07-24T04:00:00.000Z"),
  });
  assert.ok(open.totals.filteredOut >= 2, "ENT + marketing-name rejects");
  const rejectedReasons = open.audit.filterRejectSample.flatMap((r) => r.reasons);
  assert.ok(
    rejectedReasons.some((r) => r.includes("not_dermatology") || r.includes("keyword")),
  );

  // --- Deterministic dedupe ---
  const a: SeoulDermatologyCandidate = {
    candidateId: "hira-seoul-derm-A",
    status: "discovered",
    fields: {
      institutionId: "SAME-ID",
      name: "A",
      address: null,
      longitude: null,
      latitude: null,
      phone: null,
      institutionTypeCode: null,
      institutionTypeName: null,
      sidoCode: SEOUL_SIDO_CD,
      sidoName: "서울",
      sgguCode: null,
      sgguName: null,
      departmentCode: "14",
      departmentName: "피부과",
      establishedDate: null,
      collectedAt: "2026-07-24T00:00:00.000Z",
      sourceVerifiedAt: "2026-07-24T00:00:00.000Z",
    },
    provenance: [],
    filterReasons: [],
    duplicateOf: null,
    publishAllowed: false,
    fixtureOnly: true,
  };
  const b = {
    ...a,
    candidateId: "hira-seoul-derm-B",
    fields: { ...a.fields, name: "B" },
  };
  assert.equal(deterministicDedupeKey(a), deterministicDedupeKey(b));
  const deduped = dedupeCandidates([a, b]);
  assert.equal(deduped.unique.length, 1);
  assert.equal(deduped.duplicates.length, 1);
  assert.equal(deduped.duplicates[0]!.duplicateOf, "hira-seoul-derm-A");

  // --- Stale policy ---
  const staleCand: SeoulDermatologyCandidate = {
    ...a,
    fields: {
      ...a.fields,
      sourceVerifiedAt: "2025-01-01T00:00:00.000Z",
    },
  };
  const stale = applyStalePolicy(
    [staleCand],
    new Date("2026-07-24T00:00:00.000Z"),
  );
  assert.equal(stale.candidates[0]!.status, "stale");
  assert.equal(stale.decisions[0]!.action, "block_publish");
  assert.ok(
    (stale.decisions[0]!.ageDays ?? 0) > CANDIDATE_STALE_MAX_AGE_DAYS,
  );

  // --- Pagination resume ---
  const page1 = await runSeoulDermatologyIngestion({
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
    dgsbjtCd: null,
    numOfRows: 2,
    maxPages: 1,
    now: new Date("2026-07-24T04:00:00.000Z"),
    runId: "t07-02-resume-test",
  });
  assert.equal(page1.checkpoint.status, "paused");
  assert.equal(page1.checkpoint.pagesCompleted.includes(1), true);
  assert.equal(resolveResumePageNo(page1.checkpoint), 2);

  const page2 = await runSeoulDermatologyIngestion({
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
    dgsbjtCd: null,
    numOfRows: 2,
    maxPages: 10,
    checkpoint: page1.checkpoint,
    priorCandidates: page1.candidates.filter((c) => c.status !== "filtered_out"),
    now: new Date("2026-07-24T04:05:00.000Z"),
  });
  assert.ok(
    page2.checkpoint.status === "completed" ||
      page2.checkpoint.pagesCompleted.length >= 2,
  );
  assert.ok(page2.checkpoint.pagesCompleted.includes(1));
  assert.equal(page2.checkpoint.runId, "t07-02-resume-test");

  const emptyCp = createEmptyCheckpoint({
    runId: "x",
    mode: "fixture",
    nowIso: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(emptyCp.nextPageNo, 1);
  assert.equal(emptyCp.taskId, "T07-02");

  // --- Audit artifact dry-run write (local artifacts only) ---
  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "seoul-dermatology-ingestion",
  );
  mkdirSync(outDir, { recursive: true });
  const auditPath = path.join(outDir, "selftest-audit.json");
  writeFileSync(auditPath, JSON.stringify(full.audit, null, 2), "utf8");
  const auditText = JSON.stringify(full.audit);
  assert.ok(!/serviceKey=/i.test(auditText));
  assert.ok(!auditText.includes("DATA_GO_KR_SERVICE_KEY"));

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: SEOUL_DERMATOLOGY_INGESTION_TASK_ID,
        uniqueCandidates: full.totals.uniqueCandidates,
        duplicates: full.totals.duplicates,
        filteredOutOpen: open.totals.filteredOut,
        resumePages: page2.checkpoint.pagesCompleted,
        auditPath: "artifacts/seoul-dermatology-ingestion/selftest-audit.json",
        publishAllowed: false,
        databaseTouched: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
