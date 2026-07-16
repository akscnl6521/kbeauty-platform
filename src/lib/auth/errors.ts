export class AuthenticationRequiredError extends Error {
  readonly code = "UNAUTHENTICATED" as const;
  readonly httpStatus = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class AdminAccessDeniedError extends Error {
  readonly code = "FORBIDDEN" as const;
  readonly httpStatus = 403;

  constructor(message = "Admin access denied.") {
    super(message);
    this.name = "AdminAccessDeniedError";
  }
}

export class AdminInactiveError extends Error {
  readonly code = "FORBIDDEN" as const;
  readonly httpStatus = 403;

  constructor(message = "Admin account is inactive.") {
    super(message);
    this.name = "AdminInactiveError";
  }
}

export class AdminRoleDeniedError extends Error {
  readonly code = "FORBIDDEN" as const;
  readonly httpStatus = 403;

  constructor(message = "Admin role is not allowed for this action.") {
    super(message);
    this.name = "AdminRoleDeniedError";
  }
}

export class AdminConfigurationError extends Error {
  readonly code = "CONFIGURATION_ERROR" as const;
  readonly httpStatus = 500;

  constructor(message = "Admin configuration error.") {
    super(message);
    this.name = "AdminConfigurationError";
  }
}

export type AdminAuthError =
  | AuthenticationRequiredError
  | AdminAccessDeniedError
  | AdminInactiveError
  | AdminRoleDeniedError
  | AdminConfigurationError;

export function isAdminAuthError(error: unknown): error is AdminAuthError {
  return (
    error instanceof AuthenticationRequiredError ||
    error instanceof AdminAccessDeniedError ||
    error instanceof AdminInactiveError ||
    error instanceof AdminRoleDeniedError ||
    error instanceof AdminConfigurationError
  );
}
