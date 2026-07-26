/**
 * P2-T05 — Final Preview evidence and human approval package.
 *
 * Separates Phase 2 evidence into honest buckets. Automated selftests may be
 * `verified_complete`; screenshots / device / external sources / Dashboard /
 * main·Production gates must never be claimed as agent-approved.
 */

export type Phase2EvidenceBucketId =
  | "automated_tests_build_routes"
  | "screenshots_visual_review"
  | "device_android_iphone"
  | "external_source_approval"
  | "dashboard_only_settings"
  | "main_production_gates";

export type Phase2EvidenceClass =
  | "verified_complete"
  | "partial"
  | "external_only"
  | "dashboard_only_unknown"
  | "deferred"
  | "blocked";

export type Phase2AutomatedCommand = {
  id: string;
  npmScript: string;
  titleKo: string;
  /** Whether this command is part of the default Phase 2 regression suite. */
  requiredForPhase2Gate: boolean;
  /**
   * Direct runner without nested `npm` (avoids ENOENT on WSL/Windows PATH).
   * argv[0] is the node runtime; remaining args are passed to node.
   */
  nodeArgs: readonly string[];
};

export type Phase2EvidenceItem = {
  id: string;
  titleKo: string;
  classification: Phase2EvidenceClass;
  notesKo: string;
  relatedPaths?: readonly string[];
  relatedCommands?: readonly string[];
};

export type Phase2EvidenceBucket = {
  id: Phase2EvidenceBucketId;
  titleKo: string;
  purposeKo: string;
  /** Agent may mark items verified only when classification allows. */
  agentMayMarkVerified: boolean;
  items: readonly Phase2EvidenceItem[];
};

export type HumanVerificationStep = {
  id: string;
  onceOnly: true;
  titleKo: string;
  whereKo: string;
  checkKo: string;
  passCriteriaKo: string;
  failActionKo: string;
  relatedExternalIds: readonly string[];
};

/** Phase 2 automated suite (P2-T01…T04 + T06 + security). */
export const PHASE2_AUTOMATED_COMMANDS: readonly Phase2AutomatedCommand[] = [
  {
    id: "preview_routes",
    npmScript: "test:preview-routes",
    titleKo: "P2-T01 Preview/라우트 계약 selftest",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/preview-route-validation-selftest.ts"],
  },
  {
    id: "staging_release_gate",
    npmScript: "test:staging-release-gate",
    titleKo: "P2-T02 Staging 릴리스 게이트 selftest",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/staging-release-gate-selftest.ts"],
  },
  {
    id: "admin_review_e2e",
    npmScript: "test:admin-review-e2e",
    titleKo: "P2-T03 Admin review E2E selftest",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/admin-review-e2e-selftest.ts"],
  },
  {
    id: "real_data_onboarding",
    npmScript: "test:real-data-onboarding",
    titleKo: "P2-T04 실데이터 온보딩 selftest",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/real-data-onboarding-selftest.ts"],
  },
  {
    id: "final_integration",
    npmScript: "test:final-integration",
    titleKo: "T06 최종 통합·릴리스 증거",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/final-integration-release-selftest.ts"],
  },
  {
    id: "autopilot_queue",
    npmScript: "test:autopilot-queue",
    titleKo: "Autopilot 계약·큐 무결성",
    requiredForPhase2Gate: true,
    nodeArgs: ["--import", "tsx", "scripts/autopilot-queue-selftest.ts"],
  },
  {
    id: "release_security",
    npmScript: "check:release-security",
    titleKo: "릴리스 보안 점검",
    requiredForPhase2Gate: true,
    nodeArgs: ["scripts/security-release-check.mjs"],
  },
  {
    id: "production_build",
    npmScript: "build",
    titleKo: "production build (env placeholder)",
    requiredForPhase2Gate: true,
    nodeArgs: ["node_modules/next/dist/bin/next", "build"],
  },
] as const;

