#!/usr/bin/env node
/**
 * Probe Staging checkin_email_queue (no secret prints).
 * Reports: ready | missing | permission_missing
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const root = path.resolve(import.meta.dirname, "..");

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return ref.slice(0, 4) + "***" + ref.slice(-3);
}

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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

function extractRef(url) {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : "";
}

async function main() {
  const env = {
    ...loadEnvFile(".env.staging"),
    ...loadEnvFile(".env.local"),
  };

  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    console.log("status: missing");
    console.log("reason: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not in .env.staging");
    process.exit(1);
  }

  const ref = extractRef(url);
  if (ref === PROD_REF) {
    console.log("status: missing");
    console.log("reason: URL points to Production (blocked)");
    process.exit(1);
  }
  if (ref !== STAGING_REF) {
    console.log("status: missing");
    console.log("reason: URL ref is not Staging (" + maskRef(STAGING_REF) + ")");
    process.exit(1);
  }

  console.log("environment: staging (" + maskRef(ref) + ")");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { error: selErr } = await admin
    .from("checkin_email_queue")
    .select("id")
    .limit(1);

  if (selErr) {
    const msg = selErr.message || String(selErr);
    if (/does not exist|relation.*not found|42P01|Could not find the table/i.test(msg)) {
      console.log("status: missing");
      console.log("reason: table checkin_email_queue not found (apply Dashboard SQL)");
      setTimeout(() => process.exit(0), 50);
      return;
    }
    if (/permission denied|42501/i.test(msg)) {
      console.log("status: permission_missing");
      console.log("reason: service_role SELECT denied");
      process.exit(0);
    }
    console.log("status: missing");
    console.log("reason:", msg.slice(0, 120));
    process.exit(1);
  }

  console.log("status: ready");
  console.log("select: ok (limit 1)");

  const { data: claimData, error: claimErr } = await admin.rpc(
    "claim_checkin_email_jobs",
    { p_limit: 1, p_stale_seconds: 900 }
  );

  if (claimErr) {
    console.log("claim: error");
    console.log("claim_reason:", (claimErr.message || "").slice(0, 120));
    process.exit(0);
  }

  const count = Array.isArray(claimData) ? claimData.length : 0;
  console.log("claim_dry: ok");
  console.log("claim_count:", count);
  setTimeout(() => process.exit(0), 50);
}

main().catch((e) => {
  console.error("probe failed:", e.message || e);
  process.exit(1);
});
