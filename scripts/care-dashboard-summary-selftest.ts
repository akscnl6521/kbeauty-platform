import {
  managementLevelLabel,
  referralLabel,
  referralTone,
  summarizeCareDashboard,
} from "../src/lib/care/dashboardSummary";
import type { CareAnalysisSession, CareCheckIn } from "../src/lib/care/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[care-dashboard-summary] ${message}`);
}

const session = (id: string, createdAt: string, managementLevel: string): CareAnalysisSession => ({
  id,
  createdAt,
  timezone: "Asia/Seoul",
  country: "KR",
  ageBand: null,
  skinType: null,
  sensitivity: null,
  concerns: ["붉은기"],
  toneDepth: null,
  undertone: null,
  allergyIngredients: [],
  avoidedIngredients: [],
  currentProducts: [],
  budgetBand: null,
  texturePreference: null,
  fragrancePreference: null,
  analysisSnapshot: {},
  recommendationSnapshot: { managementLevel },
  rankedProductIds: [],
  dataConfidence: 0.9,
  dermatologyHints: [],
  consentCareTracking: true,
  linkedAccount: false,
  anonymousDeviceId: "device",
});

const checkIn = (
  id: string,
  status: CareCheckIn["status"],
  dueAt: string,
  referralLevel: CareCheckIn["referralLevel"]
): CareCheckIn => ({
  id,
  analysisSessionId: "s2",
  routineId: null,
  day: 3,
  status,
  scheduledFor: dueAt,
  dueAt,
  completedAt: status === "completed" ? dueAt : null,
  timezone: "Asia/Seoul",
  answers: null,
  progressDelta: null,
  referralLevel,
  suggestionIds: [],
});

const summary = summarizeCareDashboard({
  sessions: [
    session("s1", "2026-07-01T00:00:00.000Z", "cosmetic_care"),
    session("s2", "2026-07-18T00:00:00.000Z", "expert_first"),
  ],
  checkIns: [
    checkIn("scheduled", "scheduled", "2026-07-20T00:00:00.000Z", "none"),
    checkIn("due", "due", "2026-07-25T00:00:00.000Z", "none"),
    checkIn("completed", "completed", "2026-07-10T00:00:00.000Z", "seek_promptly"),
  ],
});

assert(summary.latestSession?.id === "s2", "latest analysis selected");
assert(summary.nextCheckIn?.id === "due", "due check-in prioritized over scheduled");
assert(summary.referralLevel === "seek_promptly", "highest referral level selected");
assert(managementLevelLabel(summary.latestSession) === "전문가 상담 우선", "management label");
assert(referralLabel("seek_emergency_care").includes("긴급"), "emergency label");
assert(referralTone("none") === "normal", "normal tone");
assert(referralTone("consider_soon") === "warning", "warning tone");
assert(referralTone("seek_emergency_care") === "urgent", "urgent tone");

console.log("[care-dashboard-summary] ok");

