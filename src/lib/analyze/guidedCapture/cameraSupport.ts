/**
 * Camera capability probes — browser-safe helpers (no DOM required for unit tests).
 */

export type CameraSupportResult = {
  supported: boolean;
  secureContext: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;
  reason:
    | "ok"
    | "insecure_context"
    | "no_media_devices"
    | "no_get_user_media";
};

export function evaluateCameraSupport(input: {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
}): CameraSupportResult {
  if (!input.isSecureContext) {
    return {
      supported: false,
      secureContext: false,
      mediaDevices: input.hasMediaDevices,
      getUserMedia: input.hasGetUserMedia,
      reason: "insecure_context",
    };
  }
  if (!input.hasMediaDevices) {
    return {
      supported: false,
      secureContext: true,
      mediaDevices: false,
      getUserMedia: false,
      reason: "no_media_devices",
    };
  }
  if (!input.hasGetUserMedia) {
    return {
      supported: false,
      secureContext: true,
      mediaDevices: true,
      getUserMedia: false,
      reason: "no_get_user_media",
    };
  }
  return {
    supported: true,
    secureContext: true,
    mediaDevices: true,
    getUserMedia: true,
    reason: "ok",
  };
}

/** Read support from a window-like object (or stubs in tests). */
export function detectCameraSupport(
  win: {
    isSecureContext?: boolean;
    navigator?: { mediaDevices?: { getUserMedia?: unknown } };
  } | null
    | undefined
): CameraSupportResult {
  if (!win) {
    return evaluateCameraSupport({
      isSecureContext: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
    });
  }
  const md = win.navigator?.mediaDevices;
  return evaluateCameraSupport({
    isSecureContext: win.isSecureContext === true,
    hasMediaDevices: !!md,
    hasGetUserMedia: typeof md?.getUserMedia === "function",
  });
}

export type PermissionOutcome =
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

export function classifyGetUserMediaError(err: unknown): PermissionOutcome {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  ) {
    return "unavailable";
  }
  return "error";
}
