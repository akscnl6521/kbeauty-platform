/**
 * P3-T02 Verified product pool + category expansion self-test.
 * Fixture / dry-run only — no Production writes, no public publish.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  APPROVED_OFFICIAL_MANIFEST,
  PUBLIC_TOP5_LIMIT,
  REJECTION_REASON_CATALOG,
  VERIFIED_POOL_CATEGORIES,
  VERIFIED_PRODUCT_POOL_TASK_ID,
  asLiveGateProbe,
  assertMissingPillarBlocksTop5,
  createVerifiedPoolFixtures,
  deterministicPoolDedupeKey,
  evaluatePublicTop5Eligibility,
  evaluateVerifiedPoolGates,
  mapRawToPoolCandidate,
  mergeDuplicateCandidates,
  resolvePoolCategory,
  runFixtureVerifiedPoolExpansion,
  runVerifiedPoolExpansion,
  selectPublicTop5,
} from "../src/lib/catalog/verifiedProductPool";

async function main() {
  assert.equal(VERIFIED_PRODUCT_POOL_TASK_ID, "P3-T02");
  assert.equal(PUBLIC_TOP5_LIMIT, 5);
  assert.deepEqual(
    [...VERIFIED_POOL_CATEGORIES],
    ["skincare", "makeup", "hair_scalp", "body", "lip_eye"],
  );
  assert.ok(REJECTION_REASON_CATALOG.length >= 12);
  assert.ok(APPROVED_OFFICIAL_MANIFEST.some((m) => m.approved));
  assert.ok(APPROVED_OFFICIAL_MANIFEST.some((m) => !m.approved));

  // Category normalization
  assert.equal(resolvePoolCategory("serum"), "skincare");
  assert.equal(resolvePoolCategory("cushion"), "makeup");
  assert.equal(resolvePoolCategory("shampoo"), "hair_scalp");
  assert.equal(resolvePoolCategory("body_lotion"), "body");
  assert.equal(resolvePoolCategory("mascara"), "lip_eye");
  assert.equal(resolvePoolCategory("lip_tint"), "lip_eye");
  assert.equal(resolvePoolCategory("nail_polish"), null);

  const fixtures = createVerifiedPoolFixtures();
  assert.ok(fixtures.length >= 12);

  // Full fixture expansion
  const now = new Date("2026-07-24T11:00:00.000Z");
  const full = runFixtureVerifiedPoolExpansion({ now });
  assert.equal(full.taskId, "P3-T02");
  assert.equal(full.mode, "fixture");
  assert.equal(full.publishAllowed, false);
  assert.equal(full.publicVisible, false);
  assert.equal(full.databaseTouched, false);
  assert.equal(full.writeAttempted, false);
  assert.equal(full.productionTouched, false);
  assert.equal(full.audit.ok, true);
  assert.equal(full.audit.publishAllowed, false);
  assert.equal(full.audit.paidApiUsed, false);
  assert.equal(full.publicTop5.length, 0, "fixture mode never yields public Top 5");

  // All five categories represented among non-rejected unique candidates
  const cats = new Set(
    full.candidates
      .filter(
        (c) =>
          c.status !== "rejected" &&
          c.status !== "duplicate_merged" &&
          resolvePoolCategory(
            c.normalized.rawCategoryHint ?? c.poolCategory,
          ) != null,
      )
      .map((c) => c.poolCategory),
  );
  for (const cat of VERIFIED_POOL_CATEGORIES) {
    assert.ok(cats.has(cat), `expected category ${cat} in pool`);
  }

  // Duplicate merge
  const serum = full.candidates.find((c) => c.candidateId === "vp-skincare-serum");
  const serumDup = full.candidates.find(
    (c) => c.candidateId === "vp-skincare-serum-dup",
  );
  assert.ok(serum);
  assert.ok(serumDup);
  assert.equal(
    deterministicPoolDedupeKey(serum),
    deterministicPoolDedupeKey({
      ...serumDup,
      // same identity key
      brandName: serum.brandName,
      productNameKo: serum.productNameKo,
      volumeLabel: serum.volumeLabel,
      poolCategory: serum.poolCategory,
    }),
  );
  assert.ok(
    serumDup.status === "duplicate_merged" ||
      serum.status === "duplicate_merged" ||
      serum.mergedFromIds.includes("vp-skincare-serum-dup") ||
      (serumDup.duplicateOf != null),
  );
  assert.ok(full.totals.duplicatesMerged >= 1);

  // Structural recommendation-ready fixtures exist but stay non-public
  const structurallyReady = full.candidates.filter(
    (c) => c.gate.recommendationReady,
  );
  assert.ok(
    structurallyReady.length >= 5,
    "expected structural recommendation-ready across categories",
  );
  for (const c of structurallyReady) {
    assert.equal(c.publicTop5Allowed, false);
    assert.equal(c.publishAllowed, false);
    assert.equal(c.publicVisible, false);
  }

  // Missing pillar fixtures → needs_review / not recommendation ready
  for (const id of [
    "vp-missing-source",
    "vp-missing-inci",
    "vp-missing-image",
    "vp-missing-offer",
  ]) {
    const c = full.candidates.find((x) => x.candidateId === id);
    assert.ok(c, id);
    assert.equal(c.gate.recommendationReady, false);
    assert.equal(c.publicTop5Allowed, false);
    const decision = evaluatePublicTop5Eligibility(c);
    assert.equal(decision.allowed, false);
  }

  assert.ok(
    full.candidates.some(
      (c) =>
        c.candidateId === "vp-missing-source" &&
        c.rejectionReasons.includes("source_not_verified"),
    ),
  );
  assert.ok(
    full.candidates.some(
      (c) =>
        c.candidateId === "vp-missing-inci" &&
        c.rejectionReasons.includes("ingredients_not_verified"),
    ),
  );
  assert.ok(
    full.candidates.some(
      (c) =>
        c.candidateId === "vp-missing-image" &&
        c.rejectionReasons.includes("image_rights_not_verified"),
    ),
  );
  assert.ok(
    full.candidates.some(
      (c) =>
        c.candidateId === "vp-missing-offer" &&
        c.rejectionReasons.includes("purchase_offer_missing"),
    ),
  );

  // Safety + marketplace + unsupported
  const safety = full.candidates.find((c) => c.candidateId === "vp-safety-hold");
  assert.ok(safety);
  assert.equal(safety.status, "safety_hold");
  assert.ok(safety.rejectionReasons.includes("safety_ineligible"));

  const mkt = full.candidates.find((c) => c.candidateId === "vp-marketplace");
  assert.ok(mkt);
  assert.equal(mkt.status, "rejected");

  const nail = full.candidates.find(
    (c) => c.candidateId === "vp-unsupported-nail",
  );
  assert.ok(nail);
  assert.equal(nail.status, "rejected");
  assert.ok(nail.rejectionReasons.includes("category_unsupported"));

  // Prove: each missing pillar blocks public Top 5 (live-shaped probes)
  const completeRaw = fixtures.find((f) => f.recordId === "vp-skincare-serum");
  assert.ok(completeRaw);
  const liveComplete = mapRawToPoolCandidate(
    asLiveGateProbe(completeRaw),
    APPROVED_OFFICIAL_MANIFEST,
  );
  assert.equal(liveComplete.gate.recommendationReady, true);
  assert.equal(liveComplete.publicTop5Allowed, true);
  assert.equal(evaluatePublicTop5Eligibility(liveComplete).allowed, true);

  const pillarCases: Array<{
    id: string;
    missing: "source" | "ingredients" | "image_rights" | "purchase_offer";
  }> = [
    { id: "vp-missing-source", missing: "source" },
    { id: "vp-missing-inci", missing: "ingredients" },
    { id: "vp-missing-image", missing: "image_rights" },
    { id: "vp-missing-offer", missing: "purchase_offer" },
  ];
  for (const { id, missing } of pillarCases) {
    const raw = fixtures.find((f) => f.recordId === id);
    assert.ok(raw, id);
    const probe = mapRawToPoolCandidate(
      asLiveGateProbe(raw),
      APPROVED_OFFICIAL_MANIFEST,
    );
    assert.equal(probe.publicTop5Allowed, false);
    assert.equal(evaluatePublicTop5Eligibility(probe).allowed, false);
    assert.equal(
      assertMissingPillarBlocksTop5(probe, missing),
      true,
      `${id} must block Top 5 for ${missing}`,
    );
  }

  // Top 5 selector: only complete live probes enter; incompletes blocked
  const liveProbes = [
    liveComplete,
    ...pillarCases.map((p) => {
      const raw = fixtures.find((f) => f.recordId === p.id)!;
      return mapRawToPoolCandidate(
        asLiveGateProbe(raw),
        APPROVED_OFFICIAL_MANIFEST,
      );
    }),
  ];
  const top5 = selectPublicTop5(liveProbes);
  assert.equal(top5.selected.length, 1);
  assert.equal(top5.selected[0].candidateId, liveComplete.candidateId);
  assert.ok(top5.blocked.length >= 4);

  // Multi-category live probes → Top 5 capped at 5
  const categoryIds = [
    "vp-skincare-serum",
    "vp-makeup-cushion",
    "vp-hair-shampoo",
    "vp-body-lotion",
    "vp-lip-tint",
    "vp-eye-mascara",
  ];
  const liveMulti = categoryIds.map((id) => {
    const raw = fixtures.find((f) => f.recordId === id)!;
    return mapRawToPoolCandidate(asLiveGateProbe(raw), APPROVED_OFFICIAL_MANIFEST);
  });
  const multiTop5 = selectPublicTop5(liveMulti);
  assert.equal(multiTop5.selected.length, PUBLIC_TOP5_LIMIT);
  assert.ok(liveMulti.length > PUBLIC_TOP5_LIMIT);

  // Dedupe merge unit
  const a = mapRawToPoolCandidate(completeRaw, APPROVED_OFFICIAL_MANIFEST);
  const bRaw = fixtures.find((f) => f.recordId === "vp-skincare-serum-dup")!;
  const b = mapRawToPoolCandidate(bRaw, APPROVED_OFFICIAL_MANIFEST);
  const merged = mergeDuplicateCandidates([a, b]);
  assert.equal(merged.unique.length, 1);
  assert.equal(merged.mergedAway.length, 1);
  assert.equal(merged.mergedAway[0].status, "duplicate_merged");

  // Gate on unapproved manifest
  const unapproved = evaluateVerifiedPoolGates({
    raw: completeRaw,
    manifest: null,
  });
  assert.ok(
    unapproved.rejectionCodes.includes("official_manifest_not_approved"),
  );
  assert.equal(unapproved.publicTop5Allowed, false);

  // dry_run mode also empty public Top 5
  const dry = runVerifiedPoolExpansion({
    mode: "dry_run",
    records: fixtures,
    now,
  });
  assert.equal(dry.publicTop5.length, 0);
  assert.equal(dry.audit.publicVisible, false);

  // live_blocked stays empty
  const blocked = runVerifiedPoolExpansion({ mode: "live_blocked", now });
  assert.equal(blocked.candidates.length, 0);
  assert.equal(blocked.publicTop5.length, 0);

  // Audit counts machine-readable
  assert.ok(full.totals.rawSeen >= 12);
  assert.ok(full.totals.missingSource >= 1);
  assert.ok(full.totals.missingIngredients >= 1);
  assert.ok(full.totals.missingImageRights >= 1);
  assert.ok(full.totals.missingPurchaseOffer >= 1);
  assert.ok(full.totals.publicTop5Blocked >= 1);
  assert.equal(full.totals.publicTop5Eligible, 0);
  assert.ok(Object.keys(full.audit.rejectionReasonCounts).length >= 4);
  for (const cat of VERIFIED_POOL_CATEGORIES) {
    assert.ok(
      (full.audit.categoryCounts[cat] ?? 0) >= 1,
      `audit categoryCounts.${cat}`,
    );
  }

  // Docs + scripts present
  for (const rel of [
    "docs/prelaunch/P3-T02_VERIFIED_PRODUCT_POOL.md",
    "scripts/verified-product-pool-selftest.ts",
    "scripts/run-verified-product-pool.ts",
    "src/lib/catalog/verifiedProductPool/index.ts",
  ]) {
    assert.ok(
      existsSync(path.join(process.cwd(), rel)),
      `missing ${rel}`,
    );
  }

  // Write local audit sample (gitignore artifacts/)
  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "verified-product-pool",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-audit.json"),
    JSON.stringify(full.audit, null, 2),
    "utf8",
  );

  console.log("verified-product-pool selftest: OK");
  console.log(
    JSON.stringify(
      {
        taskId: full.taskId,
        totals: full.totals,
        publicTop5: full.publicTop5.length,
        recommendationReadyStructural: structurallyReady.length,
        categories: [...cats],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
