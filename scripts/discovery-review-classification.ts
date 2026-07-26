/**
 * Classifies the 234 discovered/needs_review product_discovery_candidates
 * rows in Staging against quality-gate criteria (ingredient completeness,
 * image, offer/price-stock, duplicate) and writes a report only.
 *
 * READ-ONLY: no DB writes, no workflow_status changes, no publish.
 * Never trusts "looks complete" for rows whose own notes explicitly say
 * evidence is incomplete or verification is forbidden.
 *
 * Usage: npx tsx scripts/discovery-review-classification.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const ROOT = process.cwd();
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

type Row = {
  id: string;
  discovered_name: string;
  discovered_brand: string | null;
  discovered_url: string | null;
  source_type: string | null;
  ingredient_check_status: string;
  duplicate_check_status: string;
  workflow_status: string;
  notes: string | null;
  discovered_at: string;
};

type Classification =
  | "auto_approve_candidate"
  | "ingredient_incomplete"
  | "image_missing"
  | "offer_missing"
  | "duplicate"
  | "blocked_explicit_no_verify"
  | "other_review_required";

type ClassifiedRow = {
  id: string;
  name: string;
  brand: string;
  url: string | null;
  classification: Classification;
  reason: string;
};

const NO_VERIFY_MARKERS = ["verified 금지", "미검증", "확정 금지", "invented_field_forbidden"];

function tryParseNotes(notes: string | null): Record<string, unknown> | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function classify(row: Row): ClassifiedRow {
  const brand = row.discovered_brand ?? "(브랜드 미상)";
  const base = { id: row.id, name: row.discovered_name, brand, url: row.discovered_url };
  const notesJson = tryParseNotes(row.notes);

  if (!notesJson) {
    const raw = (row.notes ?? "").toLowerCase();
    if (NO_VERIFY_MARKERS.some((m) => raw.includes(m))) {
      return {
        ...base,
        classification: "blocked_explicit_no_verify",
        reason: "notes에 명시적 검증 금지 문구 포함",
      };
    }
    return {
      ...base,
      classification: "other_review_required",
      reason: "notes 파싱 불가 · 사유 미상",
    };
  }

  const sprint = typeof notesJson.sprint === "string" ? notesJson.sprint : "";
  const reviewReasons = Array.isArray(notesJson.reviewReasons)
    ? (notesJson.reviewReasons as string[])
    : [];

  if (sprint === "full-beauty-20260714") {
    if (reviewReasons.includes("full_inci_incomplete")) {
      return {
        ...base,
        classification: "ingredient_incomplete",
        reason: "sprint=full-beauty-20260714 · reviewReasons에 full_inci_incomplete 명시",
      };
    }
    return {
      ...base,
      classification: "other_review_required",
      reason: `sprint=full-beauty-20260714 · reviewReasons=${reviewReasons.join(",") || "(없음)"}`,
    };
  }

  if (sprint === "wq-f-catalog-remaining") {
    const hasIngredients = notesJson.hasIngredients === true;
    const hasImage = notesJson.hasImage === true;
    const hasOffer = notesJson.hasOffer === true;
    const qualityStatus =
      typeof notesJson.qualityStatus === "string" ? notesJson.qualityStatus : "";
    const isDuplicate = row.duplicate_check_status !== "pass";

    if (isDuplicate) {
      return { ...base, classification: "duplicate", reason: `duplicate_check_status=${row.duplicate_check_status}` };
    }
    if (!hasIngredients) {
      return { ...base, classification: "ingredient_incomplete", reason: "hasIngredients=false" };
    }
    if (!hasImage) {
      return { ...base, classification: "image_missing", reason: "hasImage=false" };
    }
    if (!hasOffer) {
      return { ...base, classification: "offer_missing", reason: "hasOffer=false" };
    }
    if (qualityStatus === "staging_ready") {
      return {
        ...base,
        classification: "auto_approve_candidate",
        reason: "qualityStatus=staging_ready · 전성분/이미지/오퍼 전부 확인 · 중복 아님",
      };
    }
    return { ...base, classification: "other_review_required", reason: `qualityStatus=${qualityStatus || "(없음)"}` };
  }

  // Unknown sprint — fall back to the table's own check-status columns only.
  if (row.duplicate_check_status !== "pass") {
    return { ...base, classification: "duplicate", reason: `duplicate_check_status=${row.duplicate_check_status}` };
  }
  if (row.ingredient_check_status !== "pass") {
    return { ...base, classification: "ingredient_incomplete", reason: `ingredient_check_status=${row.ingredient_check_status}` };
  }
  return { ...base, classification: "other_review_required", reason: "출처 불명 sprint · 근거 부족으로 보수적 분류" };
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

  const { data, error } = await client
    .from("product_discovery_candidates")
    .select(
      "id, discovered_name, discovered_brand, discovered_url, source_type, ingredient_check_status, duplicate_check_status, workflow_status, notes, discovered_at"
    )
    .in("workflow_status", ["discovered", "needs_review"])
    .order("discovered_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(`select_failed: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const classified = rows.map(classify);

  const byClassification: Record<Classification, ClassifiedRow[]> = {
    auto_approve_candidate: [],
    ingredient_incomplete: [],
    image_missing: [],
    offer_missing: [],
    duplicate: [],
    blocked_explicit_no_verify: [],
    other_review_required: [],
  };
  for (const c of classified) byClassification[c.classification].push(c);

  const autoApproveBrandCounts: Record<string, number> = {};
  for (const c of byClassification.auto_approve_candidate) {
    autoApproveBrandCounts[c.brand] = (autoApproveBrandCounts[c.brand] ?? 0) + 1;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    stagingRef: ref,
    productionTouched: false,
    databaseWritten: false,
    totalClassified: classified.length,
    counts: Object.fromEntries(
      Object.entries(byClassification).map(([k, v]) => [k, v.length])
    ),
    autoApproveCandidates: {
      count: byClassification.auto_approve_candidate.length,
      byBrand: autoApproveBrandCounts,
      items: byClassification.auto_approve_candidate.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        url: c.url,
      })),
    },
    reviewGroups: Object.fromEntries(
      (
        [
          "ingredient_incomplete",
          "image_missing",
          "offer_missing",
          "duplicate",
          "blocked_explicit_no_verify",
          "other_review_required",
        ] as const
      ).map((k) => [
        k,
        {
          count: byClassification[k].length,
          sample: byClassification[k].slice(0, 5),
        },
      ])
    ),
  };

  const outDir = path.join(ROOT, "artifacts", "discovery-review-classification");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(path.join(outDir, `report-${stamp}.json`), JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(path.join(outDir, "report-latest.json"), JSON.stringify(summary, null, 2), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("[discovery-review-classification] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