export const PHASE2_EVIDENCE_BUCKETS: readonly Phase2EvidenceBucket[] = [
  {
    id: "automated_tests_build_routes",
    titleKo: "자동 테스트·빌드·라우트",
    purposeKo:
      "로컬 selftest·라우트 인벤토리·보안 체크로 Phase 2 코드 회귀를 확인한다.",
    agentMayMarkVerified: true,
    items: [
      {
        id: "p2_t01_contract",
        titleKo: "P2-T01 라우트 계약·인벤토리",
        classification: "verified_complete",
        notesKo: "test:preview-routes · visualApprovalClaimed=false 유지",
        relatedPaths: [
          "src/lib/validation/previewRouteValidation.ts",
          "docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md",
        ],
        relatedCommands: ["test:preview-routes", "check:preview-routes"],
      },
      {
        id: "p2_t02_contract",
        titleKo: "P2-T02 Staging 읽기 전용 게이트",
        classification: "verified_complete",
        notesKo: "static selftest · Production 식별 시 중단 · 쓰기 없음",
        relatedPaths: [
          "src/lib/release/stagingReleaseGate.ts",
          "docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md",
        ],
        relatedCommands: [
          "test:staging-release-gate",
          "check:staging-release-gate",
        ],
      },
      {
        id: "p2_t03_contract",
        titleKo: "P2-T03 Admin review E2E",
        classification: "verified_complete",
        notesKo: "fixture 비공개 · Organic 독립 · writeAttempted=false",
        relatedPaths: [
          "src/lib/admin/adminReviewE2E.ts",
          "docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md",
        ],
        relatedCommands: ["test:admin-review-e2e"],
      },
      {
        id: "p2_t04_contract",
        titleKo: "P2-T04 실데이터 온보딩 준비",
        classification: "verified_complete",
        notesKo: "dry-run·거절 사유 · 비공개 fixture · Production 쓰기 없음",
        relatedPaths: [
          "src/lib/onboarding/realDataOnboarding/index.ts",
          "docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md",
        ],
        relatedCommands: ["test:real-data-onboarding"],
      },
      {
        id: "t06_integration",
        titleKo: "T06 여정 통합·a11y·landmark OFF",
        classification: "verified_complete",
        notesKo: "코드 연결·selftest · Preview/실기기 위장 없음",
        relatedPaths: [
          "src/lib/release/finalIntegrationEvidence.ts",
          "docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md",
        ],
        relatedCommands: ["test:final-integration"],
      },
      {
        id: "release_security",
        titleKo: "릴리스 보안 점검",
        classification: "verified_complete",
        notesKo: "check:release-security · 비밀키 출력 금지",
        relatedCommands: ["check:release-security"],
      },
      {
        id: "production_build",
        titleKo: "production build (env placeholder)",
        classification: "verified_complete",
        notesKo: "실키 없이 build · check:phase2-final-evidence에 포함",
        relatedCommands: ["build"],
      },
    ],
  },
  {
    id: "screenshots_visual_review",
    titleKo: "스크린샷·육안 검수 대기",
    purposeKo:
      "자동 스크린샷은 증거일 뿐이며 Preview 육안 승인으로 위장하지 않는다.",
    agentMayMarkVerified: false,
    items: [
      {
        id: "viewport_screenshots",
        titleKo: "viewport 320/390/768/1440 스크린샷",
        classification: "external_only",
        notesKo:
          "browser 모드 아티팩트 가능 · visualApprovalClaimed=false · 사람 육안 필요",
        relatedPaths: ["artifacts/preview-route-validation/screenshots"],
        relatedCommands: ["check:preview-routes"],
      },
      {
        id: "p0_003_preview",
        titleKo: "P0-003 / P1-003 Preview 추천·CTA·빈 상태 육안",
        classification: "external_only",
        notesKo: "사람 · 콘솔 주입 검수 중단 · QA 페이지 미포함",
      },
      {
        id: "admin_preview_login",
        titleKo: "Preview 관리자 로그인 후 Staging 미디어 육안",
        classification: "external_only",
        notesKo: "SSO/로그인 우회 금지 · 에이전트 단독 불가",
      },
    ],
  },
  {
    id: "device_android_iphone",
    titleKo: "Android Chrome · iPhone Safari",
    purposeKo: "실기기 수동 촬영·터치 UX는 사람만 완료할 수 있다.",
    agentMayMarkVerified: false,
    items: [
      {
        id: "p1_005_android",
        titleKo: "P1-005 Android Chrome 수동 3각도 촬영",
        classification: "external_only",
        notesKo: "실기기 · Phase 3.0 기본 UX · landmark OFF",
      },
      {
        id: "p1_005_iphone",
        titleKo: "P1-005 iPhone Safari 수동 3각도 촬영",
        classification: "external_only",
        notesKo: "실기기 · 320px 포함",
      },
      {
        id: "phase31_device",
        titleKo: "Phase 3.1 실기기 재개 조건",
        classification: "deferred",
        notesKo: "Android blocker · flag 기본 OFF · 자동촬영 재개 금지",
      },
    ],
  },
  {
    id: "external_source_approval",
    titleKo: "외부 출처 승인",
    purposeKo: "공식 병원·실제품·법무는 사람 승인 전 publishable로 위장 금지.",
    agentMayMarkVerified: false,
    items: [
      {
        id: "ex_04_clinic",
        titleKo: "공식 병원 실출처 → 검수 → publishable (T07)",
        classification: "external_only",
        notesKo: "fixture 게시 금지 · next_task T07",
      },
      {
        id: "ex_11_products",
        titleKo: "실공식 KR 제품·verified 구매 SKU",
        classification: "external_only",
        notesKo: "P2-T04 dry-run만 · live 출처 미연결",
      },
      {
        id: "p1_006_legal",
        titleKo: "P1-006 개인정보 전송 범위 정책·법무",
        classification: "external_only",
        notesKo: "앱 서버 일시 전송·영구 저장 없음 문구 최종 검수",
      },
    ],
  },
  {
    id: "dashboard_only_settings",
    titleKo: "Vercel·Supabase Dashboard 전용 설정",
    purposeKo:
      "Redirect URL·Storage 버킷·migration 적용 이력은 Dashboard에서만 확인.",
    agentMayMarkVerified: false,
    items: [
      {
        id: "auth_redirect_urls",
        titleKo: "Supabase Auth Redirect URL",
        classification: "dashboard_only_unknown",
        notesKo: "Staging 게이트에서 dashboard_only_unknown · 위장 통과 금지",
        relatedCommands: ["check:staging-release-gate"],
      },
      {
        id: "care_photos_bucket",
        titleKo: "care-photos Storage 버킷",
        classification: "dashboard_only_unknown",
        notesKo: "승인 대기 · Staging migration 미적용과 연계",
      },
      {
        id: "migration_history",
        titleKo: "Supabase migration 적용 이력",
        classification: "dashboard_only_unknown",
        notesKo: "beauty_profiles DRAFT · care-photos 미적용 유지",
      },
      {
        id: "vercel_preview_env",
        titleKo: "Vercel Preview 환경변수(대시보드)",
        classification: "dashboard_only_unknown",
        notesKo: "키 값 채팅·문서 기록 금지 · Production env 변경 금지",
      },
    ],
  },
  {
    id: "main_production_gates",
    titleKo: "main·Production 승인 게이트",
    purposeKo: "명시 승인 전 main 병합·Production 배포·DB/env 변경 금지.",
    agentMayMarkVerified: false,
    items: [
      {
        id: "wqg_p0_002",
        titleKo: "WQG-P0-002 Production AI_PROVIDER",
        classification: "external_only",
        notesKo: "RELEASE_GATE_PENDING · 배포 직전만 · 키 미기록",
      },
      {
        id: "main_merge",
        titleKo: "main 병합",
        classification: "blocked",
        notesKo: "명시 승인 전 금지 · 이번 번들 미실행",
      },
      {
        id: "production_deploy",
        titleKo: "Production 배포",
        classification: "blocked",
        notesKo: "명시 승인 전 금지 · 이번 번들 미실행",
      },
      {
        id: "production_db_env",
        titleKo: "Production DB·Storage·환경변수",
        classification: "blocked",
        notesKo: "명시 승인 전 금지 · 이번 번들 미실행",
      },
    ],
  },
] as const;

