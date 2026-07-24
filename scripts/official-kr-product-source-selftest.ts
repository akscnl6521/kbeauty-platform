/**
 * P3-T01 Official Korean product source onboarding self-test.
 * Fixture / dry-run only — no Production writes, no publish, no CAPTCHA bypass.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CANONICAL_SOURCE_MANIFEST,
  OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID,
  OFFER_REFRESH_MAX_AGE_DAYS,
  PRODUCT_STALE_MAX_AGE_DAYS,
  REVIEW_REASON_CATALOG,
  applyStalePolicy,
  assertSourceManifestIntegrity,
  createEmptyCheckpoint,
  createFixturePageFetcher,
  createOfficialKrProductFixtures,
  dedupeCandidates,
  deterministicDedupeKey,
  evaluatePolicyFilters,
  evaluateStaleRefresh,
  isBlockedAccessMode,
  mapRawToCandidate,
  pickPreferredSourceKind,
  resolveResumeIndex,
  runFixtureOfficialKrProductIngestion,
  runOfficialKrProductIngestion,
} from "../src/lib/onboarding/officialKoreanProductSource";

async function main() {
  assert.equal(OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID, "P3-T01");
  assert.equal(OFFER_REFRESH_MAX_AGE_DAYS, 30);
  assert.equal(PRODUCT_STALE_MAX_AGE_DAYS, 180);
  assert.ok(CANONICAL_SOURCE_MANIFEST.length >= 8);
  assert.ok(REVIEW_REASON_CATALOG.length >= 15);
  assert.deepEqual(assertSourceManifestIntegrity(), []);

  // Official priority
  assert.equal(
    pickPreferredSourceKind([
      "marketplace_listing",
      "brand_official_page",
      "fixture_offline",
    ]),
    "brand_official_page",
  );
  assert.equal(isBlockedAccessMode("blocked_captcha"), true);
  assert.equal(isBlockedAccessMode("public_https"), false);

  // Policy filters
  const fixtures = createOfficialKrProductFixtures();
  const marketplace = fixtures.find((f) => f.sourceKind === "marketplace_listing");
  assert.ok(marketplace);
  const mktFilter = evaluatePolicyFilters(marketplace);
  assert.equal(mktFilter.pass, false);
  assert.ok(mktFilter.reasons.includes("marketplace_only_forbidden"));

  const paid = fixtures.find((f) => f.accessMode === "blocked_paid_api");
  assert.ok(paid);
  const paidFilter = evaluatePolicyFilters(paid);
  assert.equal(paidFilter.status, "blocked_policy");
  assert.ok(paidFilter.reasons.includes("paid_api_forbidden"));

  const invented = fixtures.find(
    (f) => f.forceBlockReason === "price_or_stock_invented",
  );
  assert.ok(invented);
  const inventedFilter = evaluatePolicyFilters(invented);
  assert.equal(inventedFilter.pass, false);
  assert.ok(inventedFilter.reasons.includes("price_or_stock_invented"));

  // Unknown fields stay unknown
  const partial = fixtures.find((f) => f.productNameKo === "부분확인 앰플");
  assert.ok(partial);
  const partialCandidate = mapRawToCandidate(
    partial,
    "2026-07-24T05:00:00.000Z",
  );
  assert.equal(partialCandidate.fields.productNameEn, null);
  assert.equal(partialCandidate.fields.volumeLabel, null);
  assert.equal(partialCandidate.fields.category, null);
  assert.equal(partialCandidate.offers.length, 0);
  assert.ok(
    partialCandidate.provenance.some(
      (p) => p.fieldKey === "productNameEn" && p.status === "unknown",
    ),
  );
  assert.equal(partialCandidate.publishAllowed, false);
  assert.equal(partialCandidate.publicVisible, false);

  // Full fixture run
  const now = new Date("2026-07-24T05:00:00.000Z");
  const full = await runFixtureOfficialKrProductIngestion({ now });
  assert.equal(full.taskId, "P3-T01");
  assert.equal(full.mode, "fixture");
  assert.equal(full.publishAllowed, false);
  assert.equal(full.publicVisible, false);
  assert.equal(full.databaseTouched, false);
  assert.equal(full.writeAttempted, false);
  assert.equal(full.productionTouched, false);
  assert.equal(full.audit.publishAllowed, false);
  assert.equal(full.audit.paidApiUsed, false);
  assert.equal(full.audit.captchaBypassAttempted, false);
  assert.equal(full.audit.authenticatedScrapeAttempted, false);
  assert.ok(
    full.checkpoint.status === "completed" ||
      full.checkpoint.status === "paused",
  );
  assert.ok(full.totals.rawItems >= 10);
  assert.ok(full.totals.duplicates >= 1, "intentional duplicate expected");
  assert.ok(full.totals.blockedPolicy >= 1, "paid/captcha blocks expected");
  assert.ok(full.totals.filteredOut >= 1, "marketplace/invented filtered");
  assert.ok(full.totals.candidateReady >= 1, "official complete ready");
  assert.ok(full.totals.withIngredients >= 1);
  assert.ok(full.totals.withImages >= 1);
  assert.ok(full.totals.withVariants >= 1);
  assert.ok(full.totals.withOffers >= 1);
  assert.ok(full.totals.withUsageGuidance >= 1);
  assert.ok(full.totals.unknownFieldsPreserved >= 1);
  assert.ok(full.totals.stale >= 1, "stale product expected");
  assert.ok(full.totals.needsRefresh >= 1, "refresh-due product expected");

  // Fixture never public
  const fixtureCandidate = full.candidates.find((c) => c.isFixture);
  assert.ok(fixtureCandidate);
  assert.equal(fixtureCandidate.publicVisible, false);
  assert.equal(fixtureCandidate.publishAllowed, false);
  assert.ok(
    fixtureCandidate.reviewReasons.includes("fixture_cannot_publish"),
  );

  // No candidate may be public
  assert.ok(full.candidates.every((c) => c.publicVisible === false));
  assert.ok(full.candidates.every((c) => c.publishAllowed === false));

  // Dedupe deterministic
  const keyA = deterministicDedupeKey(
    mapRawToCandidate(fixtures[0], now.toISOString()),
  );
  const keyB = deterministicDedupeKey(
    mapRawToCandidate(fixtures[1], now.toISOString()),
  );
  assert.equal(keyA, keyB);
  const deduped = dedupeCandidates([
    mapRawToCandidate(fixtures[0], now.toISOString()),
    mapRawToCandidate(fixtures[1], now.toISOString()),
  ]);
  assert.equal(deduped.unique.length, 1);
  assert.equal(deduped.duplicates.length, 1);

  // Stale policy unit
  const staleRaw = fixtures.find((f) => f.productNameKo === "만료 세럼");
  assert.ok(staleRaw);
  const staleCand = mapRawToCandidate(staleRaw, now.toISOString());
  const staleDecision = evaluateStaleRefresh(staleCand, now);
  assert.ok(
    staleDecision.action === "block_publish" ||
      staleDecision.action === "mark_stale",
  );
  const { candidates: afterStale } = applyStalePolicy([staleCand], now);
  assert.equal(afterStale[0].status, "stale");

  // Resumable checkpoint
  const cp = createEmptyCheckpoint({
    runId: "test-run",
    mode: "fixture",
    nowIso: now.toISOString(),
  });
  assert.equal(resolveResumeIndex(cp), 0);
  const slice1 = await runOfficialKrProductIngestion({
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
    maxSlices: 1,
    sliceSize: 3,
    now,
    runId: "resume-test",
  });
  assert.ok(
    slice1.checkpoint.status === "paused" ||
      slice1.checkpoint.status === "completed",
  );
  if (slice1.checkpoint.status === "paused") {
    const resumed = await runOfficialKrProductIngestion({
      mode: "fixture",
      fetcher: createFixturePageFetcher(),
      checkpoint: slice1.checkpoint,
      priorCandidates: slice1.candidates,
      maxSlices: 10,
      sliceSize: 3,
      now,
    });
    assert.equal(resumed.checkpoint.runId, "resume-test");
    assert.ok(
      resumed.checkpoint.status === "completed" ||
        resumed.checkpoint.status === "paused",
    );
    assert.ok(resumed.totals.rawItems >= slice1.totals.rawItems);
  }

  // Contract files exist
  const required = [
    "src/lib/onboarding/officialKoreanProductSource/types.ts",
    "src/lib/onboarding/officialKoreanProductSource/pipeline.ts",
    "src/lib/onboarding/officialKoreanProductSource/index.ts",
    "docs/prelaunch/P3-T01_OFFICIAL_KR_PRODUCT_SOURCE.md",
    "scripts/official-kr-product-source-selftest.ts",
  ];
  for (const rel of required) {
    assert.ok(
      existsSync(path.join(process.cwd(), rel)),
      `missing:${rel}`,
    );
  }

  // Write dry-run artifact for operator visibility
  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "official-kr-product-source",
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
        writeAttempted: false,
      },
      null,
      2,
    ),
  );
  console.log("official-kr-product-source selftest: OK");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
