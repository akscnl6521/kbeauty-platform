/**
 * Preview-only catalog fixture gate.
 *
 * Investigation (2026-07-18): repo backups/seeds have verified products + media,
 * but no row that also has a verified KR offer with in_stock. We therefore do
 * **not** invent Preview products. Production must never receive fixtures.
 */

export type PreviewFixtureProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  image_url: string | null;
  image_verified: boolean;
  previewLabel: "Preview 검증 데이터";
};

export type PreviewFixtureResolution = {
  allowed: boolean;
  reason: string;
  products: PreviewFixtureProduct[];
  labeledAsPreview: boolean;
};

function normalizeEnv(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/** True when this runtime is Vercel Production or APP_ENV/NODE production. */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const vercelEnv = normalizeEnv(env.VERCEL_ENV);
  const appEnv = normalizeEnv(env.APP_ENV);
  const nodeEnv = normalizeEnv(env.NODE_ENV);
  return (
    vercelEnv === "production" ||
    appEnv === "production" ||
    (nodeEnv === "production" && vercelEnv !== "preview" && vercelEnv !== "development")
  );
}

/**
 * Returns Preview fixtures only when ALL gates pass.
 * Currently always empty product list: no complete verified+offer fixture in repo.
 */
export function resolvePreviewFixtureCatalog(
  env: NodeJS.ProcessEnv = process.env
): PreviewFixtureResolution {
  if (isProductionRuntime(env)) {
    return {
      allowed: false,
      reason: "production_runtime_blocked",
      products: [],
      labeledAsPreview: false,
    };
  }

  const vercelEnv = normalizeEnv(env.VERCEL_ENV);
  const appEnv = normalizeEnv(env.APP_ENV);
  const previewLike =
    vercelEnv === "preview" ||
    appEnv === "preview" ||
    appEnv === "staging" ||
    normalizeEnv(env.ALLOW_PREVIEW_FIXTURES) === "1";

  if (!previewLike) {
    return {
      allowed: false,
      reason: "not_preview_runtime",
      products: [],
      labeledAsPreview: false,
    };
  }

  // No invented products — backup offers are unverified / stock unknown.
  return {
    allowed: true,
    reason: "no_complete_verified_fixture_in_repo",
    products: [],
    labeledAsPreview: true,
  };
}

/** Hard gate helper for callers that must never leak fixtures to Production UI. */
export function getPreviewFixturesForDisplay(
  env: NodeJS.ProcessEnv = process.env
): PreviewFixtureProduct[] {
  const resolved = resolvePreviewFixtureCatalog(env);
  if (!resolved.allowed || !resolved.labeledAsPreview) return [];
  return resolved.products;
}
