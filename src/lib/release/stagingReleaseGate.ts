/**
 * P2-T02 — Staging read-only release gate contract.
 *
 * Verifies environment identity, health expectations, table/migration
 * contracts, auth callback inputs, storage expectations, and publication
 * safety rules without Production writes. Default mode is static/read-only.
 *
 * Distinguishes verified facts from dashboard-only unknowns.
 * Never prints secrets or full project refs.
 */

import {
  extractProjectRefFromUrl,
  KNOWN_PRODUCTION_SUPABASE_REF,
  maskProjectRef,
} from "@/lib/catalog/automation/ingestionGate";
import { CARE_PHOTO_BUCKET } from "@/lib/care/photoComparisonPolicy";
import { STAGING_SUPABASE_PROJECT_REF } from "@/lib/admin/checkinEmailWorkerAdminPolicy";

export const STAGING_RELEASE_GATE_TASK_ID = "P2-T02" as const;

export const KNOWN_STAGING_SUPABASE_REF = STAGING_SUPABASE_PROJECT_REF;

/** Gate run modes — never write. */
export type StagingReleaseGateMode = "static" | "readonly";

/**
 * How a check result was obtained / how much trust it carries.
 * - verified: confirmed by repo files, env presence, or SELECT-only probe
 * - dashboard_only_unknown: requires human Dashboard inspection (not inventable)
 * - skipped: optional live probe skipped (no credentials / static mode)
 * - blocked: Production or unsafe identity — abort before any remote work
 */
export type GateFactKind =
  | "verified"
  | "dashboard_only_unknown"
  | "skipped"
  | "blocked";

export type GateCheckStatus = "pass" | "fail" | "warn" | "unknown";

export type GateCheckCategory =
  | "environment_identity"
  | "health"
  | "tables_contracts"
  | "auth_callback"
  | "storage"
  | "publication_states"
  | "migrations";

export type GateCheckResult = {
  id: string;
  category: GateCheckCategory;
  titleKo: string;
  status: GateCheckStatus;
  factKind: GateFactKind;
  detailKo: string;
  /** Relative paths checked when applicable. */
  evidencePaths?: string[];
};

export type StagingReleaseGateReport = {
  taskId: typeof STAGING_RELEASE_GATE_TASK_ID;
  mode: StagingReleaseGateMode;
  generatedAt: string;
  projectRefMasked: string | null;
  isStagingIdentity: boolean;
  isProductionBlocked: boolean;
  writeAttempted: false;
  checks: GateCheckResult[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
    unknown: number;
    dashboardOnlyUnknown: number;
  };
  ok: boolean;
};

export type EnvBag = Record<string, string | undefined>;

/** Core catalog / care tables expected by Staging contracts (repo + docs). */
export const EXPECTED_STAGING_TABLES = [
  "products",
  "ingredients",
  "product_ingredients",
  "product_offers",
  "product_variants",
  "profiles",
] as const;

/** Dated migrations that should exist in-repo (apply status may be dashboard-only). */
export const EXPECTED_DATED_MIGRATIONS = [
  "supabase/migrations/20250315000000_bootstrap_core_schema_for_empty_staging.sql",
  "supabase/migrations/20260712000000_create_product_offers.sql",
  "supabase/migrations/20260713180000_create_continuous_care_persistence.sql",
  "supabase/migrations/20260721100000_grant_service_role_care_read.sql",
  "supabase/migrations/20260722010000_create_checkin_email_queue.sql",
] as const;

/** DRAFT / not-for-apply migrations — presence verified; applied=false assumed until Dashboard confirms. */
export const DRAFT_MIGRATIONS = [
  {
    path: "supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql",
    topic: "beauty_profiles",
  },
  {
    path: "supabase/migrations/DRAFT_DO_NOT_APPLY_care_photo_comparison.sql",
    topic: CARE_PHOTO_BUCKET,
  },
] as const;

/** Auth callback query inputs the route must accept (code contract). */
export const AUTH_CALLBACK_INPUTS = [
  "token_hash",
  "type",
  "code",
  "next",
] as const;

/** Product publication pipeline — only `published` may enter core recommend. */
export const PUBLICATION_PIPELINE_STATES = [
  "discovered",
  "sale_checked",
  "ingredients_checked",
  "evidence_checked",
  "safety_checked",
  "verified",
  "published",
] as const;