/** Exact one-time human verification instructions (Korean, click-position oriented). */
export const HUMAN_VERIFICATION_STEPS: readonly HumanVerificationStep[] = [
  {
    id: "hv_preview_visual",
    onceOnly: true,
    titleKo: "Preview 육안 (P0-003 / P1-003)",
    whereKo:
      "브라우저에서 최신 Preview 주소 열기 → `/analyze` → 결과 `/results` → `/routine`",
    checkKo:
      "추천 A/B/C 카드·구매 CTA·빈 상태 문구·사용 가이드 fallback이 과장·가짜 재고 없이 보이는지",
    passCriteriaKo:
      "빈 상태는 솔직히 비어 있고, CTA는 검증된 링크만, AI가 사진을 본다는 오인 문구 없음",
    failActionKo: "스크린샷과 경로를 남기고 feature 수정 요청 · Production 미진행",
    relatedExternalIds: ["p0_003_preview"],
  },
  {
    id: "hv_admin_preview",
    onceOnly: true,
    titleKo: "Preview 관리자 로그인 육안",
    whereKo: "Preview `/admin/login` → 정상 로그인 → `/admin/review` · `/admin/catalog/ops`",
    checkKo: "미승인·fixture 항목이 사용자 공개로 보이지 않는지 · 미디어 검수 화면 로드",
    passCriteriaKo: "로그인 우회 없이 검수 화면 진입 · fixture 비공개 유지",
    failActionKo: "권한/리다이렉트 문제를 기록 · SSO 우회 시도 금지",
    relatedExternalIds: ["admin_preview_login"],
  },
  {
    id: "hv_android_chrome",
    onceOnly: true,
    titleKo: "Android Chrome 실기기 (P1-005)",
    whereKo: "Android 폰 Chrome → Preview `/analyze` → 카메라 수동 촬영",
    checkKo: "정면·좌45·우45 안내·품질 메시지·갤러리 업로드 없음",
    passCriteriaKo: "수동 3각도 완료 가능 · landmark 자동촬영 기본 미동작",
    failActionKo: "기기·브라우저 버전·오류 화면을 기록 · Phase 3.1 재개 금지",
    relatedExternalIds: ["p1_005_android"],
  },
  {
    id: "hv_iphone_safari",
    onceOnly: true,
    titleKo: "iPhone Safari 실기기 (P1-005)",
    whereKo: "iPhone Safari → Preview `/analyze` → 카메라 수동 촬영 (좁은 폭 포함)",
    checkKo: "320px에 가까운 폭에서도 촬영 안내·버튼 터치 가능",
    passCriteriaKo: "수동 3각도 완료 · 레이아웃이 핵심 CTA를 가리지 않음",
    failActionKo: "기기·iOS·화면 폭을 기록 · Production 미진행",
    relatedExternalIds: ["p1_005_iphone"],
  },
  {
    id: "hv_dashboard_supabase",
    onceOnly: true,
    titleKo: "Supabase Dashboard 설정 1회 확인",
    whereKo: "Supabase Dashboard → Authentication → URL 설정 · Storage · Migrations",
    checkKo:
      "Staging Redirect URL·care-photos 버킷 존재 여부·beauty_profiles/care-photos 미적용 상태",
    passCriteriaKo:
      "확인 결과만 기록 · 값을 채팅에 붙여넣지 않음 · 승인 전 Production 변경 없음",
    failActionKo: "누락 항목을 dashboard_only로 남기고 승인 요청",
    relatedExternalIds: [
      "auth_redirect_urls",
      "care_photos_bucket",
      "migration_history",
    ],
  },
  {
    id: "hv_dashboard_vercel",
    onceOnly: true,
    titleKo: "Vercel Dashboard Preview 설정 1회 확인",
    whereKo: "Vercel → 해당 프로젝트 → Settings → Environment Variables (Preview)",
    checkKo: "Preview용 public URL/키가 있는지 · Production 값을 바꾸지 않았는지",
    passCriteriaKo: "키 값 미기록 · Production env 미변경",
    failActionKo: "누락만 표시하고 키를 채팅에 붙여 넣지 않음",
    relatedExternalIds: ["vercel_preview_env"],
  },
  {
    id: "hv_external_clinic",
    onceOnly: true,
    titleKo: "공식 병원 출처 승인 (T07)",
    whereKo: "공식 병원 출처 목록 승인 → 관리자 검수 → publishable 전환",
    checkKo: "fixture·마켓 단독·유료 API 출처가 섞이지 않았는지",
    passCriteriaKo: "승인된 공식 출처만 publishable · fixture 게시 0",
    failActionKo: "거절 사유 기록 · 가짜 병원 게시 금지",
    relatedExternalIds: ["ex_04_clinic"],
  },
  {
    id: "hv_legal_p1_006",
    onceOnly: true,
    titleKo: "P1-006 정책·법무 문구",
    whereKo: "앱 동의·분석 범위 문구 + 정책 문서",
    checkKo: "픽셀 외부 AI 미전송·영구 저장 없음·문진 기반 분석이 일치하는지",
    passCriteriaKo: "법무/정책 담당 확인 완료로만 표시 · 에이전트 단독 완료 금지",
    failActionKo: "문구 불일치 시 출시 보류",
    relatedExternalIds: ["p1_006_legal"],
  },
  {
    id: "hv_production_gate",
    onceOnly: true,
    titleKo: "Production 직전 게이트 (승인 후)",
    whereKo: "Production 배포 승인 직전 체크리스트 · Vercel/Supabase Production",
    checkKo: "AI_PROVIDER·main 병합·DB/env — 지금 실행하지 않음",
    passCriteriaKo: "RELEASE_GATE_PENDING 유지 · 명시 승인 전까지 미실행",
    failActionKo: "승인 없이 진행 시도 시 즉시 중단",
    relatedExternalIds: [
      "wqg_p0_002",
      "main_merge",
      "production_deploy",
      "production_db_env",
    ],
  },
] as const;

