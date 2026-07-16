/**
 * Safe recovery allowlist (pure — no server-only).
 */

export type RecoveryActionCode =
  | "requeue_stale_running_jobs"
  | "release_stale_batch_locks"
  | "promote_due_retry_wait"
  | "noop_forbidden";

const ALLOWED: RecoveryActionCode[] = [
  "requeue_stale_running_jobs",
  "release_stale_batch_locks",
  "promote_due_retry_wait",
];

export const FORBIDDEN_RECOVERY_ACTIONS = [
  "delete_products",
  "demote_verified_products",
  "publish_products",
  "bulk_rewrite_status",
  "replace_official_site_low_confidence",
  "auto_resolve_ingredient_conflicts",
  "approve_marketplace_sellers",
] as const;

export function listAllowedRecoveryActions(): RecoveryActionCode[] {
  return [...ALLOWED];
}

export function listForbiddenRecoveryActions(): readonly string[] {
  return FORBIDDEN_RECOVERY_ACTIONS;
}

export function isRecoveryAllowed(action: string): boolean {
  return (ALLOWED as string[]).includes(action);
}
