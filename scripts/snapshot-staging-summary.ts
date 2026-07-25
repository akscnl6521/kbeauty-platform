/**
 * Non-PII Staging DB summary snapshot for the autopilot backup log.
 * Exports row COUNTS and aggregate breakdowns only — never user rows,
 * emails, UUIDs, or session data. Safe to commit to git.
 *
 * Usage: npx tsx scripts/snapshot-staging-summary.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

async function safeCount(
  client: ReturnType<typeof createClient>,
  table: string
): Promise<number | { error: string }> {
  try {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return { error: error.message };
    return count ?? 0;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("missing_supabase_credentials");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    "products",
    "product_discovery_candidates",
    "product_ingredients",
    "product_offers",
    "verification_queue",
    "dermatology_institution_candidates",
    "commercial_click_events",
  ];

  const counts: Record<string, number | { error: string }> = {};
  for (const t of tables) {
    counts[t] = await safeCount(client, t);
  }

  let productsActive: number | { error: string } = 0;
  try {
    const { count, error } = await client
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("active", true);
    productsActive = error ? { error: error.message } : count ?? 0;
  } catch (e) {
    productsActive = { error: e instanceof Error ? e.message : String(e) };
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    stagingRef: ref,
    note: "row counts / aggregates only — no PII, no user rows",
    tableRowCounts: counts,
    productsActiveCount: productsActive,
  };

  const outDir = path.join(process.cwd(), "data", "backups", "staging-snapshots");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(path.join(outDir, `snapshot-${stamp}.json`), JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(path.join(outDir, "snapshot-latest.json"), JSON.stringify(summary, null, 2), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("[snapshot-staging-summary] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
