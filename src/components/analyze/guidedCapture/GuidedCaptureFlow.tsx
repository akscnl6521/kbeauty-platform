"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/hooks/useLocale";
import {
  PhotoConsentPanel,
  photoConsentBlockedMessage,
  photoAnalysisOnlyAckMessage,
} from "@/components/care/PhotoConsentPanel";
import {
  defaultPhotoConsentChoices,
  shouldAutoPurgeAfterAnalysis,
  validatePhotoConsentChoices,
  type PhotoConsentChoices,
} from "@/lib/care/photoComparisonPolicy";
import {
  ANALYSIS_TIMEOUT_MS,
  advanceLocalPhase,
  canStartAnalyze,
  createInitialProgress,
  markCompleted,
  markFailed,
  softProgressPercent,
  tickWaitingProgress,
  type AnalysisProgressSnapshot,
} from "@/lib/analyze/guidedCapture/analysisProgress";
import { detectCameraSupport } from "@/lib/analyze/guidedCapture/cameraSupport";
import {
  acceptShot,
  allRequiredShotsPassed,
  applyCameraStartFailed,
  applyCameraUnavailable,
  applyPermissionDenied,
  applyVideoPlayFailed,
  attachRequestId,
  beginCameraRequest,
  cancelSession,
  confirmReview,
  createEmptyCaptureSession,
  createRequestId,
  primaryShotForAnalysis,
  retakeAngle,
  startCapturing,
  angleFromCapturingState,
} from "@/lib/analyze/guidedCapture/captureSession";
import type { CameraStartFailureKind } from "@/lib/analyze/guidedCapture/cameraStart";
import { cameraStartFailureMessageKo } from "@/lib/analyze/guidedCapture/cameraStart";
import {
  checkBrightnessVarianceAcrossShots,
  qualityReasonMessageKo,
} from "@/lib/analyze/guidedCapture/qualityCheck";
import { revokeAllShotUrls } from "@/lib/analyze/guidedCapture/sessionCleanup";
import {
  ANALYSIS_SCOPE_COPY_KO,
  CAMERA_ONLY_POLICY_COPY_KO,
} from "@/lib/analyze/guidedCapture/inputPolicy";
import type {
  CaptureAngle,
  CaptureFlowState,
  CaptureSession,
  CapturedShot,
} from "@/lib/analyze/guidedCapture/types";
import { CaptureAngleStepper } from "./CaptureAngleStepper";
import type { CameraCapturePanelProps } from "./CameraCapturePanel";
import { CaptureReviewCard } from "./CaptureReviewCard";
import { AnalysisProgressOverlay } from "./AnalysisProgressOverlay";

const CameraCapturePanel = dynamic<CameraCapturePanelProps>(
  () =>
    import("./CameraCapturePanel").then((module) => module.CameraCapturePanel),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600"
        role="status"
        aria-live="polite"
      >
        카메라를 준비하고 있어요…
      </div>
    ),
  }
);

export type GuidedCaptureAnalyzePayload = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  requestId: string;
  photoConsentChoices: PhotoConsentChoices;
};

export type GuidedCaptureFlowProps = {
  onAnalyze: (payload: GuidedCaptureAnalyzePayload) => Promise<void>;
  onSwitchToManual: () => void;
  /** Called after successful analyze (parent navigates). */
  onAnalyzeSuccess?: () => void;
};

type EntryChoice = "chooser" | "camera" | "ready";

function isCapturing(state: CaptureFlowState): boolean {
  return (
    state === "capturing_front" ||
    state === "capturing_left" ||
    state === "capturing_right"
  );
}

function isCameraPanelState(state: CaptureFlowState): boolean {
  return (
    state === "requesting_permission" ||
    isCapturing(state) ||
    state === "camera_start_failed" ||
    state === "video_play_failed"
  );
}

function isReviewing(state: CaptureFlowState): boolean {
  return (
    state === "reviewing_front" ||
    state === "reviewing_left" ||
    state === "reviewing_right" ||
    state === "quality_failed"
  );
}

function mediaTypeFromMime(
  mime: string
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "image/png";
  if (m.includes("webp")) return "image/webp";
  if (m.includes("gif")) return "image/gif";
  return "image/jpeg";
}

