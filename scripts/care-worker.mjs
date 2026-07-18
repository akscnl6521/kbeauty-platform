#!/usr/bin/env node
/**
 * Care scheduler / notification worker (Staging-safe).
 * - Production DB writes blocked when URL/ref is production.
 * - dry-run by default unless --apply and Staging confirmed.
 *
 * npm run care:dry-run
 * npm run care:scheduler -- --dry-run
 * npm run care:notify -- --dry-run
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const LOCK = path.join(root, "reports", "care-worker.lock");
const CHECKPOINT = path.join(root, "reports", "care-worker-checkpoint.json");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function refFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  return {
    dryRun: !argv.includes("--apply"),
    limit: Number(argv.find((a, i) => argv[i - 1] === "--limit") || 50),
    mode: argv.includes("--notify-only")
      ? "notify"
      : argv.includes("--schedule-only")
        ? "schedule"
        : "all",
  };
}

function acquireLock() {
  mkdirSync(path.dirname(LOCK), { recursive: true });
  if (existsSync(LOCK)) {
    const raw = readFileSync(LOCK, "utf8");
    const age = Date.now() - Number(raw || 0);
    if (Number.isFinite(age) && age < 30 * 60_000) {
      throw new Error("lock_held");
    }
  }
  writeFileSync(LOCK, String(Date.now()), "utf8");
}

function releaseLock() {
  try {
    unlinkSync(LOCK);
  } catch {
    /* ignore */
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const catalogEnv = (process.env.CATALOG_DATABASE_ENV || "").toLowerCase();
  const ref = refFromUrl(url);

  const summary = {
    startedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    mode: args.mode,
    limit: args.limit,
    productionBlocked: false,
    stagingLive: false,
    skipped: [],
    applied: [],
    email: { status: "skipped", reason: "not_in_this_tick" },
    counts: {},
  };

  if (ref === PROD || catalogEnv === "production") {
    summary.productionBlocked = true;
    summary.skipped.push("production_ref_or_env");
    writeFileSync(
      path.join(root, "reports", "care-worker-last.json"),
      JSON.stringify(summary, null, 2) + "\n"
    );
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  if (ref !== STAGING || !service) {
    summary.skipped.push(
      ref !== STAGING ? "not_staging_ref" : "missing_service_role"
    );
    summary.skipped.push("db_writes_skipped");
    // Email dry-run preview without DB
    const { sendCareEmail } = await import("../src/lib/care/email/adapter.ts").catch(
      () => ({ sendCareEmail: null })
    );
    if (typeof sendCareEmail === "function") {
      summary.email = await sendCareEmail(
        {
          to: "dry-run@example.invalid",
          templateId: "checkin_day_3",
          checkInId: "dry",
          day: 3,
          timezone: "Asia/Seoul",
          deepLinkPath: "/my/check-ins/dry",
          emailOptIn: true,
        },
        { dryRun: true }
      );
    } else {
      summary.email = {
        status: "dry_run",
        reason: "adapter_preview_via_node_fallback",
        provider: null,
        previewSubject: "Day 3 체크인 안내 — K-Beauty Match",
      };
    }
    writeFileSync(
      path.join(root, "reports", "care-worker-last.json"),
      JSON.stringify(summary, null, 2) + "\n"
    );
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  summary.stagingLive = true;
  acquireLock();
  try {
    if (args.dryRun) {
      summary.skipped.push("dry_run_no_writes");
      summary.applied.push("safety_checks_ok");
    } else {
      const client = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Dynamic import of compiled worker via tsx path in npm script
      const { runCareWorkerTick } = await import(
        "../src/lib/care/worker-tasks.ts"
      );
      const result = await runCareWorkerTick(client);
      summary.applied = result.applied;
      summary.skipped.push(...result.skipped);
      summary.counts = result.counts;
    }
    writeFileSync(
      CHECKPOINT,
      JSON.stringify({ ...summary, finishedAt: new Date().toISOString() }, null, 2) +
        "\n"
    );
    writeFileSync(
      path.join(root, "reports", "care-worker-last.json"),
      JSON.stringify(summary, null, 2) + "\n"
    );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    releaseLock();
  }
}

main().catch((e) => {
  releaseLock();
  console.error(String(e?.message || e));
  process.exit(1);
});
