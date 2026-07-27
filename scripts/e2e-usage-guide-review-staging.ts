/**
 * Staging E2E for the usage-guide review screen.
 *
 * Drives the real server code the admin screen calls — getUsageGuideQueue,
 * getUsageGuideItem, submitUsageGuideReview — against the live Staging rows, so
 * what is verified is what a reviewer's click actually runs.
 *
 * Data safety:
 *   - refusal paths are exercised on a fixture row (is_fixture = true), which the
 *     queue filters out, so a reviewer never sees it
 *   - the one success path runs on a real row and is reverted to needs_review at
 *     the end; the audit rows it leaves behind are intentional — they record that
 *     the action happened
 *   - nothing is deleted
 *
 *   npm run e2e:usage-guide-review-staging
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  getUsageGuideItem,
  getUsageGuideQueue,
  submitUsageGuideReview,
} from "@/lib/admin/usageGuideReview";
import type { AdminSession } from "@/lib/auth/admin";

const root = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const FIXTURE_SOURCE = "https://e2e.invalid/usage-guide-review-fixture";

function loadEnvFile(name: string): Record<string, string> {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ok   ${label}`);
}

async function expectRefused(
  label: string,
  run: () => Promise<unknown>,
  expectedCode?: string
) {
  try {
    await run();
    throw new Error(`EXPECTED REFUSAL: ${label}`);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err?.message?.startsWith("EXPECTED REFUSAL")) throw error;
    if (expectedCode && err.code !== expectedCode) {
      throw new Error(
        `${label}: expected ${expectedCode}, got ${err.code} (${err.message})`
      );
    }
    ok(`${label} → refused (${err.code})`);
  }
}

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) throw new Error("Staging credentials missing");
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
  if (ref === PROD_REF) throw new Error("refusing to run against Production");
  // The server-only module reads env through the process, not this object.
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  console.log(`[e2e:usage-guide-review] target ${ref.slice(0, 4)}***${ref.slice(-3)}`);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // a real reviewer identity, so verified_by points at a genuine admin row
  const { data: admins } = await admin
    .from("admin_users")
    .select("user_id, role")
    .eq("active", true)
    .in("role", ["admin", "reviewer"])
    .limit(1);
  const reviewer = admins?.[0];
  if (!reviewer) throw new Error("no active admin/reviewer to act as");
  const session: AdminSession = {
    userId: String(reviewer.user_id),
    role: reviewer.role as AdminSession["role"],
    active: true,
  };
  ok(`acting as an active ${reviewer.role}`);

  // --- 1. the queue the screen renders --------------------------------------
  console.log("");
  console.log("[e2e:usage-guide-review] 1. queue");
  const queue = await getUsageGuideQueue({});
  assert.equal(queue.schemaReady, true, "schema is ready");
  if (!queue.schemaReady) return;
  // The corpus grows as extraction improves, so pin the invariant, not the count.
  const expectedTotal = queue.total;
  assert.ok(expectedTotal > 0, `queue is not empty (got ${expectedTotal})`);
  ok(`queue reports ${expectedTotal} guides`);
  assert.equal(
    queue.counts.needs_review,
    expectedTotal,
    `every guide is needs_review (got ${JSON.stringify(queue.counts)})`
  );
  ok(`all ${expectedTotal} are needs_review`);

  const withNames = queue.items.filter((item) => item.guide.productName);
  assert.equal(
    withNames.length,
    queue.items.length,
    "every row resolves a product name"
  );
  ok(`all ${queue.items.length} rows on page 1 resolve a product name`);
  assert.ok(
    !queue.items.some((item) => item.guide.productName?.includes("�")),
    "no mojibake product name in the queue"
  );
  ok("no mojibake product names");
  assert.ok(
    queue.items.every((item) => item.guide.sourceUrl?.startsWith("https://")),
    "every row shows an https source"
  );
  ok("every row shows an https source");
  assert.ok(
    queue.items.every((item) => item.guide.methodSteps.length > 0),
    "every row carries at least one usage step"
  );
  ok("every row carries usage steps");

  // --- 2. the detail view a reviewer opens ----------------------------------
  console.log("");
  console.log("[e2e:usage-guide-review] 2. detail");
  const first = queue.items[0];
  const detail = await getUsageGuideItem(first.guide.id);
  assert.ok(detail && !("schemaReady" in detail), "detail loads");
  if (!detail || "schemaReady" in detail) return;
  assert.equal(detail.guide.id, first.guide.id, "same row");
  assert.ok(detail.guide.sourceExcerpt, "source excerpt is stored for comparison");
  ok("detail shows the source excerpt the values came from");
  assert.deepEqual(
    detail.unmatchedFields,
    [],
    `extracted values are all present in the excerpt (${detail.unmatchedFields.join("; ")})`
  );
  ok("every extracted value is found in the source excerpt");
  assert.equal(detail.approvable, true, "a clean automated extraction is approvable");
  ok("clean row reports approvable");
  assert.ok(
    detail.guide.statutoryNotices.length >= 0 &&
      detail.guide.cautionText.every(
        (caution) => !detail.guide.statutoryNotices.includes(caution)
      ),
    "statutory notices are not duplicated into product cautions"
  );
  ok("statutory and product-specific cautions stay separated");

  // --- 3. the evidence guard, on a fixture ----------------------------------
  console.log("");
  console.log("[e2e:usage-guide-review] 3. approval guard");
  const { data: anyProduct } = await admin
    .from("products")
    .select("id")
    .limit(1)
    .single();

  const { data: existingFixture } = await admin
    .from("product_usage_guides")
    .select("id")
    .eq("source_url", FIXTURE_SOURCE)
    .maybeSingle();

  let fixtureId = existingFixture?.id as string | undefined;
  if (!fixtureId) {
    const { data: inserted, error: fixtureError } = await admin
      .from("product_usage_guides")
      .insert({
        product_id: anyProduct.id,
        locale: "ko",
        source_type: "internal_review",
        source_url: FIXTURE_SOURCE,
        // manual_entry so the DB does not demand a source for a draft row
        extraction_method: "manual_entry",
        method_steps: [],
        verification_status: "needs_review",
        is_fixture: true,
      })
      .select("id")
      .single();
    if (fixtureError) throw new Error(`fixture insert: ${fixtureError.message}`);
    fixtureId = inserted.id as string;
  }
  ok("fixture row prepared (is_fixture = true)");

  const queueAfterFixture = await getUsageGuideQueue({});
  assert.equal(
    queueAfterFixture.schemaReady && queueAfterFixture.total,
    expectedTotal,
    "the fixture does not appear in the reviewer's queue"
  );
  ok("fixture is excluded from the reviewer's queue");

  await expectRefused(
    "approving a guide with no usage steps",
    () => submitUsageGuideReview(session, fixtureId!, { decision: "approved" }),
    "PRECONDITION_FAILED"
  );

  await expectRefused(
    "rejecting without a reason",
    () => submitUsageGuideReview(session, fixtureId!, { decision: "rejected" }),
    "INVALID_INPUT"
  );

  await expectRefused(
    "an unknown decision value",
    () => submitUsageGuideReview(session, fixtureId!, { decision: "publish" }),
    "INVALID_INPUT"
  );

  await expectRefused(
    "a malformed id",
    () => submitUsageGuideReview(session, "not-a-uuid", { decision: "needs_review" }),
    "INVALID_INPUT"
  );

  const rejected = await submitUsageGuideReview(session, fixtureId!, {
    decision: "rejected",
    note: "E2E: 근거 없는 항목 반려 확인",
  });
  assert.equal(rejected.verificationStatus, "rejected", "rejection applied");
  ok("rejection with a reason succeeds");

  const { data: rejectEvent } = await admin
    .from("product_usage_guide_review_events")
    .select("decision, reason_codes, note, reviewer_id")
    .eq("usage_guide_id", fixtureId!)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  assert.equal(rejectEvent.decision, "rejected", "audit row records the decision");
  assert.ok(
    Array.isArray(rejectEvent.reason_codes) && rejectEvent.reason_codes.length > 0,
    "rejection audit carries reason codes"
  );
  assert.equal(rejectEvent.reviewer_id, session.userId, "audit records the reviewer");
  ok("rejection is written to the audit trail with reasons and reviewer");

  // --- 4. the success path, on a real row -----------------------------------
  console.log("");
  console.log("[e2e:usage-guide-review] 4. approval of a real guide");
  const target = detail.guide;
  const approved = await submitUsageGuideReview(session, target.id, {
    decision: "approved",
    note: "E2E: 원문 대조 확인",
  });
  assert.equal(approved.verificationStatus, "approved", "approval applied");

  const afterApprove = await getUsageGuideItem(target.id);
  assert.ok(afterApprove && !("schemaReady" in afterApprove));
  if (afterApprove && !("schemaReady" in afterApprove)) {
    assert.equal(afterApprove.guide.verificationStatus, "approved");
    assert.ok(afterApprove.guide.verifiedAt, "verified_at is stamped on approval");
    ok("approval stamps verified_at");
  }

  const { count: publishable } = await admin
    .from("product_usage_guides_publishable")
    .select("*", { head: true, count: "exact" });
  assert.ok((publishable ?? 0) >= 1, "the approved row reaches the publishable view");
  ok(`publishable view now shows ${publishable} row(s)`);

  // revert so the human reviewer still makes the real call
  await submitUsageGuideReview(session, target.id, {
    decision: "needs_review",
    note: "E2E: 검증 후 원상복구",
  });
  const reverted = await getUsageGuideItem(target.id);
  if (reverted && !("schemaReady" in reverted)) {
    assert.equal(
      reverted.guide.verificationStatus,
      "needs_review",
      "row reverted to needs_review"
    );
    assert.equal(reverted.guide.verifiedAt, null, "verified_at cleared on revert");
  }
  ok("real row reverted to needs_review — the decision stays the reviewer's");

  // --- 5. final state --------------------------------------------------------
  console.log("");
  console.log("[e2e:usage-guide-review] 5. final state");
  const finalQueue = await getUsageGuideQueue({});
  assert.equal(
    finalQueue.schemaReady && finalQueue.total,
    expectedTotal,
    `still ${expectedTotal} real guides`
  );
  if (finalQueue.schemaReady) {
    assert.equal(
      finalQueue.counts.needs_review,
      expectedTotal,
      `all ${expectedTotal} back to needs_review (${JSON.stringify(finalQueue.counts)})`
    );
  }
  ok(`all ${expectedTotal} guides remain needs_review, untouched by this run`);

  console.log("");
  console.log(`[e2e:usage-guide-review] ${passed} checks passed`);
}

main().catch((error) => {
  console.error("");
  console.error("[e2e:usage-guide-review] FAILED:", error?.message ?? error);
  process.exitCode = 1;
});
