"use client";

import { useState } from "react";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";

type UsageVideoModalProps = {
  productName: string;
  amount?: string;
  order?: string;
  area?: string;
};

/**
 * Scaffold-mode placeholder for the product usage video feature. No real
 * video file/storage — shows a thumbnail + play-icon placeholder and dummy
 * amount/order/area text. Wire real media (src/lib/media, ProductUsageGuide)
 * in before this leaves scaffold mode.
 */
export function UsageVideoModal({
  productName,
  amount = "손끝 한 마디 분량 (샘플)",
  order = "클렌징 후 → 이 제품 → 보습 마무리 (샘플 순서)",
  area = "얼굴 전체 (샘플)",
}: UsageVideoModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-xs font-semibold text-gray-800"
      >
        사용법 보기
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} 사용법`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{productName} 사용법</h3>
              <SampleDataBadge label="샘플 영상" />
            </div>

            <div className="mt-3 flex aspect-video items-center justify-center rounded-xl bg-gray-200">
              <span aria-hidden className="text-4xl text-gray-500">
                ▶
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              실제 영상 파일 없음 — 자리만(placeholder)
            </p>

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">도포량</dt>
                <dd>{amount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">사용 순서</dt>
                <dd>{order}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">부위</dt>
                <dd>{area}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
