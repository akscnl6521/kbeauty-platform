/**
 * P2-T01 — Automated Preview / local route validation contract.
 *
 * Machine-readable expectations for public routes, auth-safe redirects,
 * admin review entry, loading/empty/error markers, and viewport sizes.
 * Screenshots are evidence only — never claim visual approval.
 */

export const PREVIEW_ROUTE_TASK_ID = "P2-T01" as const;

export const PREVIEW_VIEWPORTS = [
  { id: "mobile-sm", width: 320, height: 720 },
  { id: "mobile", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1440, height: 900 },
] as const;

export type PreviewViewport = (typeof PREVIEW_VIEWPORTS)[number];

export type RouteAccess =
  | "public"
  | "customer_auth"
  | "admin_auth"
  | "public_admin_auth";

export type HttpExpectation = {
  /** Accepted HTTP statuses when unauthenticated (redirect: manual). */
  statuses: readonly number[];
  /** Optional Location substring for auth redirects. */
  locationIncludes?: string;
};

export type PreviewRouteCase = {
  id: string;
  path: string;
  /** App Router page or route file relative to repo root. */
  sourceFile: string;
  access: RouteAccess;
  group:
    | "public"
    | "analyze"
    | "results"
    | "routine"
    | "profile_guidance"
    | "admin_review"
    | "auth_api";
  httpUnauthenticated: HttpExpectation;
  /** Capture screenshots in browser mode when reachable. */
  screenshot: boolean;
  notes?: string;
};

/**
 * Core journey + entry points for repeatable Preview/local validation.
 * Auth pages under /admin/login stay public to avoid redirect loops.
 */
export const PREVIEW_ROUTE_CASES: readonly PreviewRouteCase[] = [
  {
    id: "home",
    path: "/",
    sourceFile: "src/app/page.tsx",
    access: "public",
    group: "public",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
  },
  {
    id: "analyze",
    path: "/analyze",
    sourceFile: "src/app/analyze/page.tsx",
    access: "public",
    group: "analyze",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
  },
  {
    id: "results",
    path: "/results",
    sourceFile: "src/app/results/page.tsx",
    access: "public",
    group: "results",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
    notes: "Client empty/loading when no stored recommendation",
  },
  {
    id: "routine",
    path: "/routine",
    sourceFile: "src/app/routine/page.tsx",
    access: "public",
    group: "routine",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
  },
  {
    id: "login",
    path: "/login",
    sourceFile: "src/app/login/page.tsx",
    access: "public",
    group: "public",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
  },
  {
    id: "privacy",
    path: "/privacy",
    sourceFile: "src/app/privacy/page.tsx",
    access: "public",
    group: "public",
    httpUnauthenticated: { statuses: [200] },
    screenshot: false,
  },
  {
    id: "my_home",
    path: "/my",
    sourceFile: "src/app/my/page.tsx",
    access: "customer_auth",
    group: "profile_guidance",
    httpUnauthenticated: {
      statuses: [302, 303, 307, 308],
      locationIncludes: "/login",
    },
    screenshot: true,
    notes: "my/layout redirects unauthenticated users to /login?next=%2Fmy",
  },
  {
    id: "my_profile",
    path: "/my/profile",
    sourceFile: "src/app/my/profile/page.tsx",
    access: "customer_auth",
    group: "profile_guidance",
    httpUnauthenticated: {
      statuses: [302, 303, 307, 308],
      locationIncludes: "/login",
    },
    screenshot: true,
  },
  {
    id: "my_guidance",
    path: "/my/guidance",
    sourceFile: "src/app/my/guidance/page.tsx",
    access: "customer_auth",
    group: "profile_guidance",
    httpUnauthenticated: {
      statuses: [302, 303, 307, 308],
      locationIncludes: "/login",
    },
    screenshot: true,
  },
  {
    id: "onboarding",
    path: "/onboarding",
    sourceFile: "src/app/onboarding/page.tsx",
    access: "customer_auth",
    group: "profile_guidance",
    httpUnauthenticated: {
      // proxy redirects when NEXT_PUBLIC_SUPABASE_* present; otherwise page may 200
      statuses: [200, 302, 303, 307, 308],
      locationIncludes: undefined,
    },
    screenshot: false,
    notes:
      "Auth-safe when proxy env present (→ /login). Without public Supabase env, proxy skips redirect.",
  },
  {
    id: "admin_review",
    path: "/admin/review",
    sourceFile: "src/app/admin/review/page.tsx",
    access: "admin_auth",
    group: "admin_review",
    httpUnauthenticated: {
      statuses: [302, 303, 307, 308],
      locationIncludes: "/admin/login",
    },
    screenshot: true,
    notes: "Admin review entry — unauthenticated → /admin/login",
  },
  {
    id: "admin_login",
    path: "/admin/login",
    sourceFile: "src/app/admin/login/page.tsx",
    access: "public_admin_auth",
    group: "admin_review",
    httpUnauthenticated: { statuses: [200] },
    screenshot: true,
  },
  {
    id: "admin_clinics",
    path: "/admin/clinics",
    sourceFile: "src/app/admin/clinics/page.tsx",
    access: "admin_auth",
    group: "admin_review",
    httpUnauthenticated: {
      statuses: [302, 303, 307, 308],
      locationIncludes: "/admin/login",
    },
    screenshot: false,
  },
  {
    id: "api_health",
    path: "/api/health",
    sourceFile: "src/app/api/health/route.ts",
    access: "public",
    group: "auth_api",
    httpUnauthenticated: { statuses: [200, 503] },
    screenshot: false,
    notes: "503 allowed when dependencies degraded; connection failure is still a fail",
  },
  {
    id: "api_admin_dashboard",
    path: "/api/admin/dashboard",
    sourceFile: "src/app/api/admin/dashboard/route.ts",
    access: "admin_auth",
    group: "auth_api",
    httpUnauthenticated: { statuses: [401] },
    screenshot: false,
  },
  {
    id: "api_care_dashboard",
    path: "/api/care/dashboard",
    sourceFile: "src/app/api/care/dashboard/route.ts",
    access: "customer_auth",
    group: "auth_api",
    httpUnauthenticated: { statuses: [401] },
    screenshot: false,
  },
] as const;

