"use client";

import type { CSSProperties } from "react";
import type {
  CaptureAngleTemplate,
  CaptureGuideVisualState,
  LandmarkSnapshot,
} from "@/lib/analyze/guidedCapture/landmark/types";
import {
  FRONT_GUIDE_OVAL,
  relativeBoxToDisplay,
} from "@/lib/analyze/guidedCapture/landmark/templates";

export type FaceGuideOverlayProps = {
  template: CaptureAngleTemplate;
  visualState: CaptureGuideVisualState;
  countdownDigit: 3 | 2 | 1 | null;
  message: string;
  angleLabel: string;
  stepLabel: string;
  reducedMotion?: boolean;
  liveBounds?: LandmarkSnapshot["faceBounds"];
  /** Manual / fallback: thinner face + eye/nose/mouth only. */
  simplified?: boolean;
  /** Debug dots only — never draw a large diagnostic panel over the face. */
  showLandmarkDots?: boolean;
  debugSnapshot?: LandmarkSnapshot | null;
};

function borderClass(state: CaptureGuideVisualState): string {
  switch (state) {
    case "ready":
      return "border-emerald-300/80";
    case "countdown":
      return "border-emerald-400/90";
    case "captured":
      return "border-emerald-500";
    case "error":
      return "border-amber-300/70";
    case "adjusting":
      return "border-white/70";
    default:
      return "border-white/55";
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
    width: `${Math.max(0, box.xMax - box.xMin) * 100}%`,
    height: `${Math.max(0, box.yMax - box.yMin) * 100}%`,
  };
}

function guideFaceRegion(
  template: CaptureAngleTemplate,
  liveBounds: LandmarkSnapshot["faceBounds"]
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (liveBounds) {
    const w = liveBounds.xMax - liveBounds.xMin;
    const h = liveBounds.yMax - liveBounds.yMin;
    if (
      Number.isFinite(w) &&
      Number.isFinite(h) &&
      w > 0 &&
      w < 1.5 &&
      h > 0 &&
      h < 1.5
    ) {
      return {
        xMin: Math.max(0.05, liveBounds.xMin - w * 0.06),
        xMax: Math.min(0.95, liveBounds.xMax + w * 0.06),
        yMin: Math.max(0.05, liveBounds.yMin - h * 0.04),
        yMax: Math.min(0.95, liveBounds.yMax + h * 0.04),
      };
    }
  }
  if (template.angle === "front") return { ...FRONT_GUIDE_OVAL };
  if (template.angle === "left45") {
    return { xMin: 0.14, xMax: 0.78, yMin: 0.16, yMax: 0.84 };
  }
  return { xMin: 0.22, xMax: 0.86, yMin: 0.16, yMax: 0.84 };
}

export function FaceGuideOverlay({
  template,
  visualState,
  countdownDigit,
  message,
  angleLabel,
  stepLabel,
  reducedMotion,
  liveBounds,
  simplified,
  showLandmarkDots,
  debugSnapshot,
}: FaceGuideOverlayProps) {
  const face = guideFaceRegion(template, liveBounds ?? null);
  const leftEye = relativeBoxToDisplay(template.leftEye, face);
  const rightEye = relativeBoxToDisplay(template.rightEye, face);
  const nose = relativeBoxToDisplay(template.noseTip, face);
  const mouth = relativeBoxToDisplay(template.mouthCenter, face);

  const ovalPadX = (face.xMax - face.xMin) * 0.08;
  const ovalPadY = (face.yMax - face.yMin) * 0.04;
  const oval = {
    xMin: Math.max(0.08, face.xMin - ovalPadX),
    xMax: Math.min(0.92, face.xMax + ovalPadX),
    yMin: Math.max(0.1, face.yMin - ovalPadY),
    yMax: Math.min(0.92, face.yMax + ovalPadY),
  };

  const line = simplified ? "border" : "border-2";
  const opacity = simplified ? "border-white/50" : borderClass(visualState);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden={false}>
      <div
        className={`absolute rounded-[42%] ${line} ${opacity} shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]`}
        style={boxStyle(oval)}
        aria-hidden
      />

      {/* Eye height guides */}
      <div
        className={`absolute rounded-[40%] border border-white/40 ${simplified ? "opacity-70" : ""}`}
        style={boxStyle(leftEye)}
        aria-hidden
      />
      <div
        className={`absolute rounded-[40%] border border-white/40 ${simplified ? "opacity-70" : ""}`}
        style={boxStyle(rightEye)}
        aria-hidden
      />
      {/* Nose center */}
      <div
        className="absolute rounded-full border border-cyan-200/35"
        style={boxStyle({
          xMin: nose.xMin + (nose.xMax - nose.xMin) * 0.3,
          xMax: nose.xMax - (nose.xMax - nose.xMin) * 0.3,
          yMin: nose.yMin + (nose.yMax - nose.yMin) * 0.15,
          yMax: nose.yMax - (nose.yMax - nose.yMin) * 0.15,
        })}
        aria-hidden
      />
      {/* Mouth */}
      <div
        className="absolute rounded-full border border-white/35"
        style={boxStyle(mouth)}
        aria-hidden
      />

      {template.angle !== "front" ? (
        <div
          className="absolute top-[14%] left-1/2 -translate-x-1/2 text-2xl text-white/70"
          aria-hidden
        >
          {template.angle === "left45" ? "↶" : "↷"}
        </div>
      ) : null}

      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
        <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
          {stepLabel}
        </span>
        <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
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
        className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/50 px-3 py-2 text-center text-xs text-white"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>

      {showLandmarkDots && debugSnapshot ? (
        <>
          {debugSnapshot.leftEyeCenter ? (
            <Dot p={debugSnapshot.leftEyeCenter} color="#4ade80" />
          ) : null}
          {debugSnapshot.rightEyeCenter ? (
            <Dot p={debugSnapshot.rightEyeCenter} color="#4ade80" />
          ) : null}
          {debugSnapshot.noseTip ? (
            <Dot p={debugSnapshot.noseTip} color="#67e8f9" />
          ) : null}
          {debugSnapshot.mouthCenter ? (
            <Dot p={debugSnapshot.mouthCenter} color="#fde68a" />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Dot({ p, color }: { p: { x: number; y: number }; color: string }) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 2) {
    return null;
  }
  return (
    <span
      className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${p.x * 100}%`,
        top: `${p.y * 100}%`,
        background: color,
      }}
    />
  );
}
