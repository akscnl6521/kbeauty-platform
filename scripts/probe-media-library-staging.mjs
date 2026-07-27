#!/usr/bin/env node
/**
 * Read-only probe: does the §36.4 media asset library exist on Staging yet?
 * Never writes. Never prints keys or full project refs.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";

const MEDIA_TABLES = [
  "media_assets",
  "media_rights",
  "media_localizations",
  "product_videos",
  "routine_videos",
  "creator_assets",
  "video_usage_steps",
  "video_performance_events",
  "media_review_events",
];

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out = {};
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

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url || !serviceKey) {
  console.error("[probe:media-library] FAIL: Staging URL / service role key missing");
  process.exit(1);
}

const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
if (ref === PROD_REF) {
  console.error("[probe:media-library] FAIL: refusing to probe Production");
  process.exit(1);
}
console.log(`[probe:media-library] target ${maskRef(ref)} (read-only)`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// NOTE: `{ head: true }` returns 204 with no error for an unknown table, so it
// cannot be used to detect existence. A real row select surfaces PGRST205.
let missing = 0;
for (const table of MEDIA_TABLES) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    missing += 1;
    const reason = /does not exist|PGRST205|schema cache/i.test(error.message)
      ? "MISSING"
      : `ERROR ${error.message.slice(0, 60)}`;
    console.log(`  ${table.padEnd(26)} ${reason}`);
    continue;
  }
  const { count } = await admin
    .from(table)
    .select("*", { head: true, count: "exact" });
  console.log(`  ${table.padEnd(26)} EXISTS (rows=${count ?? 0})`);
}

console.log("");
if (missing > 0) {
  console.log(
    `[probe:media-library] ${missing}/${MEDIA_TABLES.length} tables absent — migration not applied yet`
  );
  process.exit(2);
}
console.log("[probe:media-library] all media library tables present");
process.exit(0);
