"use client";

import type { AlignmentDiagnostics } from "@/lib/analyze/guidedCapture/landmark/types";
import type {
  CoverTransform,
  VideoDisplayMetrics,
} from "@/lib/analyze/guidedCapture/landmark/displaySpace";
import { formatDiagNum } from "@/lib/analyze/guidedCapture/landmark/landmarkSanity";

/** Collapsible developer panel BELOW the camera — never covers the face. */
export function LandmarkDebugPanel(props: {
  open: boolean;
  onToggle: () => void;
  diagnostics?: AlignmentDiagnostics | null;
  cover?: CoverTransform | null;
  metrics?: VideoDisplayMetrics | null;
  softWarnings?: string[];
  primaryFailReason?: string | null;
}) {
  const d = props.diagnostics;
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50">
      <button
        type="button"
        onClick={props.onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-stone-700"
        aria-expanded={props.open}
      >
        <span>정렬 디버그 {props.open ? "숨기기" : "보기"}</span>
        <span className="font-mono text-[10px] text-stone-500">
          {props.primaryFailReason ?? "-"}
        </span>
      </button>
      {props.open ? (
        <div className="max-h-40 overflow-auto border-t border-stone-200 px-3 py-2 font-mono text-[10px] leading-snug text-stone-700">
          <p>
            fail={props.primaryFailReason ?? "-"} soft=
            {(props.softWarnings ?? []).join(",") || "-"}
          </p>
          <p>
            faces={d?.faceLandmarksPresent ? "1" : "0"} len=
            {d?.landmarkArrayLength ?? 0} keys={d?.firstPointKeys ?? "-"}
          </p>
          <p>
            valid={d?.validPointCount ?? 0} invalid={d?.invalidPointCount ?? 0}{" "}
            sample0={d?.sample0 ?? "-"} note={d?.parseNote ?? "-"}
          </p>
          <p>
            rawC={d?.rawC ?? "-"} rawBounds={d?.rawBounds ?? "-"}
          </p>
          <p>
            preMirrorC={d?.preMirrorC ?? "-"} dispC={d?.displayC ?? "-"}
          </p>
          <p>
            w={formatDiagNum(d?.faceWidthRatio)} h=
            {formatDiagNum(d?.faceHeightRatio)} yaw=
            {formatDiagNum(d?.yaw, 1)} pitch={formatDiagNum(d?.pitch, 1)} roll=
            {formatDiagNum(d?.roll, 1)}
          </p>
          <p>
            age={formatDiagNum(d?.landmarkAgeMs, 0)}ms invalid=
            {d?.invalidStage ?? "-"} loop={d?.loopRunning ? "1" : "0"} lock=
            {d?.lockState ? "1" : "0"} restart={d?.detectorRestartCount ?? 0}{" "}
            infer={d?.inferenceCount ?? 0}
          </p>
          <p>
            scale={formatDiagNum(props.cover?.scale, 3)} crop=
            {formatDiagNum(props.cover?.cropX, 1)},
            {formatDiagNum(props.cover?.cropY, 1)} vw=
            {props.metrics?.videoWidth ?? "-"}×{props.metrics?.videoHeight ?? "-"}{" "}
            cw={props.metrics?.clientWidth ?? "-"}×
            {props.metrics?.clientHeight ?? "-"}
          </p>
          <p>err={d?.inferenceError ?? "-"}</p>
        </div>
      ) : null}
    </div>
  );
}
