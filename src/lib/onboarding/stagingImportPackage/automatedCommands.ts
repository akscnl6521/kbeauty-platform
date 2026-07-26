/**
 * P3-T05 automated command suite — focused + integration + security + build.
 */

import type { StagingImportAutomatedCommand } from "./types";

export const STAGING_IMPORT_AUTOMATED_COMMANDS: readonly StagingImportAutomatedCommand[] =
  [
    {
      id: "staging_import_package",
      npmScript: "test:staging-import-package",
      titleKo: "P3-T05 통합 Staging import 패키지 selftest",
      requiredForGate: true,
      kind: "focused",
      nodeArgs: ["--import", "tsx", "scripts/staging-import-package-selftest.ts"],
    },
    {
      id: "official_kr_product_source",
      npmScript: "test:official-kr-product-source",
      titleKo: "P3-T01 공식 KR 제품 출처",
      requiredForGate: true,
      kind: "focused",
      nodeArgs: ["--import", "tsx", "scripts/official-kr-product-source-selftest.ts"],
    },
    {
      id: "verified_product_pool",
      npmScript: "test:verified-product-pool",
      titleKo: "P3-T02 검증 제품 풀",
      requiredForGate: true,
      kind: "focused",
      nodeArgs: ["--import", "tsx", "scripts/verified-product-pool-selftest.ts"],
    },
    {
      id: "automated_refresh_ops",
      npmScript: "test:automated-refresh-ops",
      titleKo: "P3-T03 통합 갱신·예외",
      requiredForGate: true,
      kind: "focused",
      nodeArgs: ["--import", "tsx", "scripts/automated-refresh-ops-selftest.ts"],
    },
    {
      id: "revenue_readiness",
      npmScript: "test:revenue-readiness",
      titleKo: "P3-T04 수익 준비",
      requiredForGate: true,
      kind: "focused",
      nodeArgs: ["--import", "tsx", "scripts/revenue-readiness-selftest.ts"],
    },
    {
      id: "admin_dry_run_publishable_gate",
      npmScript: "test:admin-dry-run-publishable-gate",
      titleKo: "T07-05 Admin dry-run·publishable 게이트",
      requiredForGate: true,
      kind: "integration",
      nodeArgs: [
        "--import",
        "tsx",
        "scripts/admin-dry-run-publishable-gate-selftest.ts",
      ],
    },
    {
      id: "real_data_onboarding",
      npmScript: "test:real-data-onboarding",
      titleKo: "P2-T04 실데이터 온보딩",
      requiredForGate: true,
      kind: "integration",
      nodeArgs: ["--import", "tsx", "scripts/real-data-onboarding-selftest.ts"],
    },
    {
      id: "admin_review_e2e",
      npmScript: "test:admin-review-e2e",
      titleKo: "P2-T03 Admin review E2E",
      requiredForGate: true,
      kind: "integration",
      nodeArgs: ["--import", "tsx", "scripts/admin-review-e2e-selftest.ts"],
    },
    {
      id: "commercial_separation",
      npmScript: "test:commercial-separation",
      titleKo: "상업 분리 정책",
      requiredForGate: true,
      kind: "integration",
      nodeArgs: [
        "--import",
        "tsx",
        "scripts/commercial-separation-policy-selftest.ts",
      ],
    },
    {
      id: "autopilot_queue",
      npmScript: "test:autopilot-queue",
      titleKo: "Autopilot 계약·큐",
      requiredForGate: true,
      kind: "integration",
      nodeArgs: ["--import", "tsx", "scripts/autopilot-queue-selftest.ts"],
    },
    {
      id: "release_security",
      npmScript: "check:release-security",
      titleKo: "릴리스 보안 점검",
      requiredForGate: true,
      kind: "security",
      nodeArgs: ["scripts/security-release-check.mjs"],
    },
    {
      id: "production_build",
      npmScript: "build",
      titleKo: "production build (env placeholder)",
      requiredForGate: true,
      kind: "build",
      nodeArgs: ["node_modules/next/dist/bin/next", "build"],
    },
  ] as const;

export function requiredAutomatedCommandIds(): string[] {
  return STAGING_IMPORT_AUTOMATED_COMMANDS.filter((c) => c.requiredForGate).map(
    (c) => c.id,
  );
}
