"use client";

import type { CaptureAngle } from "@/lib/analyze/guidedCapture/types";
import { guidanceForAngle } from "@/lib/analyze/guidedCapture/captureSession";

const ANGLES: CaptureAngle[] = ["front", "left45", "right45"];

export function CaptureAngleStepper(props: {
  current: CaptureAngle;
  passed: Partial<Record<CaptureAngle, boolean>>;
}) {
  return (
    <ol
      className="flex items-center justify-between gap-2"
      aria-label="촬영 순서"
    >
      {ANGLES.map((angle) => {
        const g = guidanceForAngle(angle);
        const isCurrent = angle === props.current;
        const done = props.passed[angle] === true;
        return (
          <li
            key={angle}
            className={`flex flex-1 flex-col items-center rounded-2xl px-2 py-2 text-center text-xs ${
              isCurrent
                ? "bg-[#C2185B]/10 text-[#C2185B] ring-1 ring-[#C2185B]/30"
                : done
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-stone-50 text-stone-500"
            }`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="font-semibold">{g.stepLabel}</span>
            <span className="mt-0.5">{g.titleKo}</span>
          </li>
        );
      })}
    </ol>
  );
}
