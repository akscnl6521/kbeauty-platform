import "server-only";

import { classifyCareCheckInsProbeError } from "@/lib/admin/care-ops";

export function isPhotoMigrationMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: string; message?: string };
  return classifyCareCheckInsProbeError(row) === "migration_missing";
}

export function isProductionAppEnv(): boolean {
  return (process.env.APP_ENV ?? "").trim().toLowerCase() === "production";
}

export function isSyntheticFixtureRequest(request: Request): boolean {
  return request.headers.get("x-synthetic-fixture") === "1";
}
