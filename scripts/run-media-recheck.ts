/**
 * §41 re-check worker for the media library and usage guides.
 *
 * Re-reads each due row's source, compares what it finds against the stored
 * rights window and extracted text, and downgrades anything that no longer holds
 * up. It can only ever downgrade — see src/lib/media/recheckPolicy.ts.
 *
 * What it changes, and only when --write is passed:
 *   - media asset whose rights lapsed        → verification_status = 'expired'
 *   - media asset whose URL is gone (404/410) → is_accessible = false
 *   - usage guide whose source page is gone   → verification_status = 'expired'
 *   - usage guide whose source text changed   → back to 'needs_review'
 * Every change is written to the matching review-events table first.
 *
 * A transient failure (5xx, timeout, throttle) never changes a status; it only
 * records that the attempt happened.
 *
 *   npm run media:recheck             # dry run, rows that are due
 *   npm run media:recheck -- --force  # dry run, every row regardless of schedule
 *   npm run media:recheck -- --write  # apply
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  decideRecheck,
  isDue,
  isInconclusive,
  isRecheckable,
  nextCheckDueAt,
  retryDueAt,
  summarizeRights,
  type Reachability,
  type RecheckDecision,
  type RightsState,
} from "../src/lib/media/recheckPolicy";
import {
  extractUsageGuidance,
  htmlToVisibleText,
  looksMojibake,
} from "../src/lib/catalog/enrichment/extractUsageGuidance";

const root = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");
const UA =
  "KBeautyMatchBot/1.0 (+https://www.kbeautymatch.com; scheduled-recheck)";
const DELAY_MS = 1200;
const TIMEOUT_MS = 15000;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decodeBody(buffer: ArrayBuffer, contentType: string): string {
  const headerCharset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const peek = Buffer.from(buffer.slice(0, 4096)).toString("latin1");
  const metaCharset =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(peek)?.[1] ??
    /content=["'][^"']*charset=([\w-]+)/i.exec(peek)?.[1];
  for (const charset of [headerCharset, metaCharset, "utf-8"].filter(
    (v): v is string => Boolean(v)
  )) {
    try {
      const decoded = new TextDecoder(charset.toLowerCase()).decode(buffer);
      if (!looksMojibake(decoded)) return decoded;
    } catch {
      /* try next */
    }
  }
  return new TextDecoder("utf-8").decode(buffer);
}

type FetchResult = { reachability: Reachability; text: string | null };

async function fetchSource(url: string): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410) {
      return { reachability: { kind: "gone", httpStatus: res.status }, text: null };
    }
    if (!res.ok) {
      // 403/429/5xx say something about the bot or the server, not the asset
      return {
        reachability: { kind: "transient", httpStatus: res.status },
        text: null,
      };
    }
    const text = decodeBody(
      await res.arrayBuffer(),
      res.headers.get("content-type") ?? ""
    );
    return { reachability: { kind: "ok" }, text };
  } catch {
    return { reachability: { kind: "transient", httpStatus: null }, text: null };
  }
}

type Finding = {
  table: "media_assets" | "product_usage_guides";
  id: string;
  label: string;
  status: string;
  rightsState: RightsState;
  reachability: Reachability;
  contentChanged: boolean;
  decision: RecheckDecision;
};

