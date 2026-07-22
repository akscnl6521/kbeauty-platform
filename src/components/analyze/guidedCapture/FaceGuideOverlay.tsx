"use client";

import type { CSSProperties } from "react";
import type {
  CaptureAngleTemplate,
  CaptureGuideVisualState,
} from "@/lib/analyze/guidedCapture/landmark/types";

export type FaceGuideOverlayProps = {
  template: CaptureAngleTemplate;
  visualState: CaptureGuideVisualState;
  countdownDigit: 3 | 2 | 1 | null;
  message: string;
  angleLabel: string;
  stepLabel: string;
  reducedMotion?: boolean;
};

function borderClass(state: CaptureGuideVisualState): string {
  switch (state) {
    case "ready":
      return "border-emerald-300";
    case "countdown":
      return "border-emerald-400";
    case "captured":
      return "border-emerald-500";
    case "error":
      return "border-amber-300";
    case "adjusting":
      return "border-white/90";
    default:
      return "border-white/70";
  }
}

function boxStyle(box: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}): CSSProperties {
  return {
    left: `${box.xMin * 100}%`,
    top: `${box.yMin * 100}%`,
    width: `${(box.xMax - box.xMin) * 100}%`,
    height: `${(box.yMax - box.yMin) * 100}%`,
  };
}

export function FaceGuideOverlay({
  template,
  visualState,
  countdownDigit,
  message,
  angleLabel,
  stepLabel,
  reducedMotion,
}: FaceGuideOverlayProps) {
  const faceOval = {
    xMin: template.faceCenter.xMin - 0.12,
    xMax: template.faceCenter.xMax + 0.12,
    yMin: template.eyeLineY.min - 0.08,
    yMax: template.chinTip.yMax + 0.02,
  };

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden={false}>
      <div
        className={`absolute rounded-[48%] border-2 ${borderClass(visualState)} shadow-[0_0_0_9999px_rgba(0,0,0,0.32)]`}
        style={boxStyle({
          xMin: Math.max(0.08, faceOval.xMin),
          xMax: Math.min(0.92, faceOval.xMax),
          yMin: Math.max(0.08, faceOval.yMin),
          yMax: Math.min(0.95, faceOval.yMax),
        })}
        aria-hidden
      />

      {/* Eye / nose / mouth / chin target guides */}
      <div
        className="absolute rounded-full border border-white/50"
        style={boxStyle(template.leftEye)}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-white/50"
        style={boxStyle(template.rightEye)}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-cyan-200/60"
        style={boxStyle(template.noseTip)}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-white/40"
        style={boxStyle(template.mouthCenter)}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-white/35"
        style={boxStyle(template.chinTip)}
        aria-hidden
      />

      {/* Rotation arrow hint for 45° */}
      {template.angle !== "front" ? (
        <div
          className="absolute top-[18%] left-1/2 -translate-x-1/2 text-2xl text-white/80"
          aria-hidden
        >
          {template.angle === "left45" ? "↶" : "↷"}
        </div>
      ) : null}

      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
        <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
          {stepLabel}
        </span>
        <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
          {angleLabel}
        </span>
      </div>

      {countdownDigit !== null ? (
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            reducedMotion ? "" : "transition-opacity duration-200"
          }`}
          aria-hidden
        >
          <span className="text-7xl font-bold text-white drop-shadow-lg">
            {countdownDigit}
          </span>
        </div>
      ) : null}

      <p
        className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/55 px-3 py-2 text-center text-xs text-white"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
