"use client";

import { useEffect, useRef, useState } from "react";
import {
  classifyGetUserMediaError,
  detectCameraSupport,
} from "@/lib/analyze/guidedCapture/cameraSupport";
import { guidanceForAngle } from "@/lib/analyze/guidedCapture/captureSession";
import { captureVideoFrameToShot } from "@/lib/analyze/guidedCapture/processImageClient";
import type { CaptureAngle, CapturedShot } from "@/lib/analyze/guidedCapture/types";

export type CameraCapturePanelProps = {
  angle: CaptureAngle;
  facingMode: "user" | "environment";
  onFacingModeChange: (mode: "user" | "environment") => void;
  onCaptured: (shot: CapturedShot) => void;
  onPermissionDenied: () => void;
  onUnavailable: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function CameraCapturePanel({
  angle,
  facingMode,
  onFacingModeChange,
  onCaptured,
  onPermissionDenied,
  onUnavailable,
  onCancel,
  disabled,
}: CameraCapturePanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "error">("starting");
  const [hint, setHint] = useState("얼굴을 가이드 안에 맞춰 주세요.");
  const [busy, setBusy] = useState(false);
  const guidance = guidanceForAngle(angle);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStatus("starting");
      const support = detectCameraSupport(
        typeof window !== "undefined" ? window : null
      );
      if (!support.supported) {
        onUnavailable();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatus("live");
        setHint(guidance.bodyKo);
      } catch (err) {
        const outcome = classifyGetUserMediaError(err);
        if (outcome === "denied") onPermissionDenied();
        else onUnavailable();
        setStatus("error");
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, angle, guidance.bodyKo, onPermissionDenied, onUnavailable]);

  async function handleShutter() {
    if (busy || disabled || !videoRef.current) return;
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
          {status === "starting" ? "카메라를 준비하는 중…" : hint}
        </p>
      </div>

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
