"use client";

import { useCallback, useEffect, useState } from "react";
import { retentionNoticeKo } from "@/lib/care/photoComparisonPolicy";

type AssetSummary = {
  id: string;
  storageStatus: string;
  retentionDays: number;
  expiresAt: string | null;
  learningOptIn: boolean;
  contentType: string;
  byteSize: number;
  createdAt: string;
  deletedAt: string | null;
};

export function PhotoAssetsSettingsPanel() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/care/photo-assets", { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { assets?: AssetSummary[]; migrationPending?: boolean };
        error?: { message?: string };
      };
      if (!json.ok) {
        setMessage(json.error?.message ?? "사진 목록을 불러오지 못했습니다.");
        setAssets([]);
        return;
      }
      setAssets(json.data?.assets ?? []);
      setMigrationPending(Boolean(json.data?.migrationPending));
    } catch {
      setMessage("사진 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(assetId: string) {
    if (!window.confirm("이 사진 기록을 삭제할까요?")) return;
    setBusyId(assetId);
    setMessage(null);
    try {
      const res = await fetch(`/api/care/photo-assets/${assetId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-synthetic-fixture": "1" },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!json.ok) {
        setMessage(json.error?.message ?? "삭제 요청에 실패했습니다.");
        return;
      }
      setMessage("삭제 요청을 처리했습니다.");
      await load();
    } catch {
      setMessage("삭제 요청에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm("저장된 모든 사진 기록을 삭제할까요?")) return;
    setBusyId("all");
    setMessage(null);
    try {
      const res = await fetch("/api/care/photo-assets/delete-all", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { deletedCount?: number };
        error?: { message?: string };
      };
      if (!json.ok) {
        setMessage(json.error?.message ?? "전체 삭제에 실패했습니다.");
        return;
      }
      setMessage(`삭제 요청 ${json.data?.deletedCount ?? 0}건을 접수했습니다.`);
      await load();
    } catch {
      setMessage("전체 삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString("ko-KR");
    } catch {
      return value;
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
      <h2 className="font-semibold">사진 비교 · 저장 기록</h2>
      <p className="mt-2 text-xs leading-5 text-gray-600">{retentionNoticeKo}</p>
      <p className="mt-2 text-xs text-gray-500">
        동의를 철회하려면 아래 기록을 삭제하거나, 분석 화면에서 분석만 모드로 변경하세요.
      </p>

      {migrationPending ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          사진 비교 DB migration이 아직 적용되지 않았습니다. 기능 코드는 준비되었으며 Staging 승인 후
          연결됩니다.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-3 text-xs text-gray-500">불러오는 중…</p>
      ) : assets.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">저장된 사진 기록이 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E8DFD8] px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-gray-800">
                  저장일 {formatDate(asset.createdAt)}
                </p>
                <p className="text-gray-500">
                  만료 {formatDate(asset.expiresAt)} · 상태 {asset.storageStatus}
                  {asset.learningOptIn ? " · 학습 opt-in" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === asset.id}
                onClick={() => void handleDelete(asset.id)}
                className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 font-semibold text-rose-800 disabled:opacity-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {assets.length > 0 ? (
        <button
          type="button"
          disabled={busyId === "all"}
          onClick={() => void handleDeleteAll()}
          className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50"
        >
          저장된 사진 전체 삭제
        </button>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-lg border border-[#E8DFD8] bg-[#FAF7F5] px-3 py-2 text-xs text-gray-700" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
