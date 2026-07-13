export const ADMIN_ROLES = [
  "admin",
  "reviewer",
  "researcher",
  "catalog_manager",
  "read_only",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  );
}

/** Minimal capability flags for this auth sprint (not product workflow). */
export const ADMIN_ROLE_CAPABILITIES: Record<
  AdminRole,
  {
    canAccessAdmin: true;
    canReview: boolean;
    canWriteEvidence: boolean;
    canManageCatalog: boolean;
    canPublish: boolean;
    canManageAdmins: boolean;
  }
> = {
  admin: {
    canAccessAdmin: true,
    canReview: true,
    canWriteEvidence: true,
    canManageCatalog: true,
    canPublish: true,
    canManageAdmins: true,
  },
  reviewer: {
    canAccessAdmin: true,
    canReview: true,
    canWriteEvidence: false,
    canManageCatalog: false,
    canPublish: false,
    canManageAdmins: false,
  },
  researcher: {
    canAccessAdmin: true,
    canReview: false,
    canWriteEvidence: true,
    canManageCatalog: false,
    canPublish: false,
    canManageAdmins: false,
  },
  catalog_manager: {
    canAccessAdmin: true,
    canReview: false,
    canWriteEvidence: false,
    canManageCatalog: true,
    canPublish: false,
    canManageAdmins: false,
  },
  read_only: {
    canAccessAdmin: true,
    canReview: false,
    canWriteEvidence: false,
    canManageCatalog: false,
    canPublish: false,
    canManageAdmins: false,
  },
};