export type Phase2CommandRunResult = {
  commandId: string;
  npmScript: string;
  status: "pass" | "fail" | "skipped";
  exitCode: number | null;
  notesKo: string;
};

export type Phase2EvidencePackageReport = {
  taskId: "P2-T05";
  generatedAt: string;
  branchExpected: "feature/recommendation-usage-guide-display-20260720";
  writeAttempted: false;
  mainMergeAttempted: false;
  productionDeployAttempted: false;
  visualApprovalClaimed: false;
  deviceApprovalClaimed: false;
  dashboardSettingsClaimedVerified: false;
  releaseReadyClaimed: false;
  buckets: readonly Phase2EvidenceBucket[];
  humanVerificationSteps: readonly HumanVerificationStep[];
  automatedCommands: readonly Phase2AutomatedCommand[];
  commandResults: readonly Phase2CommandRunResult[];
  summary: {
    automatedRequired: number;
    automatedPassed: number;
    automatedFailed: number;
    automatedSkipped: number;
    externalOnlyItemCount: number;
    dashboardOnlyItemCount: number;
    blockedGateCount: number;
    humanStepCount: number;
  };
  honestyNotesKo: readonly string[];
};

export function countItemsByClass(
  classification: Phase2EvidenceClass
): number {
  return PHASE2_EVIDENCE_BUCKETS.reduce(
    (n, b) => n + b.items.filter((i) => i.classification === classification).length,
    0
  );
}

