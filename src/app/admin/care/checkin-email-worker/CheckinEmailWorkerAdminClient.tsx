"use client";

import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  tablesReady: boolean;
  readinessStatus: string;
  note: string;
  counts: Record<string, number>;
  total: number;
  failureReasonSummary: Array<{ reason: string; count: number }>;
  staleProcessingCount: number;
  staleSeconds: number;
  recentJobs: Array<{
    id: string;
    status: string;
    kind: string;
    milestone: string;
    retry_count: number;
    last_error: string | null;
    updated_at: string;
  }>;
  recentAudit: Array<{
    id: string;
    event_type: string;
    created_at: string;
    meta_summary: { keys: string[]; jobId?: string };
  }>;
};

type ActionResult = {
  ok: boolean;
  message: string;
};

export function CheckinEmailWorkerAdminClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/care/checkin-email-worker", {
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: Snapshot;
        error?: { code: string; message: string };
      };
      if (json.ok && json.data) {
        setSnapshot(json.data);
        setResult(null);
      } else {
        setResult({
          ok: false,
          message: json.error?.code ?? "load_failed",
        });
      }
    } catch {
      setResult({ ok: false, message: "network_error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: "dry_run_tick" | "manual_retry" | "manual_cancel") => {
      if (confirm !== "CONFIRM") {
        setResult({ ok: false, message: "confirmation_required (CONFIRM)" });
        return;
      }
      if (
        (action === "manual_retry" || action === "manual_cancel") &&
        !jobId.trim()
      ) {
        setResult({ ok: false, message: "job_id_required" });
        return;
      }
      setBusy(true);
      setResult(null);
      try {
        const body: Record<string, unknown> = {
          action,
          confirm: "CONFIRM",
        };
        if (action === "dry_run_tick") body.limit = 5;
        if (action === "manual_retry" || action === "manual_cancel") {
          body.jobId = jobId.trim();
        }
        const res = await fetch("/api/admin/care/checkin-email-worker", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          data?: unknown;
          error?: { code: string; message: string };
        };
        if (json.ok) {
          setResult({ ok: true, message: action + " ok" });
          await load();
        } else {
          setResult({
            ok: false,
            message: json.error?.code ?? "action_failed",
          });
        }
      } catch {
        setResult({ ok: false, message: "network_error" });
      } finally {
        setBusy(false);
      }
    },
    [confirm, jobId, load]
  );

  if (loading && !snapshot) {
    return <p className="text-gray-600">불러오는 중…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="font-semibold">큐 상태</h2>
        <p className="mt-1 text-xs text-gray-500">{snapshot?.note}</p>
        <p className="mt-2 text-xs">
          readiness: {snapshot?.readinessStatus ?? "—"} · total:{" "}
          {snapshot?.total ?? 0} · stale processing:{" "}
          {snapshot?.staleProcessingCount ?? 0} ({'>'}{snapshot?.staleSeconds ?? 900}s)
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(snapshot?.counts ?? {}).map(([k, v]) => (
            <div key={k} className="rounded border border-[#E8DFD8] px-2 py-2">
              <p className="text-[11px] text-gray-500">{k}</p>
              <p className="font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="font-semibold">실패 사유 요약 (top 10)</h2>
        {(snapshot?.failureReasonSummary?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-gray-500">없음</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {snapshot!.failureReasonSummary.map((f) => (
              <li key={f.reason}>
                {f.reason}: {f.count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="font-semibold">최근 잡 (PII 없음)</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DFD8] text-gray-500">
                <th className="py-1 pr-2">id</th>
                <th className="py-1 pr-2">status</th>
                <th className="py-1 pr-2">kind</th>
                <th className="py-1 pr-2">milestone</th>
                <th className="py-1 pr-2">retry</th>
                <th className="py-1 pr-2">last_error</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.recentJobs ?? []).map((j) => (
                <tr
                  key={j.id}
                  className="border-b border-[#F3EEE9] cursor-pointer hover:bg-[#FBF8F5]"
                  onClick={() => setJobId(j.id)}
                >
                  <td className="py-1 pr-2 font-mono text-[10px]">{j.id}</td>
                  <td className="py-1 pr-2">{j.status}</td>
                  <td className="py-1 pr-2">{j.kind}</td>
                  <td className="py-1 pr-2">{j.milestone}</td>
                  <td className="py-1 pr-2">{j.retry_count}</td>
                  <td className="py-1 pr-2">{j.last_error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="font-semibold">최근 audit (checkin_email_*)</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {(snapshot?.recentAudit ?? []).map((a) => (
            <li key={a.id}>
              {a.created_at} · {a.event_type}
              {a.meta_summary.jobId ? ` · job=${a.meta_summary.jobId}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 space-y-3">
        <h2 className="font-semibold">액션 (CONFIRM 필수)</h2>
        <p className="text-xs text-amber-900">
          실제 이메일 발송 없음 · dry-run tick만 실행 · Resend 미호출
        </p>
        <label className="block text-xs">
          confirm 토큰
          <input
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="CONFIRM"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs">
          job id (retry / cancel)
          <input
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1 font-mono"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="클릭으로 선택 또는 직접 입력"
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded bg-[#8B6914] px-3 py-1.5 text-white disabled:opacity-50"
            onClick={() => void runAction("dry_run_tick")}
          >
            Run dry-run tick
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-[#8B6914] px-3 py-1.5 text-[#8B6914] disabled:opacity-50"
            onClick={() => void runAction("manual_retry")}
          >
            Retry selected
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-red-700 px-3 py-1.5 text-red-800 disabled:opacity-50"
            onClick={() => void runAction("manual_cancel")}
          >
            Cancel selected
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {result ? (
          <p
            className={
              result.ok ? "text-xs text-green-800" : "text-xs text-red-800"
            }
          >
            {result.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
