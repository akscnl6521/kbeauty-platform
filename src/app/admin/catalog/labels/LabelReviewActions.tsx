"use client";

import { useMemo, useState } from "react";

export type LabelRow = {
  externalProductId: string;
  brandCanonical: string;
  productNameEn?: string;
  sourceType: string;
  sourceUrl: string;
  labelCheckedAt: string;
  inciCount: number;
  applyReady: boolean;
  notes?: string;
};

type Props = {
  rows: LabelRow[];
  sprintTag: string;
};

export function LabelReviewActions({ rows, sprintTag }: Props) {
  const [filter, setFilter] = useState<"all" | "needs_review" | "ready">(
    "needs_review"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allowNotReady, setAllowNotReady] = useState(false);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "ready") return r.applyReady && r.inciCount >= 3;
      if (filter === "needs_review") return !r.applyReady && r.inciCount >= 3;
      return true;
    });
  }, [rows, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected(new Set(visible.map((r) => r.externalProductId)));
  }

  async function run(mode: "preview" | "commit") {
    const ids = [...selected];
    if (!ids.length) {
      setMsg("선택된 항목이 없습니다.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/catalog/labels/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          externalProductIds: ids,
          force,
          allowNotReady,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        expectedCount?: number;
        appliedCount?: number;
        items?: Array<{ externalProductId: string; status: string; reason?: string }>;
      };
      if (!json.ok) {
        setMsg(json.message ?? "실패");
        return;
      }
      const skipped = (json.items ?? []).filter((i) => i.status === "skipped");
      const head =
        mode === "preview"
          ? `예상 적용 ${json.expectedCount ?? 0}건`
          : `적용 ${json.appliedCount ?? 0}건`;
      setMsg(
        `${head}${skipped.length ? ` · skip ${skipped.length}` : ""} · sprint ${sprintTag}`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E8DFD8] bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">
          라벨시트 Staging 적용 (검수)
        </p>
        <p className="mt-1 text-xs text-gray-600">
          시트 JSON은 Git SSOT입니다. 여기서는 Staging DB만 갱신합니다. 공개
          verified 승격 없음. applyReady=false는 기본 skip — 체크 시에만 강제
          적용.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["needs_review", "검수 대기"],
              ["ready", "applyReady"],
              ["all", "전체"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded border px-2 py-1 text-xs ${
                filter === k
                  ? "border-[#8B4513] bg-[#8B4513] text-white"
                  : "border-[#E8DFD8] bg-white"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={selectVisible}
            className="rounded border border-[#E8DFD8] px-2 py-1 text-xs"
          >
            보이는 항목 선택
          </button>
          <label className="ml-2 flex items-center gap-1 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={allowNotReady}
              onChange={(e) => setAllowNotReady(e.target.checked)}
            />
            applyReady=false 허용
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            기존 INCI 덮어쓰기
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("preview")}
            className="rounded border border-[#E8DFD8] px-3 py-1.5 text-xs"
          >
            선택 건 예상
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("commit")}
            className="rounded bg-[#8B4513] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Staging 적용
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-[#8B4513]">{msg}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">선택</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Checked</th>
              <th className="px-3 py-2">INCI #</th>
              <th className="px-3 py-2">Ready</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.externalProductId} className="border-b border-[#F0E8E2]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(e.externalProductId)}
                    onChange={() => toggle(e.externalProductId)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{e.externalProductId}</div>
                  <div className="text-xs text-gray-500">
                    {e.productNameEn ?? e.brandCanonical}
                  </div>
                  {e.notes ? (
                    <div className="mt-1 max-w-md text-xs text-amber-800">
                      {e.notes}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div>{e.sourceType}</div>
                  <a
                    href={e.sourceUrl}
                    className="text-xs text-[#8B6914] underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    source
                  </a>
                </td>
                <td className="px-3 py-2">{e.labelCheckedAt}</td>
                <td className="px-3 py-2">{e.inciCount}</td>
                <td className="px-3 py-2">{e.applyReady ? "yes" : "no"}</td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-sm text-gray-500">
                  해당 필터에 항목이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
