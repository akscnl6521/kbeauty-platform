/**
 * Dev/Preview-only camera diagnostics. Never logs photos, blobs, or PII.
 */

export type CameraDiagnosticEvent =
  | "camera_request_started"
  | "camera_permission_granted"
  | "camera_stream_received"
  | "video_element_ready"
  | "stream_attached"
  | "video_play_started"
  | "video_play_failed"
  | "camera_state_changed"
  | "stream_track_ended"
  | "camera_error"
  | "camera_request_blocked_duplicate"
  | "camera_fallback_constraints"
  | "camera_startup_timeout";

export type CameraDiagnosticPayload = {
  event: CameraDiagnosticEvent;
  state?: string;
  errorName?: string;
  errorMessage?: string;
  supportOk?: boolean;
  videoElementPresent?: boolean;
  streamActive?: boolean;
  trackReadyStates?: string[];
  facingMode?: string;
  detail?: string;
};

export function isCameraDiagnosticsEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (env.NEXT_PUBLIC_CAMERA_DIAGNOSTICS === "0") return false;
  if (env.NEXT_PUBLIC_CAMERA_DIAGNOSTICS === "1") return true;
  // Preview + development: on. Production build without explicit flag: off.
  if (env.NODE_ENV === "development") return true;
  if (env.NEXT_PUBLIC_VERCEL_ENV === "preview") return true;
  if (env.VERCEL_ENV === "preview") return true;
  return false;
}

export function logCameraDiagnostic(
  payload: CameraDiagnosticPayload,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): void {
  if (!isCameraDiagnosticsEnabled(env)) return;
  try {
    console.info("[guided-camera]", {
      event: payload.event,
      state: payload.state,
      errorName: payload.errorName,
      errorMessage: payload.errorMessage,
      supportOk: payload.supportOk,
      videoElementPresent: payload.videoElementPresent,
      streamActive: payload.streamActive,
      trackReadyStates: payload.trackReadyStates,
      facingMode: payload.facingMode,
      detail: payload.detail,
    });
  } catch {
    // ignore
  }
}
