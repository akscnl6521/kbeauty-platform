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
import type { VideoDisplayMetrics } from "@/lib/analyze/guidedCapture/landmark/displaySpace";

export type FaceGuideOverlayProps = {
  template: CaptureAngleTemplate;
  visualState: CaptureGuideVisualState;
  countdownDigit: 3 | 2 | 1 | null;
  message: string;
  angleLabel: string;
  stepLabel: string;
  reducedMotion?: boolean;
  /** Live face bounds in display-space — guide follows real face scale when available. */
  liveBounds?: LandmarkSnapshot["faceBounds"];
  /** Preview/dev debug only — never log to server. */
  debug?: boolean;
  debugSnapshot?: LandmarkSnapshot | null;
  debugSoftWarnings?: string[];
  debugFailReason?: string | null;
  debugMetrics?: VideoDisplayMetrics | null;
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
    width: `${Math.max(0, box.xMax - box.xMin) * 100}%`,
    height: `${Math.max(0, box.yMax - box.yMin) * 100}%`,
  };
}

function guideFaceRegion(
  template: CaptureAngleTemplate,
  liveBounds: LandmarkSnapshot["faceBounds"]
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (liveBounds) {
    // Expand slightly so guides feel like allowances, not a tight mask.
    const w = liveBounds.xMax - liveBounds.xMin;
    const h = liveBounds.yMax - liveBounds.yMin;
    return {
      xMin: Math.max(0.05, liveBounds.xMin - w * 0.06),
      xMax: Math.min(0.95, liveBounds.xMax + w * 0.06),
      yMin: Math.max(0.05, liveBounds.yMin - h * 0.04),
      yMax: Math.min(0.95, liveBounds.yMax + h * 0.04),
    };
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
  debug,
  debugSnapshot,
  debugSoftWarnings,
  debugFailReason,
  debugMetrics,
}: FaceGuideOverlayProps) {
  const face = guideFaceRegion(template, liveBounds ?? null);
  const leftEye = relativeBoxToDisplay(template.leftEye, face);
  const rightEye = relativeBoxToDisplay(template.rightEye, face);
  const nose = relativeBoxToDisplay(template.noseTip, face);
  const mouth = relativeBoxToDisplay(template.mouthCenter, face);
  const chin = relativeBoxToDisplay(template.chinTip, face);

  // Softer oval — not a long/narrow decorative face silhouette.
  const ovalPadX = (face.xMax - face.xMin) * 0.08;
  const ovalPadY = (face.yMax - face.yMin) * 0.04;
  const oval = {
    xMin: Math.max(0.08, face.xMin - ovalPadX),
    xMax: Math.min(0.92, face.xMax + ovalPadX),
    yMin: Math.max(0.1, face.yMin - ovalPadY),
    yMax: Math.min(0.92, face.yMax + ovalPadY),
  };

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden={false}>
      <div
        className={`absolute rounded-[42%] border-2 ${borderClass(visualState)} shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]`}
        style={boxStyle(oval)}
        aria-hidden
      />

      {/* Soft feature guides — large allowance regions */}
      <div
        className="absolute rounded-[40%] border border-white/45"
        style={boxStyle(leftEye)}
        aria-hidden
      />
      <div
        className="absolute rounded-[40%] border border-white/45"
        style={boxStyle(rightEye)}
        aria-hidden
      />
      {/* Nose: vertical band */}
      <div
        className="absolute rounded-full border border-cyan-200/50"
        style={boxStyle({
          xMin: nose.xMin + (nose.xMax - nose.xMin) * 0.25,
          xMax: nose.xMax - (nose.xMax - nose.xMin) * 0.25,
          yMin: nose.yMin,
          yMax: nose.yMax,
        })}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-white/40"
        style={boxStyle(mouth)}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-white/35"
        style={boxStyle(chin)}
        aria-hidden
      />

      {template.angle !== "front" ? (
        <div
          className="absolute top-[14%] left-1/2 -translate-x-1/2 text-2xl text-white/80"
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

      {debug ? (
        <>
          {debugSnapshot?.faceBounds ? (
            <div
              className="absolute border border-lime-400/80"
              style={boxStyle(debugSnapshot.faceBounds)}
              aria-hidden
            />
          ) : null}
          {debugSnapshot?.leftEyeCenter ? (
            <Dot p={debugSnapshot.leftEyeCenter} color="#4ade80" />
          ) : null}
          {debugSnapshot?.rightEyeCenter ? (
            <Dot p={debugSnapshot.rightEyeCenter} color="#4ade80" />
          ) : null}
          {debugSnapshot?.noseTip ? (
            <Dot p={debugSnapshot.noseTip} color="#67e8f9" />
          ) : null}
          {debugSnapshot?.mouthCenter ? (
            <Dot p={debugSnapshot.mouthCenter} color="#fde68a" />
          ) : null}
          {debugSnapshot?.chinTip ? (
            <Dot p={debugSnapshot.chinTip} color="#fda4af" />
          ) : null}
          <div
            className="absolute left-2 top-12 max-w-[92%] rounded-lg bg-black/70 px-2 py-1 font-mono text-[10px] leading-snug text-lime-200"
            aria-hidden
          >
            <p>
              fail={debugFailReason ?? "-"} soft=
              {(debugSoftWarnings ?? []).join(",") || "-"}
            </p>
            <p>
              yaw={fmt(debugSnapshot?.yaw)} pitch={fmt(debugSnapshot?.pitch)}{" "}
              roll={fmt(debugSnapshot?.roll)}
            </p>
            <p>
              bounds=
              {debugSnapshot?.faceBounds
                ? `${pct(debugSnapshot.faceBounds.xMin)}-${pct(debugSnapshot.faceBounds.xMax)},${pct(debugSnapshot.faceBounds.yMin)}-${pct(debugSnapshot.faceBounds.yMax)}`
                : "-"}
            </p>
            <p>
              vw={debugMetrics?.videoWidth ?? "-"}×
              {debugMetrics?.videoHeight ?? "-"} cw=
              {debugMetrics?.clientWidth ?? "-"}×
              {debugMetrics?.clientHeight ?? "-"} mir=
              {debugMetrics?.mirrorX ? "1" : "0"}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Dot({ p, color }: { p: { x: number; y: number }; color: string }) {
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

function fmt(n: number | null | undefined): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toFixed(1);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}`;
}
