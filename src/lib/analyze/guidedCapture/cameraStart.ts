/**
 * Camera start orchestration — pure helpers for attach/play/fallback/timeout.
 * No fake success: callers must receive a real MediaStream / play result.
 */

import { classifyGetUserMediaError } from "./cameraSupport";

export const CAMERA_STARTUP_TIMEOUT_MS = 5_000;
export const VIDEO_ELEMENT_WAIT_MS = 3_000;

export type CameraStartFailureKind =
  | "permission_denied"
  | "camera_unavailable"
  | "camera_start_failed"
  | "video_play_failed"
  | "startup_timeout"
  | "video_element_missing";

export type PreferredFacingMode = "user" | "environment";

export function preferredVideoConstraints(
  facingMode: PreferredFacingMode
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    },
  };
}

export function fallbackVideoConstraints(): MediaStreamConstraints {
  return { audio: false, video: true };
}

export function shouldRetryWithFallbackConstraints(err: unknown): boolean {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";
  return (
    name === "OverconstrainedError" ||
    name === "ConstraintNotSatisfiedError" ||
    name === "NotFoundError" ||
    name === "AbortError"
  );
}

export function classifyCameraStartFailure(
  err: unknown,
  phase: "getUserMedia" | "attach" | "play" | "timeout" | "video_wait"
): CameraStartFailureKind {
  if (phase === "timeout") return "startup_timeout";
  if (phase === "video_wait") return "video_element_missing";
  if (phase === "play") return "video_play_failed";
  if (phase === "attach") return "camera_start_failed";

  const outcome = classifyGetUserMediaError(err);
  if (outcome === "denied") return "permission_denied";
  if (outcome === "unavailable") return "camera_unavailable";
  return "camera_start_failed";
}

/** Stop tracks only when the stream identity matches the owned stream. */
export function stopStreamIfOwned(
  owned: MediaStream | null | undefined,
  candidate: MediaStream | null | undefined
): boolean {
  if (!owned || !candidate) return false;
  if (owned !== candidate) return false;
  for (const track of owned.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
  return true;
}

export function streamDiagnostics(stream: MediaStream | null | undefined): {
  streamActive: boolean;
  trackCount: number;
  trackReadyStates: string[];
} {
  if (!stream) {
    return { streamActive: false, trackCount: 0, trackReadyStates: [] };
  }
  const tracks = stream.getTracks();
  return {
    streamActive: stream.active,
    trackCount: tracks.length,
    trackReadyStates: tracks.map((t) => t.readyState),
  };
}

export type AttachPlayResult =
  | { ok: true }
  | { ok: false; kind: CameraStartFailureKind; error: unknown };

/**
 * Attach stream to video and await play after metadata/canplay.
 * Mirror CSS is display-only — do not transform the canvas capture here.
 */
export async function attachStreamAndPlay(input: {
  video: HTMLVideoElement;
  stream: MediaStream;
  play: (video: HTMLVideoElement) => Promise<void>;
  waitForReady?: (video: HTMLVideoElement) => Promise<void>;
}): Promise<AttachPlayResult> {
  const { video, stream, play } = input;
  try {
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.autoplay = true;
    video.srcObject = stream;

    if (input.waitForReady) {
      await input.waitForReady(video);
    } else if (video.readyState < 2) {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("video_ready_failed"));
        };
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("loadedmetadata", onReady);
        video.addEventListener("canplay", onReady);
        video.addEventListener("error", onError);
        if (video.readyState >= 2) onReady();
      });
    }

    try {
      await play(video);
    } catch (err) {
      return { ok: false, kind: "video_play_failed", error: err };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, kind: "camera_start_failed", error: err };
  }
}

/** Poll until video element exists or timeout. */
export async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  options: {
    timeoutMs?: number;
    now?: () => number;
    delay?: (ms: number) => Promise<void>;
  } = {}
): Promise<HTMLVideoElement | null> {
  const timeoutMs = options.timeoutMs ?? VIDEO_ELEMENT_WAIT_MS;
  const now = options.now ?? (() => Date.now());
  const delay =
    options.delay ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));
  const start = now();
  for (;;) {
    const el = getVideo();
    if (el) return el;
    if (now() - start >= timeoutMs) return null;
    await delay(50);
  }
}

export function isDuplicateCameraRequest(input: {
  inFlight: boolean;
}): boolean {
  return input.inFlight;
}

export function cameraStartFailureMessageKo(kind: CameraStartFailureKind): string {
  switch (kind) {
    case "permission_denied":
      return "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용하거나 갤러리·문진으로 진행해 주세요.";
    case "camera_unavailable":
      return "카메라를 찾을 수 없거나 다른 앱이 사용 중일 수 있어요.";
    case "video_play_failed":
      return "카메라 화면을 재생하지 못했어요. 다시 시도해 주세요.";
    case "startup_timeout":
      return "카메라를 시작하지 못했어요. 시간이 초과되었습니다.";
    case "video_element_missing":
      return "카메라 화면을 준비하지 못했어요.";
    case "camera_start_failed":
    default:
      return "카메라를 시작하지 못했어요. 다시 시도하거나 갤러리·문진으로 진행해 주세요.";
  }
}