export function assertPhase2EvidenceHonesty(): void {
  for (const bucket of PHASE2_EVIDENCE_BUCKETS) {
    if (!bucket.agentMayMarkVerified) {
      for (const item of bucket.items) {
        if (item.classification === "verified_complete") {
          throw new Error(
            `bucket ${bucket.id} item ${item.id} must not be verified_complete`
          );
        }
      }
    }
  }
  for (const step of HUMAN_VERIFICATION_STEPS) {
    if (!step.onceOnly) {
      throw new Error(`human step ${step.id} must be onceOnly`);
    }
  }
  const required = PHASE2_AUTOMATED_COMMANDS.filter((c) => c.requiredForPhase2Gate);
  if (required.length < 6) {
    throw new Error("Phase 2 required automated commands incomplete");
  }
}

export function buildPhase2EvidencePackageReport(
  commandResults: readonly Phase2CommandRunResult[],
  generatedAt: string = new Date().toISOString()
): Phase2EvidencePackageReport {
  assertPhase2EvidenceHonesty();

  const requiredIds = new Set(
    PHASE2_AUTOMATED_COMMANDS.filter((c) => c.requiredForPhase2Gate).map(
      (c) => c.id
    )
  );
  const relevant = commandResults.filter((r) => requiredIds.has(r.commandId));
  const automatedPassed = relevant.filter((r) => r.status === "pass").length;
  const automatedFailed = relevant.filter((r) => r.status === "fail").length;
  const automatedSkipped = relevant.filter((r) => r.status === "skipped").length;

  return {
    taskId: "P2-T05",
    generatedAt,
    branchExpected: "feature/recommendation-usage-guide-display-20260720",
    writeAttempted: false,
    mainMergeAttempted: false,
    productionDeployAttempted: false,
    visualApprovalClaimed: false,
    deviceApprovalClaimed: false,
    dashboardSettingsClaimedVerified: false,
    releaseReadyClaimed: false,
    buckets: PHASE2_EVIDENCE_BUCKETS,
    humanVerificationSteps: HUMAN_VERIFICATION_STEPS,
    automatedCommands: PHASE2_AUTOMATED_COMMANDS,
    commandResults,
    summary: {
      automatedRequired: requiredIds.size,
      automatedPassed,
      automatedFailed,
      automatedSkipped,
      externalOnlyItemCount: countItemsByClass("external_only"),
      dashboardOnlyItemCount: countItemsByClass("dashboard_only_unknown"),
      blockedGateCount: countItemsByClass("blocked"),
      humanStepCount: HUMAN_VERIFICATION_STEPS.length,
    },
    honestyNotesKo: [
      "자동 스크린샷 ≠ Preview 육안 승인",
      "selftest 통과 ≠ 실기기 통과",
      "dry-run/fixture ≠ 공식 publishable",
      "dashboard_only_unknown ≠ 설정 확인 완료",
      "RELEASE_GATE_PENDING · main/Production 미실행",
      "출시 가능으로 보지 않음",
    ],
  };
}

