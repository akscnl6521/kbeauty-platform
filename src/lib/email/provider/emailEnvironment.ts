/**
 * Resolve runtime email environment from deployment env vars.
 * Pure helpers - no network, no secrets logged.
 */

export type EmailRuntimeEnvironment =
  | "local_test"
  | "preview_staging"
  | "production";

export type EnvLike = Record<string, string | undefined>;

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveEmailRuntimeEnvironment(
  env: EnvLike
): EmailRuntimeEnvironment {
  const vercelEnv = norm(env.VERCEL_ENV);
  const appEnv = norm(env.APP_ENV);

  if (vercelEnv === "production" || appEnv === "production") {
    return "production";
  }
  if (
    vercelEnv === "preview" ||
    appEnv === "preview" ||
    appEnv === "staging"
  ) {
    return "preview_staging";
  }
  return "local_test";
}

export function isProductionEmailEnvironment(env: EnvLike): boolean {
  return resolveEmailRuntimeEnvironment(env) === "production";
}