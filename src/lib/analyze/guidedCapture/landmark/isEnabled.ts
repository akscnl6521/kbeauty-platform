/**
 * Feature flags for Phase 3.1 landmark auto-capture + voice.
 * Not security boundaries.
 */

export function isFaceLandmarkAutoCaptureEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE ?? "1")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function isCaptureVoiceCountdownEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN ?? "1")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/** Preview/dev local debug overlay — never logs coordinates to server. */
export function isLandmarkCaptureDebugEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "1") return true;
  if (env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "0") return false;
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("landmarkDebug") === "1") return true;
    } catch {
      // ignore
    }
  }
  return env.NODE_ENV === "development";
}

export const FACE_LANDMARKER_WASM_PATH = "/mediapipe/wasm";
export const FACE_LANDMARKER_MODEL_PATH = "/models/face_landmarker.task";
export const LANDMARK_INFER_MAX_FPS = 12;
export const LANDMARK_SLOW_MS = 120;
