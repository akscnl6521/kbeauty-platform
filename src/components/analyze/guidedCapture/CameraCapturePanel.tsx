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
} from "@/lib/analyze/guidedCapture/landmark/alignmentEngine";
import {
  createAutoCaptureState,
  resetAutoCaptureForNewAngle,
  tickAutoCapture,
  visualStateFromPhase,
} from "@/lib/analyze/guidedCapture/landmark/autoCaptureMachine";
import { FaceLandmarkerSession } from "@/lib/analyze/guidedCapture/landmark/faceLandmarkerClient";
import {
  isCaptureVoiceCountdownEnabled,
  isFaceLandmarkAutoCaptureEnabled,
  isLandmarkCaptureDebugEnabled,
  LANDMARK_INFER_MAX_FPS,
  LANDMARK_SLOW_MS,
} from "@/lib/analyze/guidedCapture/landmark/isEnabled";
import { sampleLiveVideoQuality } from "@/lib/analyze/guidedCapture/landmark/liveFrameQuality";
import { createCaptureSpeechController } from "@/lib/analyze/guidedCapture/landmark/speechController";
import { templateForAngle } from "@/lib/analyze/guidedCapture/landmark/templates";
import type {
  AlignmentMode,
  AutoCaptureMachineState,
  LandmarkSnapshot,
} from "@/lib/analyze/guidedCapture/landmark/types";
import type { VideoDisplayMetrics } from "@/lib/analyze/guidedCapture/landmark/displaySpace";
import {
  alignmentStatusMessage,
  capturedUtterance,
  countdownUtterance,
  holdStillUtterance,
  resolveCaptureVoiceLocale,
} from "@/lib/analyze/guidedCapture/landmark/voiceMessages";
import { FaceGuideOverlay } from "./FaceGuideOverlay";

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
  const [hint, setHint] = useState("얼굴을 가이드 안에 맞춰 주세요.");
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
  const [liveBounds, setLiveBounds] = useState<
    LandmarkSnapshot["faceBounds"]
  >(null);
  const [debugSnap, setDebugSnap] = useState<LandmarkSnapshot | null>(null);
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [debugMetrics, setDebugMetrics] = useState<VideoDisplayMetrics | null>(
    null
  );
  const [debugOn, setDebugOn] = useState(false);

  const template = useMemo(() => templateForAngle(angle), [angle]);
  const guidance = guidanceForAngle(angle);

  useEffect(() => {
    setDebugOn(isLandmarkCaptureDebugEnabled());
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
      if (cancelled || session.disposed) return;
      if (!loaded.ok) {
        logCameraDiagnostic({
          event: "camera_state_changed",
          detail: "landmark_fallback_manual",
        });
        setAlignmentMode("manual_guidance");
        setHint(
          alignmentStatusMessage(
            voiceLocale,
            "detector_unavailable",
            alignmentStatusMessageKo("detector_unavailable")
          )
        );
        return;
      }

      const minInterval = 1000 / LANDMARK_INFER_MAX_FPS;

      const loop = (nowMs: number) => {
        if (cancelled || session.disposed) return;
        if (document.visibilityState === "hidden") {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        const video = videoRef.current;
        if (!video || status !== "live") {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        if (nowMs - lastInferAtRef.current >= minInterval) {
          lastInferAtRef.current = nowMs;
          const snap = session.detect(video, {
            mirrorX: facingMode === "user",
            nowMs,
          });
          if (snap && snap.inferenceDurationMs > LANDMARK_SLOW_MS) {
            slowCountRef.current += 1;
            if (slowCountRef.current >= 8) {
              logCameraDiagnostic({
                event: "camera_state_changed",
                detail: "landmark_fallback_slow",
              });
              setAlignmentMode("manual_guidance");
              setHint(
                alignmentStatusMessage(
                  voiceLocale,
                  "inference_slow",
                  alignmentStatusMessageKo("inference_slow")
                )
              );
              speechRef.current?.cancel();
              return;
            }
          } else if (snap) {
            slowCountRef.current = Math.max(0, slowCountRef.current - 1);
          }

          const quality = sampleLiveVideoQuality(video);
          const evalResult = evaluateAlignment({
            snapshot: snap,
            template,
            quality: {
              brightnessMean: quality.brightnessMean,
              sharpnessScore: quality.sharpnessScore,
            },
            inferenceSlowMs: LANDMARK_SLOW_MS * 3,
          });

          setLastMeta({
            score: evalResult.score,
            yaw: snap?.yaw ?? null,
            pitch: snap?.pitch ?? null,
            roll: snap?.roll ?? null,
          });
          setLiveBounds(snap?.faceBounds ?? null);
          setSoftWarnings(evalResult.softWarnings);
          setFailReason(
            evalResult.status === "aligned"
              ? null
              : evalResult.reasons[0] ?? evalResult.status
          );
          if (debugOn) {
            setDebugSnap(snap);
            setDebugMetrics(session.lastMetrics);
          }

          const tick = tickAutoCapture(machineRef.current, {
            nowMs,
            alignmentStatus: evalResult.status,
            stableHoldMs: template.stableHoldMs,
          });
          machineRef.current = tick.state;
          setMachinePhase(tick.state.phase);
          setCountdownDigit(tick.state.countdownDigit);

          const koMsg = primaryGuidanceMessage(
            tick.state.alignmentStatus,
            evalResult.softWarnings,
            angle
          );
          const msg = alignmentStatusMessage(
            voiceLocale,
            tick.state.alignmentStatus,
            koMsg
          );
          setHint(msg);

          if (tick.shouldCancelSpeech) {
            speechRef.current?.cancel();
          }
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
              yaw: snap?.yaw ?? null,
              pitch: snap?.pitch ?? null,
              roll: snap?.roll ?? null,
            });
            return;
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      session.close();
      if (landmarkerRef.current === session) landmarkerRef.current = null;
      speechRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, landmarkFlag, alignmentMode, angle, facingMode, template, voiceLocale, debugOn]);

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
    if (busy || disabled || !videoRef.current || status !== "live") {
      capturingLockRef.current = false;
      return;
    }
    setBusy(true);
    setHint(
      alignmentStatusMessage(
        voiceLocale,
        "aligned",
        "잠시 움직이지 마세요."
      )
    );
    speechRef.current?.cancel();
    const pose = metaOverride ?? lastMeta;
    try {
      const meta: CapturedShotLandmarkMeta = {
        templateId: template.id,
        templateVersion: "v1",
        alignmentMode,
        alignmentScore: pose.score,
        yaw: pose.yaw,
        pitch: pose.pitch,
        roll: pose.roll,
        voiceLocale,
        autoCaptured,
      };
      const shot = await captureVideoFrameToShot({
        video: videoRef.current,
        angle,
        facingMode,
        poseCheckStatus:
          alignmentMode === "landmark_auto" && autoCaptured
            ? "landmark_aligned"
            : "manual_guidance",
        landmarkMeta: meta,
      });
      if (shot.qualityStatus === "fail") {
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
      speechRef.current?.speak(capturedUtterance(voiceLocale));
      setMachinePhase("captured");
      onCapturedRef.current(shot);
    } catch (e) {
      capturingLockRef.current = false;
      machineRef.current = createAutoCaptureState();
      setMachinePhase("adjusting");
      const msg = e instanceof Error ? e.message : "촬영에 실패했습니다.";
      setHint(msg);
    } finally {
      setBusy(false);
    }
  }

  doCaptureRef.current = doCapture;

  async function handleShutter() {
    if (alignmentMode === "landmark_auto" && machinePhase === "countdown") {
      return;
    }
    speechRef.current?.prepareFromUserGesture();
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
            debug={debugOn}
            debugSnapshot={debugSnap}
            debugSoftWarnings={softWarnings}
            debugFailReason={failReason}
            debugMetrics={debugMetrics}
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

      {alignmentMode === "manual_guidance" && status === "live" ? (
        <p className="text-xs text-amber-800" role="status">
          자동 정렬을 사용할 수 없어 수동 가이드로 촬영합니다. 눈·코·입·턱
          가이드에 맞춘 뒤 촬영을 눌러 주세요.
        </p>
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
        {process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
        process.env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "1" ? (
          <button
            type="button"
            aria-pressed={debugOn}
            onClick={() => setDebugOn((v) => !v)}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
          >
            정렬 디버그 {debugOn ? "ON" : "OFF"}
          </button>
        ) : null}
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
          disabled={
            busy ||
            disabled ||
            status !== "live" ||
            (alignmentMode === "landmark_auto" && machinePhase === "countdown")
          }
          className="ml-auto rounded-full bg-[#C2185B] px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {busy
            ? "저장 중…"
            : alignmentMode === "landmark_auto"
              ? "수동 촬영"
              : "촬영"}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        {alignmentMode === "landmark_auto"
          ? "가이드에 맞으면 음성 카운트다운 후 자동 촬영됩니다. 신원 인식이 아니며 얼굴 위치 맞춤에만 사용합니다."
          : "가이드에 맞춘 뒤 촬영 버튼을 눌러 주세요."}
      </p>
      <p className="sr-only">{guidance.bodyKo}</p>
    </div>
  );
}