function describe(finding: Finding): string {
  const bits = [
    `[${finding.status}]`,
    finding.rightsState !== "none" ? `권리:${finding.rightsState}` : null,
    `접속:${finding.reachability.kind}`,
    finding.contentChanged ? "원문변경" : null,
  ].filter(Boolean);
  return `${finding.label.slice(0, 40).padEnd(42)} ${bits.join(" ")}`;
}

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    console.error("[recheck] FAIL: Staging credentials missing");
    process.exitCode = 1;
    return;
  }
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
  if (ref === PROD_REF) {
    console.error("[recheck] FAIL: refusing to run against Production");
    process.exitCode = 1;
    return;
  }
  console.log(
    `[recheck] target ${ref.slice(0, 4)}***${ref.slice(-3)} · mode ${WRITE ? "WRITE" : "dry run"}${FORCE ? " · force (ignoring schedule)" : ""}`
  );

  const admin: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const now = new Date();
  const findings: Finding[] = [];

  // --- media assets ---------------------------------------------------------
  const { data: assets, error: assetError } = await admin
    .from("media_assets")
    .select(
      "id, title, source_url, verification_status, is_accessible, next_check_due_at"
    )
    .limit(1000);
  if (assetError) {
    console.error(`[recheck] media_assets unreadable: ${assetError.message}`);
    process.exitCode = 1;
    return;
  }

  const { data: allRights } = await admin
    .from("media_rights")
    .select("media_asset_id, rights_status, rights_start_at, rights_end_at")
    .limit(2000);
  const rightsByAsset = new Map<string, typeof allRights>();
  for (const grant of allRights ?? []) {
    const key = String(grant.media_asset_id);
    const list = rightsByAsset.get(key) ?? [];
    list.push(grant);
    rightsByAsset.set(key, list);
  }

  const dueAssets = (assets ?? []).filter(
    (a) =>
      isRecheckable(String(a.verification_status)) &&
      (FORCE || isDue(a.next_check_due_at as string | null, now))
  );
  console.log(
    `[recheck] media assets: ${assets?.length ?? 0} total · ${dueAssets.length} to check`
  );

  for (const asset of dueAssets) {
    const rights = (rightsByAsset.get(String(asset.id)) ?? []).map((g) => ({
      rightsStatus: String(g.rights_status),
      rightsStartAt: (g.rights_start_at as string | null) ?? null,
      rightsEndAt: (g.rights_end_at as string | null) ?? null,
    }));
    const rightsState = summarizeRights(rights, now);

    let reachability: Reachability = { kind: "skipped" };
    if (asset.source_url) {
      const fetched = await fetchSource(String(asset.source_url));
      reachability = fetched.reachability;
      await sleep(DELAY_MS);
    }

    const decision = decideRecheck(
      {
        kind: "media_asset",
        status: String(asset.verification_status),
        reachability,
        rightsState,
      },
      now
    );
    findings.push({
      table: "media_assets",
      id: String(asset.id),
      label: String(asset.title ?? asset.id),
      status: String(asset.verification_status),
      rightsState,
      reachability,
      contentChanged: false,
      decision,
    });
  }

  // --- usage guides ---------------------------------------------------------
  const { data: guides, error: guideError } = await admin
    .from("product_usage_guides")
    .select(
      "id, product_id, source_url, content_hash, verification_status, next_check_due_at, is_fixture"
    )
    .eq("is_fixture", false)
    .limit(1000);
  if (guideError) {
    console.error(`[recheck] product_usage_guides unreadable: ${guideError.message}`);
    process.exitCode = 1;
    return;
  }

  const dueGuides = (guides ?? []).filter(
    (g) =>
      isRecheckable(String(g.verification_status)) &&
      (FORCE || isDue(g.next_check_due_at as string | null, now))
  );
  console.log(
    `[recheck] usage guides: ${guides?.length ?? 0} total · ${dueGuides.length} to check`
  );

  const productNames = new Map<number, string>();
  if (dueGuides.length > 0) {
    const { data: products } = await admin
      .from("products")
      .select("id, name")
      .in("id", [...new Set(dueGuides.map((g) => Number(g.product_id)))]);
    for (const p of products ?? []) productNames.set(Number(p.id), String(p.name));
  }

  for (const guide of dueGuides) {
    let reachability: Reachability = { kind: "skipped" };
    let contentChanged = false;

    if (guide.source_url) {
      const fetched = await fetchSource(String(guide.source_url));
      reachability = fetched.reachability;
      if (fetched.text) {
        const text = htmlToVisibleText(fetched.text);
        // compare on the whole visible page, exactly as the collector hashed it
        const hash = createHash("sha256").update(text).digest("hex").slice(0, 32);
        if (guide.content_hash && hash !== guide.content_hash) {
          // only a change that touches the usage section matters
          const extracted = extractUsageGuidance(text);
          contentChanged = extracted.methodSteps.length > 0;
        }
      }
      await sleep(DELAY_MS);
    }

    const decision = decideRecheck(
      {
        kind: "usage_guide",
        status: String(guide.verification_status),
        reachability,
        rightsState: "none",
        contentChanged,
      },
      now
    );
    findings.push({
      table: "product_usage_guides",
      id: String(guide.id),
      label:
        productNames.get(Number(guide.product_id)) ?? `제품 #${guide.product_id}`,
      status: String(guide.verification_status),
      rightsState: "none",
      reachability,
      contentChanged,
      decision,
    });
  }

  // --- report ---------------------------------------------------------------
  console.log("");
  const changing = findings.filter((f) => f.decision.statusChanges);
  const warnings = findings.filter(
    (f) => !f.decision.statusChanges && f.decision.reasonCodes.length > 0
  );
  const healthy = findings.filter((f) => f.decision.reasonCodes.length === 0);

  console.log(`[recheck] checked ${findings.length} rows`);
  console.log(`  변경 필요 : ${changing.length}`);
  console.log(`  경고만    : ${warnings.length}`);
  console.log(`  이상 없음 : ${healthy.length}`);

  if (changing.length > 0) {
    console.log("");
    console.log("  --- 상태를 내릴 대상 ---");
    for (const f of changing) {
      console.log(`   ${f.decision.action.padEnd(17)} ${describe(f)}`);
    }
  }
  if (warnings.length > 0) {
    console.log("");
    console.log("  --- 경고 (상태 변경 없음) ---");
    for (const f of warnings) {
      console.log(`   ${f.decision.reasonCodes.join(",").padEnd(30)} ${describe(f)}`);
    }
  }

  if (!WRITE) {
    console.log("");
    console.log("[recheck] dry run — pass --write to apply");
    return;
  }

  // --- apply ----------------------------------------------------------------
  let applied = 0;
  let failed = 0;

  for (const f of findings) {
    const stamp = new Date().toISOString();
    const kind = f.table === "media_assets" ? "media_asset" : "usage_guide";
    // a check that never reached the source has confirmed nothing, so it is
    // retried sooner rather than counting as a full interval of verification
    const nextDue = (
      isInconclusive(f.reachability)
        ? retryDueAt(kind, new Date())
        : nextCheckDueAt(kind, new Date())
    ).toISOString();

    if (f.decision.statusChanges) {
      const eventTable =
        f.table === "media_assets"
          ? "media_review_events"
          : "product_usage_guide_review_events";
      const idColumn =
        f.table === "media_assets" ? "media_asset_id" : "usage_guide_id";
      const decisionValue =
        f.decision.action === "reopen_review" ? "needs_review" : "expired";

      // audit before the change, so a failed update cannot hide it
      const { error: auditError } = await admin.from(eventTable).insert({
        [idColumn]: f.id,
        reviewer_id: null,
        decision: decisionValue,
        previous_status: f.status,
        reason_codes: f.decision.reasonCodes,
        note: "§41 자동 재확인",
      });
      if (auditError) {
        failed += 1;
        console.error(`  ! audit ${f.id}: ${auditError.message.slice(0, 70)}`);
        continue;
      }

      const patch: Record<string, unknown> = {
        last_checked_at: stamp,
        next_check_due_at: nextDue,
        updated_at: stamp,
      };
      if (f.decision.action === "expire") {
        patch.verification_status = "expired";
      } else if (f.decision.action === "reopen_review") {
        patch.verification_status = "needs_review";
        patch.verified_at = null;
        patch.verified_by = null;
      } else if (f.decision.action === "mark_unreachable") {
        patch.is_accessible = false;
      }

      const { error: updateError } = await admin
        .from(f.table)
        .update(patch)
        .eq("id", f.id);
      if (updateError) {
        failed += 1;
        console.error(`  ! update ${f.id}: ${updateError.message.slice(0, 70)}`);
        continue;
      }
      applied += 1;
      console.log(`  ✓ ${f.decision.action} ${f.label.slice(0, 40)}`);
      continue;
    }

    // healthy or warned: record that the check happened and reschedule
    const patch: Record<string, unknown> = {
      last_checked_at: stamp,
      next_check_due_at: nextDue,
      updated_at: stamp,
    };
    if (f.table === "media_assets" && f.reachability.kind === "ok") {
      patch.is_accessible = true;
    }
    const { error } = await admin.from(f.table).update(patch).eq("id", f.id);
    if (error) {
      failed += 1;
      console.error(`  ! stamp ${f.id}: ${error.message.slice(0, 70)}`);
    }
  }

  console.log("");
  console.log(`[recheck] applied ${applied} status change(s) · failed ${failed}`);
  console.log(`[recheck] ${findings.length} rows rescheduled`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[recheck] failed:", error);
  process.exitCode = 1;
});
