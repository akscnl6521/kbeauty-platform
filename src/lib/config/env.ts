/**
 * 환경 변수 값은 이 모듈 밖으로 노출하지 않는다.
 * 공개 상태 확인과 배포 전 검증에만 사용한다.
 */
export type EnvPresenceReport = {
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasSiteUrl: boolean;
  hasAiProvider: boolean;
  requiredConfigPresent: boolean;
  issues: string[];
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isLocalhostUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** AI 분석 모듈과 같은 production mock 차단 규칙을 유지한다. */
export function isMockAiProviderInProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.AI_PROVIDER?.trim().toLowerCase() === "mock"
  );
}

/**
 * 값·키·프로젝트 식별자는 반환하지 않는다.
 * service role은 관리자/Care worker 경로에서만 필요하지만 배포 준비 상태에는 포함한다.
 */
export function getEnvPresenceReport(): EnvPresenceReport {
  const issues: string[] = [];
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseAnonKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  const hasSiteUrl = hasValue(siteUrl);
  const hasAiProvider = hasValue(process.env.AI_PROVIDER);

  if (!hasSupabaseUrl) issues.push("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!hasSupabaseAnonKey) issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  if (!hasServiceRoleKey) issues.push("SUPABASE_SERVICE_ROLE_KEY is required for admin and care worker paths.");
  if (process.env.NODE_ENV === "production" && !hasAiProvider) {
    issues.push("AI_PROVIDER is required in production.");
  }
  if (isMockAiProviderInProduction()) {
    issues.push("AI_PROVIDER=mock is not allowed in production.");
  }
  if (process.env.NODE_ENV === "production" && siteUrl && isLocalhostUrl(siteUrl)) {
    issues.push("Production site URL must not use localhost.");
  }

  return {
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasServiceRoleKey,
    hasSiteUrl,
    hasAiProvider,
    requiredConfigPresent: !issues.length,
    issues,
  };
}

/** 빌드·런타임에서 안전하지 않은 production 설정을 즉시 중단한다. */
export function assertProductionEnvSafe(): void {
  if (process.env.NODE_ENV !== "production") return;

  const report = getEnvPresenceReport();
  if (!report.requiredConfigPresent) {
    throw new Error(`Unsafe production environment: ${report.issues.join(" ")}`);
  }
}
