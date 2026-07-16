"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  ProductBulkCommitItemResult,
  ProductBulkPreviewItem,
  ProductBulkPreviewSummary,
} from "@/lib/admin/product-bulk/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProductBulkImportClient() {
  const submittingRef = useRef(false);
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [items, setItems] = useState<ProductBulkPreviewItem[]>([]);
  const [summary, setSummary] = useState<ProductBulkPreviewSummary | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [results, setResults] = useState<ProductBulkCommitItemResult[] | null>(
    null
  );

  const selectedIndexes = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selected]
  );

  async function analyze() {
    setError(null);
    setResults(null);
    if (!spreadsheet) {
      setError("CSV 또는 Excel 파일을 먼저 선택해 주세요.");
      return;
    }
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.set("spreadsheet", spreadsheet);
      if (zipFile) form.set("imagesZip", zipFile);
      const res = await fetch("/api/admin/products/bulk/preview", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: {
          items: ProductBulkPreviewItem[];
          summary: ProductBulkPreviewSummary;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message || "파일 분석에 실패했습니다.");
        return;
      }
      setItems(json.data.items);
      setSummary(json.data.summary);
      const next: Record<number, boolean> = {};
      for (const item of json.data.items) {
        next[item.rowIndex] = item.selectedByDefault;
      }
      setSelected(next);
    } catch {
      setError("네트워크 오류로 분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function commit() {
    if (submittingRef.current || committing) return;
    setError(null);
    if (!spreadsheet) {
      setError("파일이 없습니다. 다시 선택해 주세요.");
      return;
    }
    if (selectedIndexes.length === 0) {
      setError("등록할 행을 선택해 주세요.");
      return;
    }
    submittingRef.current = true;
    setCommitting(true);
    setProgress({ done: 0, total: selectedIndexes.length });
    setResults(null);
    try {
      const form = new FormData();
      form.set("spreadsheet", spreadsheet);
      if (zipFile) form.set("imagesZip", zipFile);
      form.set("selectedRowIndexes", JSON.stringify(selectedIndexes));
      // Soft progress pulse while waiting for server batch
      const pulse = window.setInterval(() => {
        setProgress((p) =>
          p ? { ...p, done: Math.min(p.total - 1, p.done + 1) } : p
        );
      }, 400);
      const res = await fetch("/api/admin/products/bulk/commit", {
        method: "POST",
        body: form,
      });
      window.clearInterval(pulse);
      const json = (await res.json()) as {
        ok?: boolean;
        data?: {
          results: ProductBulkCommitItemResult[];
          successCount: number;
          failureCount: number;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message || "일괄등록에 실패했습니다.");
        return;
      }
      setResults(json.data.results);
      setProgress({
        done: json.data.results.length,
        total: json.data.results.length,
      });
      // Deselect successes so retry only failures
      setSelected((prev) => {
        const next = { ...prev };
        for (const r of json.data!.results) {
          if (r.ok) next[r.rowIndex] = false;
        }
        return next;
      });
    } catch {
      setError("네트워크 오류로 등록에 실패했습니다. 성공한 행은 다시 실행하지 마세요.");
    } finally {
      submittingRef.current = false;
      setCommitting(false);
    }
  }

  function selectAll(value: boolean) {
    const next: Record<number, boolean> = {};
    for (const item of items) {
      next[item.rowIndex] = value && item.canRegister;
    }
    setSelected(next);
  }

  function downloadFailuresCsv() {
    if (!results) return;
    const failed = results.filter((r) => !r.ok);
    if (!failed.length) return;
    const header = "rowIndex,brand,product_name,slug,message,productId";
    const lines = failed.map((r) =>
      [
        r.rowIndex,
        JSON.stringify(r.brand),
        JSON.stringify(r.productName),
        JSON.stringify(r.slug),
        JSON.stringify(r.message),
        r.productId ?? "",
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kbeauty-bulk-failures.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#E8DFD8] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">1. 준비</h2>
        <p className="mt-1 text-sm text-gray-600">
          먼저 등록 양식을 내려받아 제품 정보를 채운 뒤, 파일을 올려 주세요. 한
          번에 최대 50개까지 가능합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/admin/products/bulk/template"
            className="rounded bg-[#8B6914] px-4 py-2 text-sm font-medium text-white"
          >
            등록 양식 다운로드 (CSV)
          </a>
          <Link
            href="/admin/products/new"
            className="rounded border border-[#E8DFD8] px-4 py-2 text-sm"
          >
            제품 1건 등록으로 이동
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">제품 목록 파일 (필수)</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              CSV 또는 Excel (.xlsx)
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                setSpreadsheet(e.target.files?.[0] ?? null);
                setItems([]);
                setSummary(null);
                setResults(null);
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">이미지 ZIP (선택)</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              image_filename과 같은 이름의 jpeg/png/webp/gif · 파일당 최대 5MB
            </span>
            <input
              type="file"
              accept=".zip,application/zip"
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                setZipFile(e.target.files?.[0] ?? null);
                setResults(null);
              }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={analyze}
          disabled={analyzing || !spreadsheet}
          className="mt-5 rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {analyzing ? "분석 중…" : "파일 내용 분석"}
        </button>
      </section>

      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section className="rounded-xl border border-[#E8DFD8] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">2. 분석 결과</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-gray-500">총 제품 수</dt>
              <dd className="font-semibold tabular-nums">{summary.total}개</dd>
            </div>
            <div>
              <dt className="text-gray-500">기본 선택(등록 가능)</dt>
              <dd className="font-semibold tabular-nums text-emerald-800">
                {summary.ready}개
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">등록 불가</dt>
              <dd className="font-semibold tabular-nums text-red-800">
                {summary.blocked}개
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">예상 이미지 용량</dt>
              <dd className="font-semibold tabular-nums">
                {formatBytes(summary.estimatedImageBytes)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-600">
            중복·필수값 오류 행은 자동으로 선택 해제됩니다. 등록 시작 후에는
            브라우저를 닫아도 이미 성공한 제품은 취소되지 않습니다. 실패 행만
            다시 시도하세요.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-[#E8DFD8] px-3 py-1.5 text-sm"
              onClick={() => selectAll(true)}
            >
              등록 가능 전체 선택
            </button>
            <button
              type="button"
              className="rounded border border-[#E8DFD8] px-3 py-1.5 text-sm"
              onClick={() => selectAll(false)}
            >
              전체 해제
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={committing || selectedIndexes.length === 0}
              className="rounded bg-[#8B6914] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {committing
                ? "등록 중…"
                : `선택한 ${selectedIndexes.length}건 일괄등록`}
            </button>
          </div>

          {progress ? (
            <p className="mt-3 text-sm text-gray-700" aria-live="polite">
              진행: {progress.done} / {progress.total}
              {committing ? " (서버에서 제품을 저장하는 중)" : ""}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-lg border border-[#E8DFD8]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F7F1EC] text-xs text-gray-600">
                <tr>
                  <th className="px-2 py-2">선택</th>
                  <th className="px-2 py-2">행</th>
                  <th className="px-2 py-2">브랜드</th>
                  <th className="px-2 py-2">제품명</th>
                  <th className="px-2 py-2">slug</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">전성분</th>
                  <th className="px-2 py-2">주요 성분</th>
                  <th className="px-2 py-2">이미지</th>
                  <th className="px-2 py-2">안내</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.rowIndex}
                    className="border-t border-[#F0E8E2] align-top"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[item.rowIndex])}
                        disabled={!item.canRegister || committing}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [item.rowIndex]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-2 py-2 tabular-nums">{item.rowIndex}</td>
                    <td className="px-2 py-2">{item.brand}</td>
                    <td className="px-2 py-2">{item.productName}</td>
                    <td className="px-2 py-2 font-mono text-xs">{item.slug}</td>
                    <td className="px-2 py-2">
                      <ul className="space-y-0.5 text-xs">
                        {item.statusLabels.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {item.ingredientCount}개
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {item.keyIngredientPreview.length
                        ? item.keyIngredientPreview.join(", ")
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {item.imageMatched
                        ? `연결됨 (${formatBytes(item.imageBytes)})`
                        : item.imageError || "없음"}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-700">
                      {item.messages[0] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {results ? (
        <section className="rounded-xl border border-[#E8DFD8] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">3. 등록 결과</h2>
          <p className="mt-1 text-sm text-gray-600">
            성공 {results.filter((r) => r.ok).length}건 · 실패{" "}
            {results.filter((r) => !r.ok).length}건 · 실패 행만 다시 선택해
            재시도할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadFailuresCsv}
              className="rounded border border-[#E8DFD8] px-3 py-1.5 text-sm"
              disabled={!results.some((r) => !r.ok)}
            >
              실패 행 다운로드
            </button>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {results.map((r) => (
              <li
                key={`${r.rowIndex}-${r.slug}`}
                className={
                  r.ok
                    ? "rounded bg-emerald-50 px-3 py-2 text-emerald-900"
                    : "rounded bg-red-50 px-3 py-2 text-red-900"
                }
              >
                <span className="font-medium">
                  행 {r.rowIndex}: {r.brand} / {r.productName}
                </span>
                {" — "}
                {r.message}
                {r.ok && r.productId != null ? (
                  <>
                    {" "}
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="underline"
                    >
                      상세 보기
                    </Link>
                  </>
                ) : null}
                {r.ok ? (
                  <span className="mt-1 block text-xs">
                    전성분 {r.fullIngredientCount}개 · 주요{" "}
                    {r.keyIngredients.join(", ") || "없음"}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
