"use client";

import { useEffect, useRef, useState } from "react";
import {
  detectCameraSupport,
} from "@/lib/analyze/guidedCapture/cameraSupport";
import { logCameraDiagnostic } from "@/lib/analyze/guidedCapture/cameraDiagnostics";
import {
  attachStreamAndPlay,
  CAMERA_STARTUP_TIMEOUT_MS,
  cameraStartFailureMessageKo,
  classifyCameraStartFailure,
  fallbackVideoConstraints,
  preferredVideoConstraints,
  shouldRetryWithFallbackConstraints,
  stopStreamIfOwned,
  streamDiagnostics,
  waitForVideoElement,
  type CameraStartFailureKind,
} from "@/lib/analyze/guidedCapture/cameraStart";
import { guidanceForAngle } from "@/lib/analyze/guidedCapture/captureSession";
import { captureVideoFrameToShot } from "@/lib/analyze/guidedCapture/processImageClient";
import type { CaptureAngle, CapturedShot } from "@/lib/analyze/guidedCapture/types";

export type CameraCapturePanelProps = {
  angle: CaptureAngle;
  facingMode: "user" | "environment";
  onFacingModeChange: (mode: "user" | "environment") => void;
  onCaptured: (shot: CapturedShot) => void;
  onLive: () => void;
  onPermissionDenied: () => void;
  onUnavailable: () => void;
  onStartFailed: (kind: CameraStartFailureKind) => void;
  onCancel: () => void;
  /** Bump to force a fresh camera start (retry). */
  restartToken?: number;
  disabled?: boolean;
};

type PanelStatus = "starting" | "live" | "error";