export function formatPhase2EvidenceMarkdown(
  report: Phase2EvidencePackageReport
): string {
  const lines: string[] = [
    `# P2-T05 Final Preview evidence package`,
    ``,
    `생성: ${report.generatedAt}`,
    `브랜치(기대): \`${report.branchExpected}\``,
    ``,
    `## 정직 플래그`,
    ``,
    `| 플래그 | 값 |`,
    `|---|---|`,
    `| writeAttempted | ${report.writeAttempted} |`,
    `| mainMergeAttempted | ${report.mainMergeAttempted} |`,
    `| productionDeployAttempted | ${report.productionDeployAttempted} |`,
    `| visualApprovalClaimed | ${report.visualApprovalClaimed} |`,
    `| deviceApprovalClaimed | ${report.deviceApprovalClaimed} |`,
    `| dashboardSettingsClaimedVerified | ${report.dashboardSettingsClaimedVerified} |`,
    `| releaseReadyClaimed | ${report.releaseReadyClaimed} |`,
    ``,
    `## 요약`,
    ``,
    `| 자동 필수 | 통과 | 실패 | 생략 | external_only | dashboard_only | blocked | 사람 단계 |`,
    `|---|---|---|---|---|---|---|---|`,
    `| ${report.summary.automatedRequired} | ${report.summary.automatedPassed} | ${report.summary.automatedFailed} | ${report.summary.automatedSkipped} | ${report.summary.externalOnlyItemCount} | ${report.summary.dashboardOnlyItemCount} | ${report.summary.blockedGateCount} | ${report.summary.humanStepCount} |`,
    ``,
    `## 자동 명령 결과`,
    ``,
  ];

  for (const r of report.commandResults) {
    lines.push(
      `- \`${r.npmScript}\` · **${r.status}** · exit=${r.exitCode ?? "n/a"} · ${r.notesKo}`
    );
  }

  lines.push(``, `## 증거 버킷`, ``);
  for (const bucket of report.buckets) {
    lines.push(`### ${bucket.id} — ${bucket.titleKo}`);
    lines.push(``);
    lines.push(bucket.purposeKo);
    lines.push(``);
    for (const item of bucket.items) {
      lines.push(
        `- **${item.id}** · \`${item.classification}\` · ${item.titleKo} — ${item.notesKo}`
      );
    }
    lines.push(``);
  }

  lines.push(`## 1회성 사람 검증 절차`, ``);
  for (const step of report.humanVerificationSteps) {
    lines.push(`### ${step.id} — ${step.titleKo}`);
    lines.push(``);
    lines.push(`1. 위치: ${step.whereKo}`);
    lines.push(`2. 확인: ${step.checkKo}`);
    lines.push(`3. 통과: ${step.passCriteriaKo}`);
    lines.push(`4. 실패: ${step.failActionKo}`);
    lines.push(``);
  }

  lines.push(`## 정직 메모`, ``);
  for (const n of report.honestyNotesKo) {
    lines.push(`- ${n}`);
  }
  lines.push(``);

  return lines.join("\n");
}

export function requiredAutomatedCommandIds(): string[] {
  return PHASE2_AUTOMATED_COMMANDS.filter((c) => c.requiredForPhase2Gate).map(
    (c) => c.id
  );
}