async function runAdminCareReadinessSelftest() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  };
  const { createClient } = await import("@supabase/supabase-js");
  const { KNOWN_PRODUCTION_SUPABASE_REF } = await import(
    "../src/lib/catalog/automation/ingestionGate"
  );
  const { classifyCareCheckInsProbeError, careReadinessNote } = await import(
    "../src/lib/admin/care-ops"
  );

  const KNOWN_STAGING_SUPABASE_REF = "jfnjufmldiqlgvgyugfd";

  function maskRef(ref: string | null | undefined): string {
    if (!ref) return "missing";
    if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
    return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
  }

  function refFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      return new URL(url).hostname.split(".")[0] ?? null;
    } catch {
      return null;
    }
  }

  function parseEnv(file: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[trimmed.slice(0, eq).trim()] = value;
    }
    return out;
  }

  function evaluatePreviewSupabaseRef(input: {
    projectRef: string | null | undefined;
    expectedStagingRef?: string;
  }): { ok: boolean; reason: string; projectRefMasked: string } {
    const ref = (input.projectRef ?? "").trim();
    const expected = (input.expectedStagingRef ?? KNOWN_STAGING_SUPABASE_REF).trim();
    const masked = maskRef(ref);
    if (!ref) {
      return { ok: false, reason: "project_ref_missing", projectRefMasked: masked };
    }
    if (ref === KNOWN_PRODUCTION_SUPABASE_REF) {
      return {
        ok: false,
        reason: "production_project_ref_blocked",
        projectRefMasked: masked,
      };
    }
    if (ref !== expected) {
      return {
        ok: false,
        reason: "staging_project_ref_mismatch",
        projectRefMasked: masked,
      };
    }
    return { ok: true, reason: "staging_project_ref_ok", projectRefMasked: masked };
  }

  assert(
    classifyCareCheckInsProbeError(null) === "ready",
    "null error is ready"
  );
  assert(
    classifyCareCheckInsProbeError({ code: "42501", message: "permission denied" }) ===
      "permission_missing",
    "42501 is permission_missing"
  );
  assert(
    classifyCareCheckInsProbeError({
      code: "PGRST205",
      message: "Could not find the table 'public.care_check_ins' in the schema cache",
    }) === "migration_missing",
    "PGRST205 is migration_missing"
  );
  assert(
    classifyCareCheckInsProbeError({
      code: "42P01",
      message: 'relation "care_check_ins" does not exist',
    }) === "migration_missing",
    "42P01 relation missing is migration_missing"
  );
  assert(
    classifyCareCheckInsProbeError({ code: "XX000", message: "unexpected" }) ===
      "query_error",
    "unknown code is query_error"
  );
  assert(
    careReadinessNote("permission_missing").includes("admin service role"),
    "permission_missing note"
  );
  assert(
    careReadinessNote("migration_missing").includes("migration is not applied"),
    "migration_missing note"
  );

  const stagingOk = evaluatePreviewSupabaseRef({
    projectRef: KNOWN_STAGING_SUPABASE_REF,
  });
  assert(stagingOk.ok, "staging ref accepted");
  assert(stagingOk.projectRefMasked.includes("***"), "staging ref masked in output");

  const prodBlocked = evaluatePreviewSupabaseRef({
    projectRef: KNOWN_PRODUCTION_SUPABASE_REF,
  });
  assert(!prodBlocked.ok, "production ref blocked");
  assert(
    prodBlocked.reason === "production_project_ref_blocked",
    "production block reason"
  );

  const mismatch = evaluatePreviewSupabaseRef({
    projectRef: "otherstagingref01",
  });
  assert(!mismatch.ok, "unexpected ref blocked");
  assert(
    mismatch.reason === "staging_project_ref_mismatch",
    "staging mismatch reason"
  );

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const env = parseEnv(path.join(root, ".env.staging"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = env.SUPABASE_PROJECT_REF?.trim() || refFromUrl(url);
  const refCheck = evaluatePreviewSupabaseRef({ projectRef: ref });
  assert(refCheck.projectRefMasked.includes("***"), "env ref masked");
  console.log(
    `[admin-care-readiness] preview_ref_check=${refCheck.reason} ref=${refCheck.projectRefMasked}`
  );

  if (env.SUPABASE_SERVICE_ROLE_KEY && url && refCheck.ok) {
    const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await client.from("care_check_ins").select("id").limit(1);
    const status = classifyCareCheckInsProbeError(error);
    const codeSuffix = error?.code ? ` code=${error.code}` : "";
    console.log(
      `[admin-care-readiness] care_check_ins_probe=${status}${codeSuffix}`
    );
    if (status === "permission_missing") {
      console.log(
        "[admin-care-readiness] hint: apply 20260721100000_grant_service_role_care_read.sql on staging"
      );
    }
  }

  console.log("[admin-care-readiness] all checks passed");
}

if (process.argv.includes("--admin-care-readiness")) {
  runAdminCareReadinessSelftest().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
