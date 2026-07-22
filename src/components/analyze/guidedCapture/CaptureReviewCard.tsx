"use client";

import {
  qualityReasonMessageKo,
} from "@/lib/analyze/guidedCapture/qualityCheck";
import type { CapturedShot } from "@/lib/analyze/guidedCapture/types";

export function CaptureReviewCard(props: {
  shot: CapturedShot;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const { shot } = props;
  const failed = shot.qualityStatus === "fail";
  const infoReasons = shot.qualityReasons.filter(
    (r) => r === "pose_check_unavailable" || r === "manual_guidance"
  );
  const failReasons = shot.qualityReasons.filter(
    (r) => r !== "pose_check_unavailable" && r !== "manual_guidance"
  );

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.previewUrl}
          alt={`${shot.angle} 미리보기`}
          className="mx-auto max-h-72 w-auto object-contain"
        />
      </div>
      <p className="text-xs text-stone-600">
        {shot.width}×{shot.height}
        {typeof shot.brightnessScore === "number"
          ? ` · 밝기 ${Math.round(shot.brightnessScore)}`
          : ""}
        {shot.inputSource === "camera" ? " · 카메라" : " · 갤러리"}
      </p>
      {infoReasons.length > 0 ? (
        <p className="text-xs text-amber-800" role="status">
          {qualityReasonMessageKo(infoReasons[0]!)}
        </p>
      ) : null}
      {failed ? (
        <ul className="space-y-1 text-xs text-rose-700" role="alert">
          {failReasons.map((r) => (
            <li key={r}>{qualityReasonMessageKo(r)}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-emerald-800" role="status">
          기본 품질 검사를 통과했습니다. 안내에 맞는 각도인지 확인한 뒤 다음으로
          진행해 주세요.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onRetake}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700"
        >
          다시 촬영
        </button>
        {!failed ? (
          <button
            type="button"
            onClick={props.onConfirm}
            className="rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white"
          >
            다음 단계
          </button>
        ) : null}
      </div>
    </div>
  );
}
