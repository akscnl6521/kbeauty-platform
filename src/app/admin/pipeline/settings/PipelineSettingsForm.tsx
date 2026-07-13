"use client";

import { useCallback, useEffect, useState } from "react";

type Config = {
  mode: "dry_run" | "gated_commit";
  paused: boolean;
  scheduleHint: string;
  brandsPerRun: number;
  productsPerBrand: number;
  allowCandidateInsert: boolean;
  allowQueueInsert: boolean;
  allowAuditInsert: boolean;
  allowProductInsert: boolean;
  allowOfferInsert: boolean;
  allowPublish: boolean;
  allowDelete: boolean;
};

/**
 * Admin-tunable operation settings (file overrides). Hard locks shown read-only.
 */
export function PipelineSettingsForm() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/pipeline/settings");
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error?.message ?? "설정을 불러오지 못했습니다.");
      return;
    }
    setConfig(json.data.config);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    if (!config) return;
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/pipeline/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: config.mode,
          paused: config.paused,
          brandsPerRun: config.brandsPerRun,
          productsPerBrand: config.productsPerBrand,
          allowCandidateInsert: config.allowCandidateInsert,
          allowQueueInsert: config.allowQueueInsert,
          allowAuditInsert: config.allowAuditInsert,
          scheduleHint: config.scheduleHint,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "저장 실패");
        return;
      }
      setConfig(json.data.config);
      setSaved(true);
    } catch {
      setError("네트워크 오류");
    } finally {
      setPending(false);
    }
  }

  if (!config) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        {error ?? "설정 로딩 중…"}
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-emerald-800">저장됨 · 다음 스케줄 실행부터 적용</p>
      ) : null}

      <p className="text-xs text-gray-500">
        스케줄러 고정 명령:{" "}
        <code className="rounded bg-gray-50 px-1">
          node scripts/run-pipeline-worker.mjs
        </code>
      </p>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.paused}
          onChange={(e) =>
            setConfig({ ...config, paused: e.target.checked })
          }
        />
        일시중지 (paused)
      </label>

      <label className="block">
        모드
        <select
          className="ml-2 rounded border border-[#E8DFD8] px-2 py-1"
          value={config.mode}
          onChange={(e) =>
            setConfig({
              ...config,
              mode: e.target.value === "dry_run" ? "dry_run" : "gated_commit",
            })
          }
        >
          <option value="dry_run">dry_run</option>
          <option value="gated_commit">gated_commit (신규 candidate만)</option>
        </select>
      </label>

      <label className="block">
        브랜드 수 / 실행
        <input
          type="number"
          min={1}
          max={50}
          className="ml-2 w-20 rounded border border-[#E8DFD8] px-2 py-1"
          value={config.brandsPerRun}
          onChange={(e) =>
            setConfig({
              ...config,
              brandsPerRun: Number(e.target.value) || 1,
            })
          }
        />
      </label>

      <label className="block">
        제품 수 / 브랜드
        <input
          type="number"
          min={1}
          max={200}
          className="ml-2 w-20 rounded border border-[#E8DFD8] px-2 py-1"
          value={config.productsPerBrand}
          onChange={(e) =>
            setConfig({
              ...config,
              productsPerBrand: Number(e.target.value) || 1,
            })
          }
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.allowCandidateInsert}
          onChange={(e) =>
            setConfig({ ...config, allowCandidateInsert: e.target.checked })
          }
        />
        신규 candidate 자동 저장
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.allowQueueInsert}
          onChange={(e) =>
            setConfig({ ...config, allowQueueInsert: e.target.checked })
          }
        />
        duplicate queue 자동 생성
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.allowAuditInsert}
          onChange={(e) =>
            setConfig({ ...config, allowAuditInsert: e.target.checked })
          }
        />
        audit 저장
      </label>

      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
        <p className="font-medium">변경 불가 (하드 락)</p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          <li>allowProductInsert = false</li>
          <li>allowOfferInsert = false</li>
          <li>allowPublish = false</li>
          <li>allowDelete = false</li>
        </ul>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-[#8B6914] px-4 py-2 text-white disabled:opacity-60"
      >
        설정 저장
      </button>
    </div>
  );
}
