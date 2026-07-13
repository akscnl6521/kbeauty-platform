export class CareOwnershipError extends Error {
  readonly code = "NOT_FOUND" as const;

  constructor() {
    super("Resource not found.");
  }
}

export function assertOwner(
  rowUserId: string | null | undefined,
  authUserId: string
): void {
  if (!rowUserId || rowUserId !== authUserId) {
    throw new CareOwnershipError();
  }
}

export { sanitizeMemo } from "@/lib/care/sanitize";