export const AUTH_CALLBACK_ROUTE = "src/app/auth/callback/route.ts";
export const HEALTH_ROUTE = "src/app/api/health/route.ts";
export const SAFE_NEXT_MODULE = "src/lib/auth/safe-next.ts";
export const PIPELINE_OPERATION_CONFIG = "config/pipeline-operation.json";

const DESTRUCTIVE_PIPELINE_FLAGS = [
  "allowDelete",
  "allowPublish",
  "allowProductInsert",
  "allowOfferInsert",
  "allowVerifiedOfferInsert",
  "allowIngredientWrite",
  "allowExistingCandidateBulkUpdate",
  "allowExistingProductOverwrite",
  "allowBulkStatusRewrite",
  "allowProductDemotion",
] as const;

export type FileExistsFn = (relativePath: string) => boolean;
export type FileReadFn = (relativePath: string) => string;

export function resolveProjectRef(env: EnvBag = {}): string | null {
  const explicit = env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;
  return extractProjectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
}

export function resolveProductionRef(env: EnvBag = {}): string {
  return (
    env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() || KNOWN_PRODUCTION_SUPABASE_REF
  );
}

export function resolveStagingRef(env: EnvBag = {}): string {
  return env.STAGING_SUPABASE_PROJECT_REF?.trim() || KNOWN_STAGING_SUPABASE_REF;
}

export function assessEnvironmentIdentity(env: EnvBag = {}): {
  projectRef: string | null;
  projectRefMasked: string | null;
  productionRefMasked: string;
  stagingRefMasked: string;
  isProduction: boolean;
  isStaging: boolean;
  appEnv: string | null;
  catalogDatabaseEnv: string | null;
} {
  const projectRef = resolveProjectRef(env);
  const productionRef = resolveProductionRef(env);
  const stagingRef = resolveStagingRef(env);
  const appEnv = env.APP_ENV?.trim().toLowerCase() || null;
  const catalogDatabaseEnv =
    env.CATALOG_DATABASE_ENV?.trim().toLowerCase() || null;

  return {
    projectRef,
    projectRefMasked: projectRef ? maskProjectRef(projectRef) : null,
    productionRefMasked: maskProjectRef(productionRef),
    stagingRefMasked: maskProjectRef(stagingRef),
    isProduction:
      Boolean(projectRef && projectRef === productionRef) ||
      appEnv === "production",
    isStaging:
      Boolean(projectRef && projectRef === stagingRef) ||
      catalogDatabaseEnv === "staging" ||
      appEnv === "preview" ||
      appEnv === "staging",
    appEnv,
    catalogDatabaseEnv,
  };
}

function emptySummary(): StagingReleaseGateReport["summary"] {
  return { pass: 0, fail: 0, warn: 0, unknown: 0, dashboardOnlyUnknown: 0 };
}

export function summarizeChecks(
  checks: GateCheckResult[]
): StagingReleaseGateReport["summary"] {
  const summary = emptySummary();
  for (const c of checks) {
    summary[c.status] += 1;
    if (c.factKind === "dashboard_only_unknown") summary.dashboardOnlyUnknown += 1;
  }
  return summary;
}

export function reportIsOk(checks: GateCheckResult[], isProductionBlocked: boolean): boolean {
  if (isProductionBlocked) return false;
  return checks.every((c) => c.status !== "fail");
}

/**
 * Build static (default) gate checks from repo + env presence.
 * Does not call network APIs or write to any database.
 */