export function GuidedCaptureFlow({
  onAnalyze,
  onSwitchToManual,
  onAnalyzeSuccess,
}: GuidedCaptureFlowProps) {
  const { locale } = useLocale();
  const [session, setSession] = useState<CaptureSession>(() =>
    createEmptyCaptureSession()
  );
  const [entry, setEntry] = useState<EntryChoice>("chooser");
  const [consent, setConsent] = useState<PhotoConsentChoices>(
    defaultPhotoConsentChoices()
  );
  const [consentAck, setConsentAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgressSnapshot | null>(
    null
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [leaveWarn, setLeaveWarn] = useState(false);
  const [cameraRestartToken, setCameraRestartToken] = useState(0);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const currentAngle: CaptureAngle =
    angleFromCapturingState(session.state) ??
    session.failedAngle ??
    "front";

  const passedMap = useMemo(() => {
    const out: Partial<Record<CaptureAngle, boolean>> = {};
    for (const [k, v] of Object.entries(session.shots)) {
      out[k as CaptureAngle] = v?.qualityStatus === "pass";
    }
    return out;
  }, [session.shots]);

  const cleanupShots = useCallback((shots: CaptureSession["shots"]) => {
    revokeAllShotUrls(shots);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    return () => {
      cleanupShots(session.shots);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  useEffect(() => {
    const dirty =
      Object.keys(session.shots).length > 0 &&
      session.state !== "ready_for_analysis" &&
      session.state !== "canceled";
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session.shots, session.state]);

  function resetToChooser(nextSession?: CaptureSession) {
    cleanupShots(session.shots);
    setSession(nextSession ?? createEmptyCaptureSession());
    setEntry("chooser");
    setError(null);
    setLeaveWarn(false);
  }

  function startCameraFlow() {
    const support = detectCameraSupport(
      typeof window !== "undefined" ? window : null
    );
    if (!support.supported) {
      setSession(applyCameraUnavailable(createEmptyCaptureSession()));
      setEntry("chooser");
      setError(
        support.reason === "insecure_context"
          ? "안전한 연결(HTTPS)에서만 카메라를 사용할 수 있어요. 사진 없이 문진으로 계속해 주세요."
          : "이 기기에서는 카메라를 사용할 수 없어요. 사진 없이 문진으로 계속해 주세요."
      );
      return;
    }
    setError(null);
    // Stay on requesting_permission until preview is live — do not fake capturing.
    setSession(beginCameraRequest(createEmptyCaptureSession()));
    setEntry("camera");
    setCameraRestartToken((n) => n + 1);
  }

  const handleCameraLive = useCallback(() => {
    setSession((s) => {
      if (isCapturing(s.state)) return s;
      const angle =
        angleFromCapturingState(s.state) ??
        s.failedAngle ??
        "front";
      return startCapturing(s, angle);
    });
    setError(null);
  }, []);

  const handlePermissionDenied = useCallback(() => {
    setSession((s) => applyPermissionDenied(s));
    setEntry("chooser");
    setError(
      `${cameraStartFailureMessageKo("permission_denied")} ${CAMERA_ONLY_POLICY_COPY_KO.permissionHelp}`
    );
  }, []);

  const handleUnavailable = useCallback(() => {
    setSession((s) => applyCameraUnavailable(s));
    setEntry("chooser");
    setError(cameraStartFailureMessageKo("camera_unavailable"));
  }, []);

  const handleStartFailed = useCallback((kind: CameraStartFailureKind) => {
    setSession((s) => {
      if (kind === "video_play_failed") return applyVideoPlayFailed(s);
      return applyCameraStartFailed(s);
    });
    setError(cameraStartFailureMessageKo(kind));
  }, []);

  function retryCamera() {
    setError(null);
    setSession((s) => beginCameraRequest({ ...s, shots: s.shots }));
    setEntry("camera");
    setCameraRestartToken((n) => n + 1);
  }

  function onShotAccepted(shot: CapturedShot) {
    setSession((s) => {
      const prev = s.shots[shot.angle];
      if (prev) revokeAllShotUrls({ [shot.angle]: prev });
      return acceptShot(s, shot);
    });
  }

  function confirmCurrentReview() {
    const angle =
      session.failedAngle ??
      angleFromCapturingState(session.state) ??
      currentAngle;
    const shot = session.shots[angle];
    if (!shot) return;

    const brightnessVar = checkBrightnessVarianceAcrossShots(
      Object.values(session.shots).map((s) => s?.brightnessScore)
    );
    if (brightnessVar && allRequiredShotsPassed({ ...session, shots: { ...session.shots, [angle]: shot } })) {
      // soft warning only — do not wipe other shots
      setError(qualityReasonMessageKo(brightnessVar));
    }

    setSession((s) => confirmReview(s, angle));
  }

  function stopProgressTicker() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function runAnalyze() {
    if (!canStartAnalyze({ inFlight: inFlightRef.current })) return;
    if (!allRequiredShotsPassed(session) && session.state !== "ready_for_analysis") {
      setError("정면·왼쪽·오른쪽 사진이 모두 필요합니다.");
      return;
    }
    const primary = primaryShotForAnalysis(session);
    if (!primary) {
      setError("분석에 사용할 사진이 없습니다.");
      return;
    }
    const blocked = photoConsentBlockedMessage(consent);
    if (blocked) {
      setError(blocked);
      return;
    }
    const validation = validatePhotoConsentChoices(consent);
    setConsentAck(
      shouldAutoPurgeAfterAnalysis(validation.effectiveMode)
        ? photoAnalysisOnlyAckMessage()
        : null
    );

    const requestId = createRequestId();
    setSession((s) => attachRequestId(s, requestId));
    inFlightRef.current = true;
    setAnalyzing(true);
    startedAtRef.current = Date.now();
    let snap = createInitialProgress(requestId);
    snap = advanceLocalPhase(snap, "checking_photo_quality", 0);
    snap = advanceLocalPhase(snap, "uploading", 200);
    snap = advanceLocalPhase(snap, "analyzing", 400);
    setProgress(snap);
    setError(null);

    stopProgressTicker();
    tickRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setProgress((prev) => {
        if (!prev || !prev.inFlight) return prev;
        if (elapsed >= ANALYSIS_TIMEOUT_MS) {
          return markFailed(prev, "timed_out");
        }
        return tickWaitingProgress(prev, elapsed);
      });
    }, 400);

    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("ANALYSIS_TIMEOUT"));
      }, ANALYSIS_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        onAnalyze({
          imageBase64: primary.imageBase64,
          mediaType: mediaTypeFromMime(primary.mimeType),
          requestId,
          photoConsentChoices: consent,
        }),
        timeoutPromise,
      ]);

      const elapsed = Date.now() - startedAtRef.current;
      setProgress((prev) => {
        if (!prev) return prev;
        let next = advanceLocalPhase(
          { ...prev, percent: Math.max(prev.percent, softProgressPercent(elapsed)) },
          "matching_scenario",
          elapsed
        );
        next = advanceLocalPhase(next, "checking_ingredients", elapsed + 50);
        next = advanceLocalPhase(next, "ranking_products", elapsed + 100);
        next = advanceLocalPhase(next, "building_routine", elapsed + 150);
        next = advanceLocalPhase(next, "saving_result", elapsed + 200);
        return markCompleted(next, [
          ...next.completedPhases,
          "saving_result",
        ]);
      });
      stopProgressTicker();
      inFlightRef.current = false;
      setAnalyzing(false);
      cleanupShots(session.shots);
      setSession((s) => ({ ...s, shots: {}, state: "ready_for_analysis" }));
      onAnalyzeSuccess?.();
    } catch (e) {
      stopProgressTicker();
      inFlightRef.current = false;
      setAnalyzing(false);
      const isTimeout =
        e instanceof Error &&
        (e.message === "ANALYSIS_TIMEOUT" || /timeout/i.test(e.message));
      setProgress((prev) =>
        prev ? markFailed(prev, isTimeout ? "timed_out" : "failed") : prev
      );
      if (!isTimeout) {
        setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
      }
    }
  }

  const showCamera =
    entry === "camera" && isCameraPanelState(session.state);
  const showCameraFailureActions =
    session.state === "camera_start_failed" ||
    session.state === "video_play_failed";
  const reviewShot =
    isReviewing(session.state)
      ? session.shots[
          session.failedAngle ??
            angleFromCapturingState(session.state) ??
            currentAngle
        ]
      : null;

  return (
    <div className="space-y-4">
      <PhotoConsentPanel
        value={consent}
        onChange={(c) => setConsent(c)}
        compact
      />
      <div className="rounded-2xl border border-[#E8DFD8] bg-[#FAF7F4] p-3 text-xs leading-5 text-stone-700">
        <p>{CAMERA_ONLY_POLICY_COPY_KO.currentSkinOnly}</p>
        <p>{CAMERA_ONLY_POLICY_COPY_KO.noGallery}</p>
        <p>{CAMERA_ONLY_POLICY_COPY_KO.questionnaireFallback}</p>
        <p className="mt-2">{ANALYSIS_SCOPE_COPY_KO.capturePurpose}</p>
        <p>{ANALYSIS_SCOPE_COPY_KO.noExternalVision}</p>
        <p>{ANALYSIS_SCOPE_COPY_KO.noIdentity}</p>
        <p className="mt-1 text-stone-500">
          {ANALYSIS_SCOPE_COPY_KO.noPermanentStoreDefault}
        </p>
      </div>

      {entry === "chooser" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-stone-900">
            분석 입력 방식을 선택하세요
          </p>
          <div className="grid gap-2">
            <button
              type="button"
              data-testid="analyze-camera-start"
              onClick={startCameraFlow}
              className="rounded-2xl bg-[#C2185B] px-4 py-3 text-left text-sm font-semibold text-white"
            >
              카메라로 현재 피부 촬영하기
              <span className="mt-1 block text-xs font-normal text-white/85">
                정면 · 왼쪽 45° · 오른쪽 45° 안내 촬영
              </span>
            </button>
            <button
              type="button"
              data-testid="analyze-questionnaire-only"
              onClick={onSwitchToManual}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left text-sm font-semibold text-stone-800"
            >
              사진 없이 문진으로 계속하기
              <span className="mt-1 block text-xs font-normal text-stone-500">
                촬영이 어렵거나 카메라가 없으면 문진만으로 진행합니다
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {(showCamera || reviewShot || session.state === "ready_for_analysis") && (
        <CaptureAngleStepper current={currentAngle} passed={passedMap} />
      )}

      {showCamera ? (
        <CameraCapturePanel
          angle={currentAngle}
          facingMode={session.activeFacingMode}
          restartToken={cameraRestartToken}
          localeTag={locale}
          onFacingModeChange={(mode) =>
            setSession((s) => ({ ...s, activeFacingMode: mode }))
          }
          onCaptured={onShotAccepted}
          onLive={handleCameraLive}
          onPermissionDenied={handlePermissionDenied}
          onUnavailable={handleUnavailable}
          onStartFailed={handleStartFailed}
          onCancel={() => {
            if (Object.keys(session.shots).length > 0) {
              setLeaveWarn(true);
              return;
            }
            resetToChooser(cancelSession(session));
          }}
          onCameraRestart={retryCamera}
          onQuestionnaire={onSwitchToManual}
        />
      ) : null}

      {showCameraFailureActions ? (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-xs text-amber-950">
            {CAMERA_ONLY_POLICY_COPY_KO.permissionHelp}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="analyze-camera-retry"
              onClick={retryCamera}
              className="rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white"
            >
              카메라 다시 시도
            </button>
            <button
              type="button"
              data-testid="analyze-camera-fail-questionnaire"
              onClick={onSwitchToManual}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
            >
              사진 없이 문진으로 계속하기
            </button>
          </div>
        </div>
      ) : null}

      {reviewShot ? (
        <CaptureReviewCard
          shot={reviewShot}
          onRetake={() =>
            setSession((s) =>
              retakeAngle(
                s,
                s.failedAngle ??
                  angleFromCapturingState(s.state) ??
                  currentAngle
              )
            )
          }
          onConfirm={confirmCurrentReview}
        />
      ) : null}

      {session.state === "ready_for_analysis" ? (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            {ANALYSIS_SCOPE_COPY_KO.readyAfterThreeShots}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["front", "left45", "right45"] as CaptureAngle[]).map((a) => {
              const shot = session.shots[a];
              if (!shot) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a}
                  src={shot.previewUrl}
                  alt={`${a} 썸네일`}
                  className="aspect-square rounded-xl object-cover"
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={analyzing}
              className="rounded-full bg-[#C2185B] px-5 py-2 text-xs font-semibold text-white disabled:bg-stone-300"
            >
              {analyzing
                ? ANALYSIS_SCOPE_COPY_KO.startGuideCtaBusy
                : ANALYSIS_SCOPE_COPY_KO.startGuideCta}
            </button>
            <button
              type="button"
              onClick={() => {
                setSession((s) => retakeAngle(s, "front"));
                setEntry("camera");
                setCameraRestartToken((n) => n + 1);
              }}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
            >
              일부 다시 촬영
            </button>
          </div>
        </div>
      ) : null}

      {consentAck ? (
        <p className="text-xs text-stone-600" role="status">
          {consentAck}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {leaveWarn ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
          role="alertdialog"
        >
          <p>촬영을 종료하면 임시 사진이 삭제됩니다. 계속할까요?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-800 px-3 py-1.5 text-white"
              onClick={() => resetToChooser(cancelSession(session))}
            >
              종료
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-300 bg-white px-3 py-1.5"
              onClick={() => setLeaveWarn(false)}
            >
              계속 촬영
            </button>
          </div>
        </div>
      ) : null}

      {progress ? (
        <AnalysisProgressOverlay
          progress={progress}
          reducedMotion={reducedMotion}
          onRetry={() => {
            setProgress(null);
            void runAnalyze();
          }}
          onRetakeFailed={() => {
            setProgress(null);
            setSession((s) => retakeAngle(s, s.failedAngle ?? "front"));
            setEntry("camera");
          }}
          onContinueManual={() => {
            setProgress(null);
            onSwitchToManual();
          }}
          onDismiss={() => setProgress(null)}
        />
      ) : null}
    </div>
  );
}