/** Source markers for loading / empty / error UX (static inventory). */
export type UiStateMarker = {
  id: string;
  file: string;
  needles: readonly string[];
  state: "loading" | "empty" | "error" | "status";
};

export const UI_STATE_MARKERS: readonly UiStateMarker[] = [
  {
    id: "usage_guide_empty_status",
    file: "src/components/usage/ProductUsageGuide.tsx",
    needles: ['role="status"', "empty"],
    state: "empty",
  },
  {
    id: "photo_assets_loading_busy",
    file: "src/components/care/PhotoAssetsSettingsPanel.tsx",
    needles: ['role="status"', 'aria-busy="true"'],
    state: "loading",
  },
  {
    id: "results_loading_branch",
    file: "src/app/results/page.tsx",
    needles: ["if (loading)", "if (error)"],
    state: "loading",
  },
  {
    id: "results_error_branch",
    file: "src/app/results/page.tsx",
    needles: ["text-red-600", "if (error)"],
    state: "error",
  },
  {
    id: "analyze_error_status",
    file: "src/app/analyze/page.tsx",
    needles: ["setError", 'role="status"'],
    state: "status",
  },
  {
    id: "profile_status",
    file: "src/app/my/profile/page.tsx",
    needles: ['role="status"'],
    state: "status",
  },
  {
    id: "admin_review_empty",
    file: "src/app/admin/review/page.tsx",
    needles: ["현재 검수할 예외가 없습니다", "연결 없음"],
    state: "empty",
  },
] as const;

export type PreviewValidationMode = "static" | "http" | "browser";