export function runStaticStagingReleaseGate(options: {
  env?: EnvBag;
  fileExists: FileExistsFn;
  readFile: FileReadFn;
  now?: string;
}): StagingReleaseGateReport {
  const env = options.env ?? {};
  const checks: GateCheckResult[] = [];
  const identity = assessEnvironmentIdentity(env);

  // --- environment identity ---
  if (identity.isProduction) {
    checks.push({
      id: "env_not_production",
      category: "environment_identity",
      titleKo: "Production 식별자 차단",
      status: "fail",
      factKind: "blocked",
      detailKo: `Production 환경으로 식별됨 (${identity.projectRefMasked ?? "APP_ENV=production"}). Staging 게이트 중단.`,
    });
  } else {
    checks.push({
      id: "env_not_production",
      category: "environment_identity",
      titleKo: "Production 식별자 차단",
      status: "pass",
      factKind: "verified",
      detailKo: `Production ref(${identity.productionRefMasked})와 불일치 · APP_ENV≠production`,
    });
  }

  if (identity.projectRef) {
    const isExactStaging = identity.projectRef === resolveStagingRef(env);
    checks.push({
      id: "env_staging_ref",
      category: "environment_identity",
      titleKo: "Staging 프로젝트 식별",
      status: isExactStaging ? "pass" : identity.isStaging ? "warn" : "fail",
      factKind: "verified",
      detailKo: isExactStaging
        ? `Staging ref 일치 (${identity.projectRefMasked})`
        : identity.isStaging
          ? `Staging 힌트 있음 · exact ref는 ${identity.stagingRefMasked} 기대 (현재 ${identity.projectRefMasked})`
          : `Staging ref 불일치 (기대 ${identity.stagingRefMasked}, 현재 ${identity.projectRefMasked})`,
    });
  } else {
    checks.push({
      id: "env_staging_ref",
      category: "environment_identity",
      titleKo: "Staging 프로젝트 식별",
      status: "warn",
      factKind: "skipped",
      detailKo:
        "SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL 없음 — 로컬 static 허용 · live probe 전 필수",
    });
  }

  const hasUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasAnon = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  checks.push({
    id: "env_public_keys_presence",
    category: "environment_identity",
    titleKo: "공개 Supabase 설정 존재 여부",
    status: hasUrl && hasAnon ? "pass" : "warn",
    factKind: "verified",
    detailKo:
      hasUrl && hasAnon
        ? "NEXT_PUBLIC_SUPABASE_URL · ANON_KEY 존재 (값 미출력)"
        : "공개 URL/anon 키 미설정 — 로컬 static 가능 · readonly probe 불가",
  });

  // --- health ---
  const healthExists = options.fileExists(HEALTH_ROUTE);
  checks.push({
    id: "health_route_present",
    category: "health",
    titleKo: "헬스 라우트 존재",
    status: healthExists ? "pass" : "fail",
    factKind: "verified",
    detailKo: healthExists
      ? "GET /api/health 소스 존재"
      : "src/app/api/health/route.ts 없음",
    evidencePaths: [HEALTH_ROUTE],
  });

  if (healthExists) {
    const healthSrc = options.readFile(HEALTH_ROUTE);
    const hasProbe = /from\(["']products["']\)/.test(healthSrc);
    const hasPresence = /getEnvPresenceReport|requiredConfigPresent/.test(
      healthSrc
    );
    checks.push({
      id: "health_contract",
      category: "health",
      titleKo: "헬스 계약 (설정·products probe)",
      status: hasProbe && hasPresence ? "pass" : "fail",
      factKind: "verified",
      detailKo:
        hasProbe && hasPresence
          ? "환경 presence + products SELECT head probe 계약 확인"
          : "헬스 라우트 계약 마커 부족",
      evidencePaths: [HEALTH_ROUTE],
    });
  }

  checks.push({
    id: "health_live_status",
    category: "health",
    titleKo: "라이브 헬스 응답",
    status: "unknown",
    factKind: "skipped",
    detailKo:
      "static 모드 — BASE_URL로 readonly 모드 실행 시 /api/health 확인 가능",
  });

  // --- tables / contracts ---
  for (const table of EXPECTED_STAGING_TABLES) {
    checks.push({
      id: `table_contract_${table}`,
      category: "tables_contracts",
      titleKo: `테이블 계약: ${table}`,
      status: "pass",
      factKind: "verified",
      detailKo: `기대 테이블 목록에 포함 (${table}) — 원격 존재는 Dashboard/readonly probe`,
    });
  }

  checks.push({
    id: "tables_live_presence",
    category: "tables_contracts",
    titleKo: "원격 테이블 존재 (SELECT)",
    status: "unknown",
    factKind: "dashboard_only_unknown",
    detailKo:
      "Supabase Table Editor 또는 readonly 모드 SELECT head로만 확인 — static은 미검증",
  });

  // --- auth callback ---
  const authExists = options.fileExists(AUTH_CALLBACK_ROUTE);
  const safeNextExists = options.fileExists(SAFE_NEXT_MODULE);
  checks.push({
    id: "auth_callback_route",
    category: "auth_callback",
    titleKo: "Auth callback 라우트",
    status: authExists ? "pass" : "fail",
    factKind: "verified",
    detailKo: authExists
      ? "/auth/callback 소스 존재"
      : "auth callback 라우트 없음",
    evidencePaths: [AUTH_CALLBACK_ROUTE],
  });

  if (authExists) {
    const authSrc = options.readFile(AUTH_CALLBACK_ROUTE);
    const missingInputs = AUTH_CALLBACK_INPUTS.filter(
      (name) => !authSrc.includes(name)
    );
    checks.push({
      id: "auth_callback_inputs",
      category: "auth_callback",
      titleKo: "Auth callback 입력 파라미터",
      status: missingInputs.length === 0 ? "pass" : "fail",
      factKind: "verified",
      detailKo:
        missingInputs.length === 0
          ? `입력 계약 확인: ${AUTH_CALLBACK_INPUTS.join(", ")}`
          : `누락: ${missingInputs.join(", ")}`,
      evidencePaths: [AUTH_CALLBACK_ROUTE],
    });

    const hasOtp = /verifyOtp/.test(authSrc);
    const hasExchange = /exchangeCodeForSession/.test(authSrc);
    checks.push({
      id: "auth_callback_flows",
      category: "auth_callback",
      titleKo: "Auth callback 흐름 (OTP·PKCE)",
      status: hasOtp && hasExchange ? "pass" : "fail",
      factKind: "verified",
      detailKo:
        hasOtp && hasExchange
          ? "token_hash verifyOtp + code exchangeCodeForSession"
          : "OTP/PKCE 흐름 마커 부족",
      evidencePaths: [AUTH_CALLBACK_ROUTE],
    });
  }

  checks.push({
    id: "auth_safe_next",
    category: "auth_callback",
    titleKo: "open redirect 차단 (safe-next)",
    status: safeNextExists ? "pass" : "fail",
    factKind: "verified",
    detailKo: safeNextExists
      ? "sanitizeNextPath 모듈 존재"
      : "safe-next 모듈 없음",
    evidencePaths: [SAFE_NEXT_MODULE],
  });

  checks.push({
    id: "auth_dashboard_redirect_urls",
    category: "auth_callback",
    titleKo: "Dashboard Redirect URL 등록",
    status: "unknown",
    factKind: "dashboard_only_unknown",
    detailKo:
      "Supabase Auth → Redirect URLs에 Staging origin + /auth/callback 등록은 Dashboard 전용 · 코드로 위장 완료 금지",
  });

  // --- storage ---
  checks.push({
    id: "storage_care_photos_bucket_name",
    category: "storage",
    titleKo: "care-photos 버킷 이름 계약",
    status: "pass",
    factKind: "verified",
    detailKo: `코드 상수 CARE_PHOTO_BUCKET=${CARE_PHOTO_BUCKET}`,
  });

  const carePhotoDraft = DRAFT_MIGRATIONS.find((d) => d.topic === CARE_PHOTO_BUCKET);
  if (carePhotoDraft) {
    const draftPresent = options.fileExists(carePhotoDraft.path);
    checks.push({
      id: "storage_care_photos_draft",
      category: "storage",
      titleKo: "care-photos DRAFT migration 존재",
      status: draftPresent ? "pass" : "fail",
      factKind: "verified",
      detailKo: draftPresent
        ? "DRAFT 파일 존재 · Staging 미적용으로 기록 (승인 전)"
        : "DRAFT_DO_NOT_APPLY_care_photo_comparison.sql 없음",
      evidencePaths: [carePhotoDraft.path],
    });
  }

  checks.push({
    id: "storage_care_photos_live",
    category: "storage",
    titleKo: "care-photos Storage 실버킷",
    status: "unknown",
    factKind: "dashboard_only_unknown",
    detailKo:
      "Staging Storage에 care-photos 생성 여부는 Dashboard/승인 후 적용 · 현재 미검증·미주장",
  });

  // --- publication states ---
  checks.push({
    id: "publication_pipeline_states",
    category: "publication_states",
    titleKo: "제품 게시 파이프라인 상태",
    status: "pass",
    factKind: "verified",
    detailKo: `계약 상태: ${PUBLICATION_PIPELINE_STATES.join(" → ")} · published만 핵심 추천`,
  });

  const pipelineCfgExists = options.fileExists(PIPELINE_OPERATION_CONFIG);
  if (pipelineCfgExists) {
    try {
      const raw = options.readFile(PIPELINE_OPERATION_CONFIG);
      const cfg = JSON.parse(raw) as Record<string, unknown>;
      const bad = DESTRUCTIVE_PIPELINE_FLAGS.filter((k) => cfg[k] !== false);
      checks.push({
        id: "publication_pipeline_flags",
        category: "publication_states",
        titleKo: "파이프라인 파괴적 플래그 OFF",
        status: bad.length === 0 ? "pass" : "fail",
        factKind: "verified",
        detailKo:
          bad.length === 0
            ? "allowDelete/allowPublish 등 파괴 플래그 전부 false"
            : `true/누락: ${bad.join(", ")}`,
        evidencePaths: [PIPELINE_OPERATION_CONFIG],
      });
    } catch {
      checks.push({
        id: "publication_pipeline_flags",
        category: "publication_states",
        titleKo: "파이프라인 파괴적 플래그 OFF",
        status: "fail",
        factKind: "verified",
        detailKo: "pipeline-operation.json 파싱 실패",
        evidencePaths: [PIPELINE_OPERATION_CONFIG],
      });
    }
  } else {
    checks.push({
      id: "publication_pipeline_flags",
      category: "publication_states",
      titleKo: "파이프라인 파괴적 플래그 OFF",
      status: "fail",
      factKind: "verified",
      detailKo: "config/pipeline-operation.json 없음",
      evidencePaths: [PIPELINE_OPERATION_CONFIG],
    });
  }

  checks.push({
    id: "publication_live_counts",
    category: "publication_states",
    titleKo: "원격 published / recommendation_ready 집계",
    status: "unknown",
    factKind: "dashboard_only_unknown",
    detailKo:
      "Staging 행 수·게시 상태는 Dashboard 또는 승인된 SELECT-only 스크립트로만 확인",
  });

  // --- migrations ---
  for (const rel of EXPECTED_DATED_MIGRATIONS) {
    const present = options.fileExists(rel);
    checks.push({
      id: `migration_file_${rel.split("/").pop()}`,
      category: "migrations",
      titleKo: `dated migration: ${rel.split("/").pop()}`,
      status: present ? "pass" : "fail",
      factKind: "verified",
      detailKo: present ? "저장소에 존재" : "저장소에 없음",
      evidencePaths: [rel],
    });
  }

  for (const draft of DRAFT_MIGRATIONS) {
    const present = options.fileExists(draft.path);
    checks.push({
      id: `migration_draft_${draft.topic}`,
      category: "migrations",
      titleKo: `DRAFT migration: ${draft.topic}`,
      status: present ? "pass" : "fail",
      factKind: "verified",
      detailKo: present
        ? "DRAFT 존재 · 적용 여부는 Dashboard 전용 (미적용으로 가정)"
        : `DRAFT 없음: ${draft.path}`,
      evidencePaths: [draft.path],
    });
  }

  checks.push({
    id: "migration_applied_history",
    category: "migrations",
    titleKo: "Staging 적용 이력 (supabase_migrations)",
    status: "unknown",
    factKind: "dashboard_only_unknown",
    detailKo:
      "어떤 dated migration이 Staging에 적용됐는지는 Dashboard/SQL history로만 확인",
  });

  const summary = summarizeChecks(checks);
  const isProductionBlocked = identity.isProduction;

  return {
    taskId: STAGING_RELEASE_GATE_TASK_ID,
    mode: "static",
    generatedAt: options.now ?? new Date().toISOString(),
    projectRefMasked: identity.projectRefMasked,
    isStagingIdentity: identity.isStaging && !identity.isProduction,
    isProductionBlocked,
    writeAttempted: false,
    checks,
    summary,
    ok: reportIsOk(checks, isProductionBlocked),
  };
}

/**
 * Merge optional live read-only probe outcomes into a static report.
 * Callers must ensure Production is already blocked and probes are SELECT-only.
 */
export function mergeReadonlyProbeResults(
  base: StagingReleaseGateReport,
  probes: {
    healthOk?: boolean | null;
    tablesFound?: Partial<Record<(typeof EXPECTED_STAGING_TABLES)[number], boolean>>;
  }
): StagingReleaseGateReport {
  if (base.isProductionBlocked) {
    return { ...base, mode: "readonly", writeAttempted: false };
  }

  const checks = base.checks.map((c) => ({ ...c }));

  const replace = (
    id: string,
    patch: Partial<GateCheckResult>
  ): void => {
    const idx = checks.findIndex((c) => c.id === id);
    if (idx >= 0) checks[idx] = { ...checks[idx]!, ...patch };
  };

  if (probes.healthOk === true) {
    replace("health_live_status", {
      status: "pass",
      factKind: "verified",
      detailKo: "라이브 /api/health ok (읽기 전용)",
    });
  } else if (probes.healthOk === false) {
    replace("health_live_status", {
      status: "fail",
      factKind: "verified",
      detailKo: "라이브 /api/health 실패 또는 degraded",
    });
  } else if (probes.healthOk === null) {
    replace("health_live_status", {
      status: "warn",
      factKind: "skipped",
      detailKo: "BASE_URL 없음 — 라이브 헬스 생략",
    });
  }

  if (probes.tablesFound) {
    const entries = Object.entries(probes.tablesFound);
    const missing = entries.filter(([, v]) => v === false).map(([k]) => k);
    const found = entries.filter(([, v]) => v === true).map(([k]) => k);
    replace("tables_live_presence", {
      status: missing.length === 0 && found.length > 0 ? "pass" : missing.length ? "fail" : "unknown",
      factKind: found.length || missing.length ? "verified" : "dashboard_only_unknown",
      detailKo:
        missing.length === 0 && found.length > 0
          ? `SELECT head 확인: ${found.join(", ")}`
          : missing.length
            ? `미확인/부재: ${missing.join(", ")}`
            : "테이블 probe 결과 없음",
    });
  }

  const summary = summarizeChecks(checks);
  return {
    ...base,
    mode: "readonly",
    writeAttempted: false,
    checks,
    summary,
    ok: reportIsOk(checks, base.isProductionBlocked),
  };
}

export function assertContractIntegrity(options: {
  fileExists: FileExistsFn;
}): string[] {
  const errors: string[] = [];
  if (STAGING_RELEASE_GATE_TASK_ID !== "P2-T02") {
    errors.push("task id must be P2-T02");
  }
  const stagingRef: string = KNOWN_STAGING_SUPABASE_REF;
  const productionRef: string = KNOWN_PRODUCTION_SUPABASE_REF;
  if (stagingRef === productionRef) {
    errors.push("staging and production refs must differ");
  }
  if (EXPECTED_STAGING_TABLES.length < 4) {
    errors.push("expected tables too few");
  }
  if (PUBLICATION_PIPELINE_STATES[PUBLICATION_PIPELINE_STATES.length - 1] !== "published") {
    errors.push("pipeline must end with published");
  }
  if (CARE_PHOTO_BUCKET !== "care-photos") {
    errors.push("CARE_PHOTO_BUCKET mismatch");
  }
  for (const rel of EXPECTED_DATED_MIGRATIONS) {
    if (!options.fileExists(rel)) errors.push(`missing migration: ${rel}`);
  }
  for (const draft of DRAFT_MIGRATIONS) {
    if (!options.fileExists(draft.path)) errors.push(`missing draft: ${draft.path}`);
  }
  if (!options.fileExists(AUTH_CALLBACK_ROUTE)) {
    errors.push(`missing ${AUTH_CALLBACK_ROUTE}`);
  }
  if (!options.fileExists(HEALTH_ROUTE)) {
    errors.push(`missing ${HEALTH_ROUTE}`);
  }
  if (!options.fileExists(SAFE_NEXT_MODULE)) {
    errors.push(`missing ${SAFE_NEXT_MODULE}`);
  }
  if (!options.fileExists(PIPELINE_OPERATION_CONFIG)) {
    errors.push(`missing ${PIPELINE_OPERATION_CONFIG}`);
  }
  return errors;
}

export function formatReportMarkdown(report: StagingReleaseGateReport): string {
  const lines: string[] = [
    `# Staging Release Gate — ${report.taskId}`,
    "",
    `- mode: \`${report.mode}\``,
    `- ok: **${report.ok}**`,
    `- projectRefMasked: \`${report.projectRefMasked ?? "n/a"}\``,
    `- isStagingIdentity: ${report.isStagingIdentity}`,
    `- isProductionBlocked: ${report.isProductionBlocked}`,
    `- writeAttempted: ${report.writeAttempted}`,
    `- generatedAt: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `| pass | fail | warn | unknown | dashboard_only_unknown |`,
    `|-----:|-----:|-----:|--------:|-----------------------:|`,
    `| ${report.summary.pass} | ${report.summary.fail} | ${report.summary.warn} | ${report.summary.unknown} | ${report.summary.dashboardOnlyUnknown} |`,
    "",
    "## Checks",
    "",
  ];

  for (const c of report.checks) {
    lines.push(
      `### ${c.id} · ${c.status} · ${c.factKind}`,
      "",
      `- category: ${c.category}`,
      `- ${c.titleKo}`,
      `- ${c.detailKo}`,
      ""
    );
  }

  lines.push(
    "## Honesty",
    "",
    "- `dashboard_only_unknown`은 Dashboard에서만 확인 가능 — 통과로 위장 금지",
    "- Production 쓰기·migration apply·Storage 생성은 이 게이트 범위 밖",
    ""
  );

  return lines.join("\n");
}
