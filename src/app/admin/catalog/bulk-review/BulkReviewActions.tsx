"use client";

import { useState } from "react";

type Props = {
  brand: string;
  domain: string;
  status: string;
  missing: string;
};

export function BulkReviewActions({ brand, domain, status, missing }: Props) {
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const filter = {
    brand: brand || undefined,
    domain: domain || undefined,
    productStatus: status || undefined,
    missing: (missing || undefined) as
      | "inci"
      | "image"
      | "pdp"
      | "source_conflict"
      | undefined,
  };

  async function run(action: string, dryRun: boolean) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/catalog/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: dryRun ? "preview" : "commit",
          action,
          filter,
          dryRun,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        expectedCount?: number;
        appliedCount?: number;
        message?: string;
      };
      if (!json.ok) {
        setMsg(json.message ?? "실패");
        return;
      }
      if (dryRun) {
        setMsg(`예상 변경 수: ${json.expectedCount ?? 0}건 (아직 적용 안 함)`);
      } else {
        setMsg(
          `적용 ${json.appliedCount ?? 0} / 예상 ${json.expectedCount ?? 0}`
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#E8DFD8] bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">대량 작업 (Staging only)</p>
      <p className="mt-1 text-xs text-gray-600">
        공개 verified 승격은 하지 않습니다. 먼저 예상을 확인하세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["approve", "대량 승인"],
          ["hold", "대량 보류"],
          ["reject", "대량 제외"],
          ["merge_duplicates", "중복 병합 표시"],
        ].map(([action, label]) => (
          <div key={action} className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(action, true)}
              className="rounded border border-[#E8DFD8] px-2 py-1.5 text-xs"
            >
              {label} 예상
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(action, false)}
              className="rounded bg-[#8B4513] px-2 py-1.5 text-xs font-semibold text-white"
            >
              적용
            </button>
          </div>
        ))}
      </div>
      {msg ? <p className="mt-3 text-sm text-[#8B4513]">{msg}</p> : null}
    </div>
  );
}
