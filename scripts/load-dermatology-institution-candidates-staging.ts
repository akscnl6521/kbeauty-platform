/**
 * T07-02 — Load real HIRA Seoul dermatology candidates into Staging
 * public.dermatology_institution_candidates.
 *
 * Reads the two candidates-*.json artifacts that belong to the checkpoint
 * tracked at artifacts/seoul-dermatology-ingestion/checkpoint-latest.json
 * (runId t07-02-2026-07-25T00-51-28-08188ec4 — pages 1-20 of 50), dedupes by
 * institutionId, keeps only status === "candidate_ready" rows (excludes the
 * 83 filtered_out rows), and inserts with workflow_status:
 *   - "verified" when name/address/lat/lng/phone/departmentName are all
 *     present (simple required-field completeness check — this is public
 *     directory data, not a clinical claim, so presence-of-fields is a
 *     legitimate verification bar here).
 *   - "discovered" otherwise (currently: missing phone only, 49 rows).
 *
 * Never sets workflow_status = "published" — that requires a human
 * reviewer action, same as product_discovery_candidates.
 *
 * Deliberately excludes the two July 24 files (candidates-2026-07-24T*)
 * because they belong to different (earlier, smaller) runIds than the run
 * tracked by checkpoint-latest.json — one is mode:"fixture" (synthetic
 * test data, not real HIRA data), the other is a small superseded
 * live_blocked test batch. Only real data belonging to the current
 * checkpoint's run is loaded.
 *
 * Staging only. Aborts if NEXT_PUBLIC_SUPABASE_URL resolves to the
 * Production ref.
 */
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
loadDotEnvLocal();

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type {
  SeoulDermatologyCandidate,
} from "../src/lib/publicData/seoulDermatologyIngestion/types";

const PROD_REF = "rhfrmvkjsummaylpzmns";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "seoul-dermatology-ingestion");

// Only files belonging to the run tracked by checkpoint-latest.json.
const SOURCE_FILES = [
  "candidates-2026-07-25T00-51-28-251Z.json",
  "candidates-2026-07-25T03-30-10-482Z.json",
  "candidates-2026-07-25T03-31-42-497Z.json",
];

const DRY_RUN = process.argv.includes("--dry-run");

function extractRef(url: string): string {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? "";
}

type LoadedRow = {
  external_institution_id: string;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
  phone: string | null;
  institution_type_code: string | null;
  institution_type_name: string | null;
  sido_code: string | null;
  sido_name: string | null;
  sggu_code: string | null;
  sggu_name: string | null;
  department_code: string | null;
  department_name: string | null;
  established_date: string | null;
  source_service: string;
  source_url: string;
  workflow_status: "discovered" | "verified";
  notes: Record<string, unknown> | null;
  collected_at: string | null;
};

function toRow(c: SeoulDermatologyCandidate): LoadedRow {
  const f = c.fields;
  const isVerified = Boolean(
    f.name &&
      f.address &&
      f.latitude != null &&
      f.longitude != null &&
      f.phone &&
      f.departmentName
  );
  return {
    external_institution_id: f.institutionId,
    name: f.name,
    address: f.address,
    longitude: f.longitude,
    latitude: f.latitude,
    phone: f.phone,
    institution_type_code: f.institutionTypeCode,
    institution_type_name: f.institutionTypeName,
    sido_code: f.sidoCode,
    sido_name: f.sidoName,
    sggu_code: f.sgguCode,
    sggu_name: f.sgguName,
    department_code: f.departmentCode,
    department_name: f.departmentName,
    established_date: f.establishedDate,
    source_service: "hira_hospital_info",
    source_url: "https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList",
    workflow_status: isVerified ? "verified" : "discovered",
    notes: { candidateId: c.candidateId, sourcePipeline: "T07-02" },
    collected_at: f.collectedAt,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = extractRef(url);
  console.log("project_ref_masked=", ref ? `${ref.slice(0, 4)}***${ref.slice(-3)}` : "missing");
  if (!ref || ref === PROD_REF) {
    console.error("ABORT: NEXT_PUBLIC_SUPABASE_URL is missing or resolves to PRODUCTION ref.");
    process.exit(2);
  }
  if (!serviceKey) {
    console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY missing.");
    process.exit(2);
  }

  const byId = new Map<string, SeoulDermatologyCandidate>();
  for (const file of SOURCE_FILES) {
    const p = path.join(ARTIFACT_DIR, file);
    if (!existsSync(p)) {
      console.warn("skip missing file:", file);
      continue;
    }
    const parsed = JSON.parse(readFileSync(p, "utf8")) as {
      candidates: SeoulDermatologyCandidate[];
    };
    let kept = 0;
    for (const c of parsed.candidates) {
      if (c.status !== "candidate_ready") continue;
      if (byId.has(c.fields.institutionId)) continue; // dedupe by institutionId
      byId.set(c.fields.institutionId, c);
      kept++;
    }
    console.log(`${file}: ${parsed.candidates.length} total, ${kept} new candidate_ready kept`);
  }

  const rows = [...byId.values()].map(toRow);
  const verifiedCount = rows.filter((r) => r.workflow_status === "verified").length;
  console.log(
    `Prepared ${rows.length} unique rows (verified=${verifiedCount}, discovered=${rows.length - verifiedCount})`
  );

  if (DRY_RUN) {
    console.log("DRY RUN — no writes. Sample row:", JSON.stringify(rows[0], null, 2));
    return;
  }

  const admin = createClient(url, serviceKey);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await admin
      .from("dermatology_institution_candidates")
      .upsert(batch, { onConflict: "external_institution_id", count: "exact" });
    if (error) {
      console.error(`Batch ${i / BATCH} failed:`, error.message);
      process.exit(1);
    }
    inserted += count ?? batch.length;
    console.log(`Batch ${i / BATCH}: upserted ${batch.length} rows`);
  }

  console.log(`Done. ${inserted} rows upserted into dermatology_institution_candidates.`);
}

main().catch((e) => {
  console.error("LOAD FAILED", e);
  process.exit(1);
});
