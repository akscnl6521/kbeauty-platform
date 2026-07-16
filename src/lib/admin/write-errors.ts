/**
 * Domain errors for admin write console (safe client messages only).
 */

export class AdminWriteError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    httpStatus: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AdminWriteError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function isAdminWriteError(error: unknown): error is AdminWriteError {
  return error instanceof AdminWriteError;
}

export function invalidInput(
  message: string,
  details?: Record<string, unknown>
): AdminWriteError {
  return new AdminWriteError("INVALID_INPUT", 400, message, details);
}

export function notFound(message: string): AdminWriteError {
  return new AdminWriteError("NOT_FOUND", 404, message);
}

export function conflict(
  code: string,
  message: string,
  details?: Record<string, unknown>
): AdminWriteError {
  return new AdminWriteError(code, 409, message, details);
}

export function preconditionFailed(
  message: string,
  details?: Record<string, unknown>
): AdminWriteError {
  return new AdminWriteError("PRECONDITION_FAILED", 422, message, details);
}

export function internalWriteError(): AdminWriteError {
  return new AdminWriteError(
    "INTERNAL_ERROR",
    500,
    "요청을 처리하지 못했습니다."
  );
}
