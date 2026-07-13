"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Batch = {
  batchId: string;
  mode: string;
  status: string;
  progress: {
    totalItems: number;
    processedItems: number;
    successItems: number;
    reviewItems: number;
    failedItems: number;
  };
  createdAt: string;
  updatedAt: string;
  notes?: string[];
};

type Ops = {
  dryRunBatches: number;
  commitBatches: number;
  reviewItemsRecent: number;
  failedItemsRecent: number;
  brandSites: number;
  verifiedOfficialBrands: number;
  needsReviewBrands: number;
  blockedBrands: number;
  autonomousCandidates: number;
  pendingDuplicateQueues: number;
  latestBatchId: string | null;
  latestStatus: string | null;
  latestHeartbeat: string | null;
  schedulerHint: string;
};

/**
 * Pipeline operations console (client).
 */
export function PipelineConsole({ canRun }: { canRun: boolean }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"dry_run" | "commit">("dry_run");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/pipeline");
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error?.message ?? "목록을 불러오지 못했습니다.");
      return;
    }
    setBatches(json.data.batches ?? []);
    setOps(json.data.ops ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function post(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pipeline/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "요청 실패");
        return;
      }
      await refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <p className="font-medium text-gray-900">자동화 원칙</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
          <li>정상 데이터는 자동 처리 · 낮은 신뢰도만 needs_review</li>
          <li>브랜드/제품마다 승인 요청하지 않음</li>
          <li>자동 published 금지 · offer 0이면 publish 불가</li>
          <li>스케줄러: autonomous (dry_run → 게이트 → candidate commit)</li>
        </ul>
      </section>

      {ops ? (
        <section className="grid gap-3 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">스케줄러</p>
            <p className="font-medium">{ops.schedulerHint}</p>
            <p className="text-xs text-gray-600">
              latest {ops.latestStatus ?? "—"} · heartbeat{" "}
              {ops.latestHeartbeat ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">배치</p>
            <p>
              dry_run {ops.dryRunBatches} · commit {ops.commitBatches}
            </p>
            <p className="text-xs text-gray-600">
              review {ops.reviewItemsRecent} · fail {ops.failedItemsRecent}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">브랜드 사이트</p>
            <p>
              total {ops.brandSites} · verified {ops.verifiedOfficialBrands}
            </p>
            <p className="text-xs text-gray-600">
              needs_review {ops.needsReviewBrands} · blocked {ops.blockedBrands}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">자동 후보</p>
            <p className="font-medium tabular-nums">{ops.autonomousCandidates}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">duplicate 큐 pending</p>
            <p className="font-medium tabular-nums">{ops.pendingDuplicateQueues}</p>
          </div>
        </section>
      ) : null}

      {canRun ? (
        <section className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            모드
            <select
              value={mode}
              onChange={(e) =>
                setMode(e.target.value === "commit" ? "commit" : "dry_run")
              }
              className="ml-2 rounded border border-[#E8DFD8] bg-white px-2 py-1"
            >
              <option value="dry_run">dry_run (권장)</option>
              <option value="commit">commit (candidate만)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              post({
                action: "start",
                mode,
                brandLimit: 5,
                productLimitPerBrand: 10,
                tickLimit: 3,
              })
            }
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            파이프라인 시작
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void refresh()}
            className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm"
          >
            새로고침
          </button>
        </section>
      ) : (
        <p className="text-sm text-amber-800">실행 권한이 없습니다. 읽기만 가능합니다.</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">batch</th>
              <th className="px-3 py-2">mode</th>
              <th className="px-3 py-2">status</th>
              <th className="px-3 py-2">progress</th>
              <th className="px-3 py-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={5}>
                  아직 배치가 없습니다.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.batchId} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/pipeline/batches/${b.batchId}`}
                      className="font-medium text-[#8B6914] underline"
                    >
                      {b.batchId.slice(0, 8)}…
                    </Link>
                    <div className="text-xs text-gray-500">{b.createdAt}</div>
                  </td>
                  <td className="px-3 py-2">{b.mode}</td>
                  <td className="px-3 py-2">{b.status}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.progress.processedItems}/{b.progress.totalItems}
                    <div className="text-xs text-gray-500">
                      ok {b.progress.successItems} · review {b.progress.reviewItems} ·
                      fail {b.progress.failedItems}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {canRun ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-[#E8DFD8] px-2 py-1 text-xs"
                          onClick={() =>
                            post({
                              action: "tick",
                              batchId: b.batchId,
                              tickLimit: 5,
                            })
                          }
                        >
                          tick
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-[#E8DFD8] px-2 py-1 text-xs"
                          onClick={() =>
                            post({ action: "pause", batchId: b.batchId })
                          }
                        >
                          pause
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-[#E8DFD8] px-2 py-1 text-xs"
                          onClick={() =>
                            post({ action: "resume", batchId: b.batchId })
                          }
                        >
                          resume
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-[#E8DFD8] px-2 py-1 text-xs"
                          onClick={() =>
                            post({ action: "retry", batchId: b.batchId })
                          }
                        >
                          retry
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