export function CameraCapturePanel({
  angle,
  facingMode,
  onFacingModeChange,
  onCaptured,
  onLive,
  onPermissionDenied,
  onUnavailable,
  onStartFailed,
  onCancel,
  restartToken = 0,
  disabled,
}: CameraCapturePanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startGenRef = useRef(0);
  const inFlightRef = useRef(false);
  const liveReachedRef = useRef(false);
  const onLiveRef = useRef(onLive);
  const onPermissionDeniedRef = useRef(onPermissionDenied);
  const onUnavailableRef = useRef(onUnavailable);
  const onStartFailedRef = useRef(onStartFailed);

  const [status, setStatus] = useState<PanelStatus>("starting");
  const [hint, setHint] = useState("얼굴을 가이드 안에 맞춰 주세요.");
  const [busy, setBusy] = useState(false);
  const [failureKind, setFailureKind] = useState<CameraStartFailureKind | null>(
    null
  );
  const guidance = guidanceForAngle(angle);

  useEffect(() => {
    onLiveRef.current = onLive;
    onPermissionDeniedRef.current = onPermissionDenied;
    onUnavailableRef.current = onUnavailable;
    onStartFailedRef.current = onStartFailed;
  }, [onLive, onPermissionDenied, onUnavailable, onStartFailed]);

  useEffect(() => {
    const gen = ++startGenRef.current;
    let cancelled = false;
    let localStream: MediaStream | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      inFlightRef.current = true;
      liveReachedRef.current = false;
      setStatus("starting");
      setFailureKind(null);
      setHint("카메라를 준비하는 중…");

      const support = detectCameraSupport(
        typeof window !== "undefined" ? window : null
      );
      logCameraDiagnostic({
        event: "camera_request_started",
        state: "requesting_permission",
        supportOk: support.supported,
        facingMode,
        videoElementPresent: !!videoRef.current,
      });

      if (!support.supported) {
        inFlightRef.current = false;
        setStatus("error");
        setFailureKind("camera_unavailable");
        onUnavailableRef.current();
        return;
      }

      startupTimer = setTimeout(() => {
        if (cancelled || gen !== startGenRef.current) return;
        if (liveReachedRef.current) return;
        logCameraDiagnostic({
          event: "camera_startup_timeout",
          state: "starting",
          videoElementPresent: !!videoRef.current,
          ...streamDiagnostics(streamRef.current),
        });
        if (localStream) {
          stopStreamIfOwned(localStream, localStream);
          if (streamRef.current === localStream) streamRef.current = null;
        }
        setStatus("error");
        setFailureKind("startup_timeout");
        setHint(cameraStartFailureMessageKo("startup_timeout"));
        inFlightRef.current = false;
        onStartFailedRef.current("startup_timeout");
      }, CAMERA_STARTUP_TIMEOUT_MS);

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(
            preferredVideoConstraints(facingMode)
          );
        } catch (firstErr) {
          if (shouldRetryWithFallbackConstraints(firstErr)) {
            logCameraDiagnostic({
              event: "camera_fallback_constraints",
              state: "requesting_permission",
              errorName:
                firstErr && typeof firstErr === "object" && "name" in firstErr
                  ? String((firstErr as { name?: unknown }).name)
                  : undefined,
              errorMessage:
                firstErr instanceof Error ? firstErr.message : String(firstErr),
            });
            stream = await navigator.mediaDevices.getUserMedia(
              fallbackVideoConstraints()
            );
          } else {
            throw firstErr;
          }
        }

        if (cancelled || gen !== startGenRef.current) {
          stopStreamIfOwned(stream, stream);
          inFlightRef.current = false;
          return;
        }

        logCameraDiagnostic({
          event: "camera_permission_granted",
          state: "requesting_permission",
          ...streamDiagnostics(stream),
        });
        logCameraDiagnostic({
          event: "camera_stream_received",
          state: "requesting_permission",
          ...streamDiagnostics(stream),
        });

        const prev = streamRef.current;
        if (prev && prev !== stream) {
          stopStreamIfOwned(prev, prev);
        }
        localStream = stream;
        streamRef.current = stream;
        for (const track of stream.getTracks()) {
          track.addEventListener("ended", () => {
            logCameraDiagnostic({
              event: "stream_track_ended",
              trackReadyStates: [track.readyState],
            });
          });
        }

        const video = await waitForVideoElement(() => videoRef.current);
        if (cancelled || gen !== startGenRef.current) {
          stopStreamIfOwned(stream, stream);
          if (streamRef.current === stream) streamRef.current = null;
          inFlightRef.current = false;
          return;
        }
        if (!video) {
          const kind = classifyCameraStartFailure(
            new Error("video_element_missing"),
            "video_wait"
          );
          logCameraDiagnostic({
            event: "camera_error",
            state: "starting",
            errorName: "VideoElementMissing",
            errorMessage: "video element not mounted",
            videoElementPresent: false,
            ...streamDiagnostics(stream),
          });
          stopStreamIfOwned(stream, stream);
          if (streamRef.current === stream) streamRef.current = null;
          setStatus("error");
          setFailureKind(kind);
          setHint(cameraStartFailureMessageKo(kind));
          inFlightRef.current = false;
          onStartFailedRef.current(kind);
          return;
        }

        logCameraDiagnostic({
          event: "video_element_ready",
          state: "requesting_permission",
          videoElementPresent: true,
          ...streamDiagnostics(stream),
        });

        const attach = await attachStreamAndPlay({
          video,
          stream,
          play: (v) => v.play(),
        });

        if (cancelled || gen !== startGenRef.current) {
          stopStreamIfOwned(stream, stream);
          if (streamRef.current === stream) streamRef.current = null;
          inFlightRef.current = false;
          return;
        }

        if (!attach.ok) {
          logCameraDiagnostic({
            event:
              attach.kind === "video_play_failed"
                ? "video_play_failed"
                : "camera_error",
            state: "starting",
            errorName:
              attach.error &&
              typeof attach.error === "object" &&
              "name" in attach.error
                ? String((attach.error as { name?: unknown }).name)
                : undefined,
            errorMessage:
              attach.error instanceof Error
                ? attach.error.message
                : String(attach.error),
            videoElementPresent: true,
            ...streamDiagnostics(stream),
          });
          stopStreamIfOwned(stream, stream);
          if (streamRef.current === stream) streamRef.current = null;
          setStatus("error");
          setFailureKind(attach.kind);
          setHint(cameraStartFailureMessageKo(attach.kind));
          inFlightRef.current = false;
          onStartFailedRef.current(attach.kind);
          return;
        }

        logCameraDiagnostic({
          event: "stream_attached",
          state: "capturing",
          videoElementPresent: true,
          ...streamDiagnostics(stream),
        });
        logCameraDiagnostic({
          event: "video_play_started",
          state: "capturing",
          videoElementPresent: true,
          streamActive: stream.active,
        });

        if (startupTimer) {
          clearTimeout(startupTimer);
          startupTimer = null;
        }
        liveReachedRef.current = true;
        setStatus("live");
        setHint(guidance.bodyKo);
        inFlightRef.current = false;
        logCameraDiagnostic({
          event: "camera_state_changed",
          state: "live",
          detail: "capturing_ready",
        });
        onLiveRef.current();
      } catch (err) {
        if (cancelled || gen !== startGenRef.current) {
          inFlightRef.current = false;
          return;
        }
        const kind = classifyCameraStartFailure(err, "getUserMedia");
        logCameraDiagnostic({
          event: "camera_error",
          state: "starting",
          errorName:
            err && typeof err === "object" && "name" in err
              ? String((err as { name?: unknown }).name)
              : undefined,
          errorMessage: err instanceof Error ? err.message : String(err),
          supportOk: support.supported,
          videoElementPresent: !!videoRef.current,
          ...streamDiagnostics(localStream ?? streamRef.current),
        });
        if (localStream) {
          stopStreamIfOwned(localStream, localStream);
          if (streamRef.current === localStream) streamRef.current = null;
        }
        setStatus("error");
        setFailureKind(kind);
        setHint(cameraStartFailureMessageKo(kind));
        inFlightRef.current = false;
        if (kind === "permission_denied") onPermissionDeniedRef.current();
        else if (kind === "camera_unavailable") onUnavailableRef.current();
        else onStartFailedRef.current(kind);
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (startupTimer) clearTimeout(startupTimer);
      // Stop only this effect's stream (StrictMode-safe identity).
      if (localStream) {
        stopStreamIfOwned(localStream, localStream);
        if (streamRef.current === localStream) {
          streamRef.current = null;
        }
      }
      inFlightRef.current = false;
    };
    // Parent callbacks via refs. Angle changes keep the live stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, restartToken]);

  // Final unmount — always stop owned stream.
  useEffect(() => {
    return () => {
      const owned = streamRef.current;
      if (owned) {
        stopStreamIfOwned(owned, owned);
        streamRef.current = null;
      }
    };
  }, []);

  // Update hint when angle changes without restarting camera.
  useEffect(() => {
    if (status === "live") setHint(guidance.bodyKo);
  }, [guidance.bodyKo, status]);

  async function handleShutter() {
    if (busy || disabled || !videoRef.current || status !== "live") return;
    setBusy(true);
    setHint("잠시 움직이지 마세요.");
    try {
      const shot = await captureVideoFrameToShot({
        video: videoRef.current,
        angle,
        facingMode,
      });
      onCaptured(shot);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "촬영에 실패했습니다.";
      setHint(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl bg-stone-900 aspect-[3/4] max-h-[70vh]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
          aria-label="카메라 미리보기"
        />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div className="h-[62%] w-[72%] max-w-[320px] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <p
          className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/55 px-3 py-2 text-center text-xs text-white"
          role="status"
          aria-live="polite"
        >
          {status === "starting"
            ? "카메라를 준비하는 중…"
            : status === "error"
              ? hint
              : hint}
        </p>
      </div>

      {status === "error" && failureKind ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
          role="alert"
        >
          <p className="font-semibold">
            {cameraStartFailureMessageKo(failureKind)}
          </p>
          <p className="mt-1 text-amber-900/80">
            권한은 허용됐더라도 미리보기가 시작되지 않을 수 있어요. 다시 시도하거나
            다른 방법으로 진행해 주세요.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onFacingModeChange(facingMode === "user" ? "environment" : "user")
          }
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
        >
          카메라 전환
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
        >
          촬영 종료
        </button>
        <button
          type="button"
          onClick={() => void handleShutter()}
          disabled={busy || disabled || status !== "live"}
          className="ml-auto rounded-full bg-[#C2185B] px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {busy ? "저장 중…" : "촬영"}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        자동 촬영은 아직 꺼져 있습니다. 가이드에 맞춘 뒤 촬영 버튼을 눌러 주세요.
      </p>
    </div>
  );
}
