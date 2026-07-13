import "server-only";

import type { AdminRole } from "@/lib/auth/roles";
import type { AdminSession } from "@/lib/auth/admin";
import { AdminWriteError } from "@/lib/admin/write-errors";

/**
 * Fine-grained admin write actions for Search-to-Verified console.
 * Role must come from server-verified admin_users — never from the client.
 */
export type AdminWriteAction =
  | "discovery.create"
  | "discovery.update_basic"
  | "discovery.link_product"
  | "discovery.replace_link"
  | "verification.create"
  | "verification.review"
  | "candidate.publish";

const ROLE_ACTIONS: Record<AdminRole, ReadonlySet<AdminWriteAction>> = {
  admin: new Set([
    "discovery.create",
    "discovery.update_basic",
    "discovery.link_product",
    "discovery.replace_link",
    "verification.create",
    "verification.review",
    "candidate.publish",
  ]),
  catalog_manager: new Set([
    "discovery.create",
    "discovery.update_basic",
    "discovery.link_product",
    "verification.create",
  ]),
  researcher: new Set([
    "discovery.create",
    "discovery.update_basic",
    "verification.create",
  ]),
  reviewer: new Set(["verification.review"]),
  read_only: new Set(),
};

export function getAdminWriteActions(role: AdminRole): ReadonlySet<AdminWriteAction> {
  return ROLE_ACTIONS[role];
}

export function canPerformAdminWrite(
  role: AdminRole,
  action: AdminWriteAction
): boolean {
  return ROLE_ACTIONS[role].has(action);
}

export function canCreateDiscoveryCandidate(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "discovery.create");
}

export function canUpdateDiscoveryCandidate(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "discovery.update_basic");
}

export function canCreateVerificationQueue(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "verification.create");
}

export function canReviewVerificationQueue(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "verification.review");
}

export function canLinkProduct(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "discovery.link_product");
}

export function canReplaceProductLink(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "discovery.replace_link");
}

export function canPublishCandidate(role: AdminRole): boolean {
  return canPerformAdminWrite(role, "candidate.publish");
}

/**
 * Throws FORBIDDEN with Korean message when the session role lacks the action.
 */
export function assertAdminPermission(
  session: Pick<AdminSession, "role">,
  action: AdminWriteAction
): void {
  if (!canPerformAdminWrite(session.role, action)) {
    throw new AdminWriteError(
      "FORBIDDEN",
      403,
      "이 작업을 수행할 권한이 없습니다."
    );
  }
}

export function getAdminWriteCapabilityFlags(role: AdminRole) {
  return {
    canCreateDiscovery: canCreateDiscoveryCandidate(role),
    canUpdateDiscovery: canUpdateDiscoveryCandidate(role),
    canLinkProduct: canLinkProduct(role),
    canReplaceLink: canReplaceProductLink(role),
    canCreateQueue: canCreateVerificationQueue(role),
    canReviewQueue: canReviewVerificationQueue(role),
    canPublish: canPublishCandidate(role),
  };
}
