"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/hooks/useLocale";
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
import type {
  CaptureAngle,
  CapturedShot,
  CapturedShotLandmarkMeta,
} from "@/lib/analyze/guidedCapture/types";
import {
  alignmentStatusMessageKo,
  evaluateAlignment,
  primaryGuidanceMessage,
  LANDMARK_RESTART_MS,
  LANDMARK_REUSE_MS,
  LANDMARK_STALE_MS,
} from "@/lib/analyze/guidedCapture/landmark/alignmentEngine";
import {
  createAutoCaptureState,
  resetAutoCaptureForNewAngle,
  tickAutoCapture,
  visualStateFromPhase,
} from "@/lib/analyze/guidedCapture/landmark/autoCaptureMachine";
import {
  FaceLandmarkerSession,
  MAX_DETECTOR_HARD_RESTARTS,
} from "@/lib/analyze/guidedCapture/landmark/faceLandmarkerClient";
import {
  isCaptureVoiceCountdownEnabled,
  isFaceLandmarkAutoCaptureEnabled,
  LANDMARK_INFER_MAX_FPS,
  LANDMARK_SLOW_MS,
} from "@/lib/analyze/guidedCapture/landmark/isEnabled";
import { sampleLiveVideoQuality } from "@/lib/analyze/guidedCapture/landmark/liveFrameQuality";
import { createCaptureSpeechController } from "@/lib/analyze/guidedCapture/landmark/speechController";
import { templateForAngle } from "@/lib/analyze/guidedCapture/landmark/templates";
import type {
  AlignmentDiagnostics,
  AlignmentMode,
  AutoCaptureMachineState,
  LandmarkSnapshot,
} from "@/lib/analyze/guidedCapture/landmark/types";
import type {
  CoverTransform,
  VideoDisplayMetrics,
} from "@/lib/analyze/guidedCapture/landmark/displaySpace";
import {
  alignmentStatusMessage,
  capturedUtterance,
  countdownUtterance,
  holdStillUtterance,
  resolveCaptureVoiceLocale,
} from "@/lib/analyze/guidedCapture/landmark/voiceMessages";
import { FaceGuideOverlay } from "./FaceGuideOverlay";
import { LandmarkDebugPanel } from "./LandmarkDebugPanel";

/** Debug panel: URL ?landmarkDebug=1 only for auto-open. */
function shouldAutoOpenLandmarkDebug(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "1") return true;
  try {
    return new URLSearchParams(window.location.search).get("landmarkDebug") ===
      "1";
  } catch {
    return false;
  }
}

/**
 * Debug toggle only when auto landmark is ON, or developer forces ?landmarkDebug=1.
 * Default manual path never shows landmark diagnostics to users.
 */
function shouldOfferLandmarkDebugToggle(): boolean {
  if (shouldAutoOpenLandmarkDebug()) return true;
  if (!isFaceLandmarkAutoCaptureEnabled()) return false;
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") return true;
  return false;
}

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
  /** Optional — bumps parent restartToken / restarts stream. */
  onCameraRestart?: () => void;
  /** Optional — leave camera for questionnaire-only path. */
  onQuestionnaire?: () => void;
  /** Bump to force a fresh camera start (retry). */
  restartToken?: number;
  disabled?: boolean;
  localeTag?: string;
};

type PanelStatus = "starting" | "live" | "error";

function angleLabelKo(angle: CaptureAngle): string {
  if (angle === "left45") return "왼쪽 45°";
  if (angle === "right45") return "오른쪽 45°";
  return "정면";
}

function stepLabelFor(angle: CaptureAngle): string {
  if (angle === "front") return "1 / 3";
  if (angle === "left45") return "2 / 3";
  return "3 / 3";
}

