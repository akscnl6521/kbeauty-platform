import "server-only";

import {
  assertAdminPermission,
  type AdminWriteAction,
} from "@/lib/auth/admin-permissions";
import type { AdminSession } from "@/lib/auth/admin";

/**
 * Server-side write guard. Prefer assertAdminPermission for clarity.
 */
export function assertCanWrite(
  session: AdminSession,
  action: AdminWriteAction
): void {
  assertAdminPermission(session, action);
}

export {
  assertAdminPermission,
  canCreateDiscoveryCandidate,
  canUpdateDiscoveryCandidate,
  canCreateVerificationQueue,
  canReviewVerificationQueue,
  canLinkProduct,
  canPublishCandidate,
  getAdminWriteCapabilityFlags,
} from "@/lib/auth/admin-permissions";