export type RouteCheckResult = {
  id: string;
  path: string;
  ok: boolean;
  mode: PreviewValidationMode | "inventory";
  status?: number;
  location?: string | null;
  detail?: string;
};

export type ViewportCheckResult = {
  viewportId: string;
  width: number;
  height: number;
  routeId: string;
  path: string;
  ok: boolean;
  screenshotRelPath?: string;
  detail?: string;
};

export type PreviewRouteValidationReport = {
  taskId: typeof PREVIEW_ROUTE_TASK_ID;
  generatedAt: string;
  /** Always false — automation never claims human visual approval. */
  visualApprovalClaimed: false;
  baseUrl: string | null;
  modesRun: PreviewValidationMode[];
  browserAvailable: boolean;
  summary: {
    inventoryPassed: boolean;
    httpPassed: boolean | null;
    browserPassed: boolean | null;
    routeChecks: number;
    routeFailures: number;
    viewportChecks: number;
    screenshots: number;
  };
  routes: RouteCheckResult[];
  uiStateMarkers: Array<{ id: string; ok: boolean; detail?: string }>;
  viewports: ViewportCheckResult[];
  notes: string[];
};

export function createEmptyReport(
  partial?: Partial<PreviewRouteValidationReport>,
): PreviewRouteValidationReport {
  return {
    taskId: PREVIEW_ROUTE_TASK_ID,
    generatedAt: new Date().toISOString(),
    visualApprovalClaimed: false,
    baseUrl: null,
    modesRun: [],
    browserAvailable: false,
    summary: {
      inventoryPassed: false,
      httpPassed: null,
      browserPassed: null,
      routeChecks: 0,
      routeFailures: 0,
      viewportChecks: 0,
      screenshots: 0,
    },
    routes: [],
    uiStateMarkers: [],
    viewports: [],
    notes: [
      "Screenshots and HTTP checks are evidence only — not visual QA approval.",
      "Preview SSO / CAPTCHA / login bypass is forbidden.",
    ],
    ...partial,
  };
}

export function routesByGroup(group: PreviewRouteCase["group"]): PreviewRouteCase[] {
  return PREVIEW_ROUTE_CASES.filter((r) => r.group === group);
}

export function screenshotRoutes(): PreviewRouteCase[] {
  return PREVIEW_ROUTE_CASES.filter((r) => r.screenshot);
}

export function assertContractIntegrity(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  if (PREVIEW_VIEWPORTS.length !== 4) {
    errors.push("PREVIEW_VIEWPORTS must define exactly 4 sizes");
  }
  const widths = PREVIEW_VIEWPORTS.map((v) => v.width).sort((a, b) => a - b);
  if (widths.join(",") !== "320,390,768,1440") {
    errors.push("viewport widths must be 320,390,768,1440");
  }

  for (const route of PREVIEW_ROUTE_CASES) {
    if (ids.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    ids.add(route.id);
    if (paths.has(route.path)) errors.push(`duplicate path: ${route.path}`);
    paths.add(route.path);
    if (!route.path.startsWith("/")) errors.push(`${route.id}: path must start with /`);
    if (!route.sourceFile.startsWith("src/")) {
      errors.push(`${route.id}: sourceFile must be under src/`);
    }
    if (!route.httpUnauthenticated.statuses.length) {
      errors.push(`${route.id}: statuses required`);
    }
    if (
      (route.access === "customer_auth" || route.access === "admin_auth") &&
      route.path !== "/onboarding" &&
      route.httpUnauthenticated.statuses.every((s) => s === 200)
    ) {
      errors.push(`${route.id}: auth routes must not expect bare 200 unauthenticated`);
    }
  }

  const requiredGroups: PreviewRouteCase["group"][] = [
    "public",
    "analyze",
    "results",
    "routine",
    "profile_guidance",
    "admin_review",
  ];
  for (const g of requiredGroups) {
    if (!PREVIEW_ROUTE_CASES.some((r) => r.group === g)) {
      errors.push(`missing route group: ${g}`);
    }
  }

  return errors;
}