function guidanceBodyForAngle(angle: CaptureAngle): string {
  if (angle === "left45") {
    return "얼굴을 화면의 왼쪽 방향으로 천천히 돌려 주세요.";
  }
  if (angle === "right45") {
    return "얼굴을 화면의 오른쪽 방향으로 천천히 돌려 주세요.";
  }
  return "얼굴을 정면으로 맞추고 가이드 안에 들어와 주세요.";
}

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
  onCameraRestart,
  onQuestionnaire,
  restartToken = 0,
  disabled,
  localeTag,
}: CameraCapturePanelProps) {
  const { locale: appLocale } = useLocale();
  const voiceLocale = resolveCaptureVoiceLocale(localeTag ?? appLocale);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startGenRef = useRef(0);
  const inFlightRef = useRef(false);
  const liveReachedRef = useRef(false);
  const onLiveRef = useRef(onLive);
  const onPermissionDeniedRef = useRef(onPermissionDenied);
  const onUnavailableRef = useRef(onUnavailable);
  const onStartFailedRef = useRef(onStartFailed);
  const onCapturedRef = useRef(onCaptured);
  const landmarkerRef = useRef<FaceLandmarkerSession | null>(null);
  const speechRef = useRef<ReturnType<typeof createCaptureSpeechController> | null>(
    null
  );
  const machineRef = useRef<AutoCaptureMachineState>(createAutoCaptureState());
  const capturingLockRef = useRef(false);
  const lastInferAtRef = useRef(0);
  const slowCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const doCaptureRef = useRef<
    (
      autoCaptured: boolean,
      metaOverride?: {
        score: number | null;
        yaw: number | null;
        pitch: number | null;
        roll: number | null;
      }
    ) => Promise<void>
  >(async () => undefined);

  const landmarkFlag = isFaceLandmarkAutoCaptureEnabled();
  const voiceFlag = isCaptureVoiceCountdownEnabled();

  const [status, setStatus] = useState<PanelStatus>("starting");
  const [hint, setHint] = useState(() => guidanceBodyForAngle(angle));
  const [busy, setBusy] = useState(false);
  const [failureKind, setFailureKind] = useState<CameraStartFailureKind | null>(
    null
  );
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>(
    landmarkFlag ? "landmark_auto" : "manual_guidance"
  );
  const [machinePhase, setMachinePhase] = useState(
    () => createAutoCaptureState().phase
  );
  const [countdownDigit, setCountdownDigit] = useState<3 | 2 | 1 | null>(null);
  const [voiceOn, setVoiceOn] = useState(voiceFlag);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lastMeta, setLastMeta] = useState<{
    score: number | null;
    yaw: number | null;
    pitch: number | null;
    roll: number | null;
  }>({ score: null, yaw: null, pitch: null, roll: null });
  const lastSnapRef = useRef<{
    snap: LandmarkSnapshot;
    atMs: number;
  } | null>(null);

  const [liveBounds, setLiveBounds] = useState<
    LandmarkSnapshot["faceBounds"]
  >(null);
  const [debugSnap, setDebugSnap] = useState<LandmarkSnapshot | null>(null);
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<AlignmentDiagnostics | null>(
    null
  );
  const [debugMetrics, setDebugMetrics] = useState<VideoDisplayMetrics | null>(
    null
  );
  const [coverInfo, setCoverInfo] = useState<CoverTransform | null>(null);
  const [debugToggleOffered, setDebugToggleOffered] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [expandedDebug, setExpandedDebug] = useState(false);
  const [preferManualShutter, setPreferManualShutter] = useState(false);
  const preferManualRef = useRef(false);
  const loopGenerationRef = useRef(0);

  const template = useMemo(() => templateForAngle(angle), [angle]);
  const guidance = guidanceForAngle(angle);

  useEffect(() => {
    setDebugToggleOffered(shouldOfferLandmarkDebugToggle());
    setDebugOpen(shouldAutoOpenLandmarkDebug());
  }, []);

  useEffect(() => {
    onLiveRef.current = onLive;
    onPermissionDeniedRef.current = onPermissionDenied;
    onUnavailableRef.current = onUnavailable;
    onStartFailedRef.current = onStartFailed;
    onCapturedRef.current = onCaptured;
  }, [onLive, onPermissionDenied, onUnavailable, onStartFailed, onCaptured]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Speech controller lifecycle
  useEffect(() => {
    speechRef.current = createCaptureSpeechController({
      localeTag: voiceLocale,
      enabled: voiceOn && voiceFlag,
    });
    return () => {
      speechRef.current?.dispose();
      speechRef.current = null;
    };
  }, [voiceLocale, voiceFlag]);

  useEffect(() => {
    speechRef.current?.setEnabled(voiceOn && voiceFlag);
  }, [voiceOn, voiceFlag]);

  // Reset auto-capture machine when angle changes
  useEffect(() => {
    machineRef.current = resetAutoCaptureForNewAngle(machineRef.current);
    capturingLockRef.current = false;
    setCountdownDigit(null);
    setMachinePhase("adjusting");
    setHint(guidanceBodyForAngle(angle));
  }, [angle]);

  // Camera start
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

      // Unlock speech API inside user gesture chain when possible.
      speechRef.current?.prepareFromUserGesture();

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
            speechRef.current?.cancel();
            machineRef.current = createAutoCaptureState();
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

        if (startupTimer) {
          clearTimeout(startupTimer);
          startupTimer = null;
        }
        liveReachedRef.current = true;
        setStatus("live");
        setHint(guidanceBodyForAngle(angle));
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
      if (localStream) {
        stopStreamIfOwned(localStream, localStream);
        if (streamRef.current === localStream) {
          streamRef.current = null;
        }
      }
      inFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, restartToken]);

  // Final unmount
  useEffect(() => {
    return () => {
      const owned = streamRef.current;
      if (owned) {
        stopStreamIfOwned(owned, owned);
        streamRef.current = null;
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      speechRef.current?.cancel();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Page hide → stop inference + speech
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        speechRef.current?.cancel();
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Landmark model load + inference loop
  useEffect(() => {
    if (status !== "live") return;
    if (!landmarkFlag || alignmentMode !== "landmark_auto") return;

    let cancelled = false;
    const loopGen = ++loopGenerationRef.current;
    const session = new FaceLandmarkerSession();
    landmarkerRef.current = session;
    setHint(
      alignmentStatusMessage(
        voiceLocale,
        "loading_model",
        alignmentStatusMessageKo("loading_model")
      )
    );

    void (async () => {
      const loaded = await session.load();
      if (cancelled || session.disposed || loopGen !== loopGenerationRef.current) {
        return;
      }
      if (!loaded.ok) {
        logCameraDiagnostic({
          event: "camera_state_changed",
          detail: "landmark_fallback_manual",
        });
        preferManualRef.current = true;
        setPreferManualShutter(true);
        setHint(
          "자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."
        );
        return;
      }

      const minInterval = 1000 / LANDMARK_INFER_MAX_FPS;
      lastSnapRef.current = null;
      let badSinceMs: number | null = null;
      let restartInFlight = false;
      let autoCapturePaused = preferManualRef.current;

      const scheduleNext = () => {
        if (cancelled || session.disposed) return;
        if (loopGen !== loopGenerationRef.current) return;
        rafRef.current = requestAnimationFrame(loop);
      };

      const loop = (nowMs: number) => {
        if (cancelled || session.disposed || loopGen !== loopGenerationRef.current) {
          return;
        }
        const loopRunningFlag = true;
        try {
          if (document.visibilityState === "hidden") {
            scheduleNext();
            return;
          }
          const video = videoRef.current;
          if (!video) {
            scheduleNext();
            return;
          }

          const outcome = session.detect(video, {
            mirrorX: facingMode === "user",
            nowMs,
            minIntervalMs: minInterval,
          });

          let snapshot: LandmarkSnapshot | null = null;
          let ageMs: number | null = null;
          let transformOk = true;
          let invalidLandmark = false;
          let invalidStage: string | null = null;
          let poseReliable: boolean | null = null;
          let traceExtras: Partial<AlignmentDiagnostics> = {
            loopRunning: loopRunningFlag,
            ...session.stats,
            lockState: session.lockState,
            detectorRestartCount: session.restartCount,
            inferenceError: session.stats.inferenceError,
          };

          const mergeTrace = (t: {
            rawC: string;
            rawBounds: string;
            preMirrorC: string;
            displayC: string;
            invalidStage: string | null;
            faceLandmarksPresent: boolean;
            faceCount: number;
            landmarkArrayLength: number;
            firstPointKeys: string;
            validPointCount: number;
            invalidPointCount: number;
            sample0: string;
            parseNote: string;
          }) => {
            traceExtras = {
              ...traceExtras,
              rawC: t.rawC,
              rawBounds: t.rawBounds,
              preMirrorC: t.preMirrorC,
              displayC: t.displayC,
              invalidStage: t.invalidStage,
              faceLandmarksPresent: t.faceLandmarksPresent,
              landmarkArrayLength: t.landmarkArrayLength,
              firstPointKeys: t.firstPointKeys,
              validPointCount: t.validPointCount,
              invalidPointCount: t.invalidPointCount,
              sample0: t.sample0,
              parseNote: t.parseNote,
            };
          };

          if (outcome.status === "transform_error") {
            transformOk = false;
            setDebugMetrics(outcome.metrics);
            lastSnapRef.current = null;
            badSinceMs = badSinceMs ?? nowMs;
          } else if (outcome.status === "invalid_landmark_data") {
            invalidLandmark = true;
            invalidStage = outcome.invalidStage;
            setDebugMetrics(outcome.metrics);
            if (outcome.cover) setCoverInfo(outcome.cover);
            lastSnapRef.current = null;
            badSinceMs = badSinceMs ?? nowMs;
            mergeTrace(outcome.trace);
          } else if (outcome.status === "inference_error") {
            lastSnapRef.current = null;
            badSinceMs = badSinceMs ?? nowMs;
            session.softReset();
            traceExtras = {
              ...traceExtras,
              inferenceError: outcome.reason,
            };
          } else if (outcome.status === "ok") {
            if (
              outcome.snapshot.faceCount === 0 ||
              (outcome.snapshot.faceBounds &&
                Number.isFinite(outcome.snapshot.faceBounds.xMin) &&
                Math.abs(outcome.snapshot.faceBounds.xMin) < 10)
            ) {
              if (outcome.snapshot.faceCount > 0) {
                lastSnapRef.current = {
                  snap: outcome.snapshot,
                  atMs: nowMs,
                };
                // Recover auto path when valid landmarks return
                if (autoCapturePaused && outcome.snapshot.faceBounds) {
                  autoCapturePaused = false;
                  preferManualRef.current = false;
                  setPreferManualShutter(false);
                }
              } else {
                lastSnapRef.current = null;
              }
              snapshot = outcome.snapshot;
              ageMs = 0;
              badSinceMs = null;
            } else {
              invalidLandmark = true;
              invalidStage = "ok_but_exploded";
              lastSnapRef.current = null;
              badSinceMs = badSinceMs ?? nowMs;
            }
            poseReliable = outcome.poseReliable;
            setDebugMetrics(outcome.metrics);
            setCoverInfo(outcome.cover);
            mergeTrace(outcome.trace);
            if (outcome.snapshot.inferenceDurationMs > LANDMARK_SLOW_MS) {
              slowCountRef.current += 1;
              if (slowCountRef.current >= 12) {
                autoCapturePaused = true;
                preferManualRef.current = true;
                setPreferManualShutter(true);
                setHint(
                  "자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."
                );
                speechRef.current?.cancel();
                // Keep loop alive — do not set loopRunning false.
              }
            } else {
              slowCountRef.current = Math.max(0, slowCountRef.current - 1);
            }
          } else if (
            lastSnapRef.current &&
            nowMs - lastSnapRef.current.atMs <= LANDMARK_REUSE_MS
          ) {
            snapshot = lastSnapRef.current.snap;
            ageMs = nowMs - lastSnapRef.current.atMs;
          } else if (lastSnapRef.current) {
            snapshot = lastSnapRef.current.snap;
            ageMs = nowMs - lastSnapRef.current.atMs;
            if (ageMs > LANDMARK_STALE_MS) {
              badSinceMs = badSinceMs ?? nowMs;
            }
          }

          // Auto-recover: max 2 hard restarts, then prefer manual without killing loop
          if (
            badSinceMs != null &&
            nowMs - badSinceMs > LANDMARK_RESTART_MS &&
            !restartInFlight
          ) {
            if (session.restartCount >= MAX_DETECTOR_HARD_RESTARTS) {
              autoCapturePaused = true;
              preferManualRef.current = true;
              setPreferManualShutter(true);
              setHint(
                "자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."
              );
              badSinceMs = null;
            } else {
              restartInFlight = true;
              setHint("얼굴 인식을 다시 시작하고 있어요.");
              void (async () => {
                try {
                  session.softReset();
                  lastSnapRef.current = null;
                  const ok = await session.hardRestart();
                  if (!ok && !cancelled) {
                    autoCapturePaused = true;
                    preferManualRef.current = true;
                    setPreferManualShutter(true);
                    setHint(
                      "자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."
                    );
                  }
                } finally {
                  restartInFlight = false;
                  badSinceMs = null;
                }
              })();
            }
          }

          const quality = sampleLiveVideoQuality(video);
          const evalResult = evaluateAlignment({
            snapshot,
            template,
            quality: {
              brightnessMean: quality.brightnessMean,
              sharpnessScore: quality.sharpnessScore,
            },
            inferenceSlowMs: LANDMARK_SLOW_MS * 3,
            landmarkAgeMs: ageMs,
            transformOk,
            invalidLandmark,
            invalidStage,
            poseReliable,
            diagExtras: traceExtras,
          });

          setLastMeta({
            score: evalResult.score,
            yaw: snapshot?.yaw ?? null,
            pitch: snapshot?.pitch ?? null,
            roll: snapshot?.roll ?? null,
          });
          setLiveBounds(
            evalResult.status === "invalid_landmark_data"
              ? null
              : snapshot?.faceBounds ?? null
          );
          setSoftWarnings(evalResult.softWarnings);
          setFailReason(evalResult.primaryFailReason);
          setDiagnostics(evalResult.diagnostics);
          if (expandedDebug) setDebugSnap(snapshot);

          const statusForMachine =
            autoCapturePaused || preferManualRef.current
              ? evalResult.status === "aligned"
                ? "aligned"
                : evalResult.status
              : evalResult.status;

          // When preferring manual, still allow auto if aligned recovered
          const tick = tickAutoCapture(machineRef.current, {
            nowMs,
            alignmentStatus:
              preferManualRef.current && statusForMachine !== "aligned"
                ? "invalid_landmark_data"
                : statusForMachine,
            stableHoldMs: template.stableHoldMs,
          });
          machineRef.current = tick.state;
          setMachinePhase(tick.state.phase);
          setCountdownDigit(tick.state.countdownDigit);

          const koMsg =
            preferManualRef.current && evalResult.status !== "aligned"
              ? "자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."
              : primaryGuidanceMessage(
                  tick.state.alignmentStatus,
                  evalResult.softWarnings,
                  angle,
                  evalResult.primaryFailReason
                );
          setHint(
            preferManualRef.current && evalResult.status !== "aligned"
              ? koMsg
              : alignmentStatusMessage(
                  voiceLocale,
                  tick.state.alignmentStatus,
                  koMsg
                )
          );

          if (!preferManualRef.current) {
            if (tick.shouldCancelSpeech) speechRef.current?.cancel();
            if (tick.speakHoldStill) {
              speechRef.current?.speak(holdStillUtterance(voiceLocale));
            }
            if (tick.speakDigit) {
              speechRef.current?.speak(
                countdownUtterance(voiceLocale, tick.speakDigit)
              );
            }
            if (tick.shouldCapture && !capturingLockRef.current) {
              capturingLockRef.current = true;
              void doCaptureRef.current(true, {
                score: evalResult.score,
                yaw: snapshot?.yaw ?? null,
                pitch: snapshot?.pitch ?? null,
                roll: snapshot?.roll ?? null,
              });
            }
          }
        } catch {
          session.softReset();
          lastSnapRef.current = null;
        } finally {
          scheduleNext();
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Only dispose this effect's session — ignore stale cleanups after remount.
      session.close();
      if (landmarkerRef.current === session) landmarkerRef.current = null;
      speechRef.current?.cancel();
    };
    // Do NOT depend on expandedDebug — toggling debug must not restart detector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, landmarkFlag, alignmentMode, angle, facingMode, template, voiceLocale]);

  // Cancel speech when leaving countdown due to misalignment is handled in tick;
  // extra: when alignment leaves aligned during countdown cancel speech
  useEffect(() => {
    if (machinePhase === "adjusting") {
      // keep quiet after cancel
    }
  }, [machinePhase]);

  async function doCapture(
    autoCaptured: boolean,
    metaOverride?: {
      score: number | null;
      yaw: number | null;
      pitch: number | null;
      roll: number | null;
    }
  ) {
    const video = videoRef.current;
    // Manual capture must work without landmarks / while loop is paused.
    if (disabled || !video || status !== "live") {
      capturingLockRef.current = false;
      return;
    }
    if (video.videoWidth < 2 || video.videoHeight < 2) {
      capturingLockRef.current = false;
      setHint("카메라 프레임을 아직 준비하지 못했어요. 잠시 후 다시 눌러 주세요.");
      return;
    }
    if (busy) {
      // Allow manual retry if a previous capture left busy stuck.
      if (!autoCaptured) {
        setBusy(false);
      } else {
        capturingLockRef.current = false;
        return;
      }
    }
    setBusy(true);
    setHint("잠시 움직이지 마세요.");
    speechRef.current?.cancel();
    const pose = metaOverride ?? lastMeta;
    try {
      const meta: CapturedShotLandmarkMeta = {
        templateId: template.id,
        templateVersion: "v1",
        alignmentMode: autoCaptured ? alignmentMode : "manual_guidance",
        alignmentScore: pose.score,
        yaw: pose.yaw,
        pitch: pose.pitch,
        roll: pose.roll,
        voiceLocale,
        autoCaptured,
      };
      const shot = await captureVideoFrameToShot({
        video,
        angle,
        facingMode,
        poseCheckStatus:
          alignmentMode === "landmark_auto" && autoCaptured
            ? "landmark_aligned"
            : "manual_guidance",
        landmarkMeta: meta,
      });
      if (shot.qualityStatus === "fail" && autoCaptured) {
        machineRef.current = {
          ...createAutoCaptureState(),
          phase: "quality_failed",
          capturedForAngle: false,
        };
        capturingLockRef.current = false;
        setMachinePhase("quality_failed");
        setHint("사진 품질이 부족합니다. 다시 맞춰 주세요.");
        setBusy(false);
        onCapturedRef.current(shot);
        return;
      }
      // Manual: deliver even with quality warnings so user is not blocked.
      speechRef.current?.speak(capturedUtterance(voiceLocale));
      setMachinePhase("captured");
      onCapturedRef.current(
        autoCaptured || shot.qualityStatus === "pass"
          ? shot
          : { ...shot, qualityStatus: "pass" }
      );
    } catch (e) {
      capturingLockRef.current = false;
      machineRef.current = createAutoCaptureState();
      setMachinePhase("adjusting");
      const msg = e instanceof Error ? e.message : "촬영에 실패했습니다.";
      setHint(msg);
    } finally {
      setBusy(false);
      capturingLockRef.current = false;
    }
  }

  doCaptureRef.current = doCapture;

  async function handleShutter() {
    // Manual shutter is never blocked by landmark/countdown except active auto countdown.
    if (
      alignmentMode === "landmark_auto" &&
      machinePhase === "countdown" &&
      !preferManualShutter
    ) {
      return;
    }
    speechRef.current?.prepareFromUserGesture();
    capturingLockRef.current = false;
    await doCapture(false);
  }

  const visualState =
    status === "error"
      ? "error"
      : status === "starting"
        ? "neutral"
        : visualStateFromPhase(machinePhase);

  const displayMessage =
    status === "starting"
      ? "카메라를 준비하는 중…"
      : status === "error"
        ? hint
        : hint;

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
        {status === "live" || status === "starting" ? (
          <FaceGuideOverlay
            template={template}
            visualState={visualState}
            countdownDigit={status === "live" ? countdownDigit : null}
            message={displayMessage}
            angleLabel={angleLabelKo(angle)}
            stepLabel={stepLabelFor(angle)}
            reducedMotion={reducedMotion}
            liveBounds={liveBounds}
            simplified={
              !landmarkFlag ||
              preferManualShutter ||
              alignmentMode === "manual_guidance" ||
              failReason === "invalid_landmark_data"
            }
            showLandmarkDots={expandedDebug && debugOpen}
            debugSnapshot={debugSnap}
          />
        ) : (
          <p
            className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/55 px-3 py-2 text-center text-xs text-white"
            role="status"
            aria-live="polite"
          >
            {hint}
          </p>
        )}
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
            사진 없이 문진으로 계속해 주세요.
          </p>
        </div>
      ) : null}

      {(landmarkFlag &&
        (preferManualShutter || alignmentMode === "manual_guidance") &&
        status === "live") ? (
        <p className="text-xs text-amber-900" role="status">
          자동 얼굴 정렬을 사용할 수 없어요. 가이드에 얼굴을 맞춘 뒤 촬영 버튼을
          눌러 주세요.
        </p>
      ) : null}

      {landmarkFlag && debugToggleOffered ? (
        <LandmarkDebugPanel
          open={debugOpen}
          onToggle={() => {
            setDebugOpen((v) => {
              const next = !v;
              if (!next) setExpandedDebug(false);
              return next;
            });
          }}
          diagnostics={diagnostics}
          cover={coverInfo}
          metrics={debugMetrics}
          softWarnings={softWarnings}
          primaryFailReason={failReason}
        />
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
        {voiceFlag ? (
          <button
            type="button"
            aria-pressed={voiceOn}
            onClick={() => {
              const next = !voiceOn;
              setVoiceOn(next);
              if (!next) speechRef.current?.cancel();
              else speechRef.current?.prepareFromUserGesture();
            }}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            음성 안내 {voiceOn ? "켜짐" : "꺼짐"}
          </button>
        ) : null}
        {debugOpen ? (
          <button
            type="button"
            aria-pressed={expandedDebug}
            onClick={() => setExpandedDebug((v) => !v)}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            랜드마크 점 {expandedDebug ? "ON" : "OFF"}
          </button>
        ) : null}
        {onCameraRestart ? (
          <button
            type="button"
            onClick={onCameraRestart}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            카메라 다시 시작
          </button>
        ) : null}
        {onQuestionnaire ? (
          <button
            type="button"
            onClick={onQuestionnaire}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            사진 없이 문진으로 계속하기
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            촬영 종료
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleShutter()}
          disabled={busy || disabled || status !== "live"}
          className="ml-auto rounded-full bg-[#C2185B] px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          data-testid="analyze-manual-shutter"
        >
          {busy ? "저장 중…" : "촬영"}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        {landmarkFlag && alignmentMode === "landmark_auto" && !preferManualShutter
          ? "가이드에 맞으면 음성 카운트다운 후 자동 촬영됩니다. 필요하면 촬영 버튼으로도 찍을 수 있어요."
          : "가이드에 얼굴을 맞춘 뒤 촬영 버튼을 눌러 주세요."}
      </p>
      <p className="sr-only">{guidance.bodyKo}</p>
    </div>
  );
}
