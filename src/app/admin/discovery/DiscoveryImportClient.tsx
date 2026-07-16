"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import type { ImportPreviewItem, ImportPreviewSummary } from "@/lib/admin/import/types";

type PreviewRow = ImportPreviewItem & {
  selected: boolean;
  notes: string;
};

type CommitResult = {
  created: Array<{ id: string; productName: string; queueId: string | null }>;
  duplicates: unknown[];
  failed: unknown[];
  summary: {
    requested: number;
    created: number;
    duplicates: number;
    failed: number;
  };
};

const SOURCE_TYPES = [
  "official_brand_page",
  "official_label",
  "official_retailer",
  "medical_paper",
  "clinical_guideline",
  "admin_entry",
  "search_result",
  "affiliate_feed",
  "brand_csv",
  "other",
] as const;

const CSV_TEMPLATE = `url,product_name,brand,country,source_type,notes
https://example.com/products/sample-placeholder,SAMPLE PRODUCT NAME,SAMPLE BRAND,KR,search_result,placeholder only — replace with real URLs
`;

type CsvHint = {
  url: string;
  productName?: string;
  brandName?: string;
  detectedCountry?: string;
  sourceType?: string;
  notes?: string;
};

function parseCsv(text: string): CsvHint[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  if (lines.length > 101) {
    throw new Error("CSV는 헤더 포함 최대 100행까지 지원합니다.");
  }

  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const urlIdx = headers.indexOf("url");
  if (urlIdx < 0) throw new Error("CSV에 url 컬럼이 필요합니다.");

  const idx = (name: string) => headers.indexOf(name);
  const rows: CsvHint[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const url = (cols[urlIdx] ?? "").trim();
    if (!url) continue;
    rows.push({
      url,
      productName: cols[idx("product_name")]?.trim() || undefined,
      brandName: cols[idx("brand")]?.trim() || undefined,
      detectedCountry: cols[idx("country")]?.trim() || undefined,
      sourceType: cols[idx("source_type")]?.trim() || undefined,
      notes: cols[idx("notes")]?.trim() || undefined,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function statusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "등록 가능";
    case "duplicate":
      return "중복";
    case "incomplete":
      return "정보 부족";
    case "failed":
      return "오류";
    default:
      return status;
  }
}

/**
 * URL / CSV based discovery import console (client).
 */
export function DiscoveryImportClient() {
  const [urlText, setUrlText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportPreviewSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDuplicateQueue, setCreateDuplicateQueue] = useState(true);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [csvHints, setCsvHints] = useState<CsvHint[]>([]);

  const selectedReady = useMemo(
    () => rows.filter((r) => r.selected && r.status === "ready"),
    [rows]
  );

  async function runPreview(urls: string[], hints: CsvHint[] = []) {
    setPending(true);
    setError(null);
    setCommitResult(null);
    try {
      const overrides: Record<string, Record<string, string | null>> = {};
      for (const hint of hints) {
        overrides[hint.url] = {
          productName: hint.productName ?? null,
          brandName: hint.brandName ?? null,
          detectedCountry: hint.detectedCountry ?? null,
          sourceType: hint.sourceType ?? null,
          notes: hint.notes ?? null,
        };
      }

      const res = await fetch("/api/admin/discovery/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, overrides }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "분석에 실패했습니다.");
        return;
      }

      const items = json.data.items as ImportPreviewItem[];
      setRows(
        items.map((item) => {
          const hint = hints.find((h) => h.url === item.inputUrl);
          return {
            ...item,
            productName: hint?.productName || item.productName,
            brandName:
              hint?.brandName !== undefined ? hint.brandName : item.brandName,
            detectedCountry:
              hint?.detectedCountry || item.detectedCountry,
            sourceType: hint?.sourceType || item.sourceType,
            notes: hint?.notes || item.description || "",
            selected: item.status === "ready",
          };
        })
      );
      setSummary(json.data.summary);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function onAnalyze() {
    const urls = urlText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!urls.length) {
      setError("URL을 입력하세요.");
      return;
    }
    await runPreview(urls, csvHints);
  }

  function onCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 200_000) {
      setError("CSV 파일이 너무 큽니다 (최대 200KB).");
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes("csv") && file.type !== "text/plain") {
      setError("CSV 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? "");
        const hints = parseCsv(text);
        if (!hints.length) {
          setError("CSV에서 URL을 찾지 못했습니다.");
          return;
        }
        setCsvHints(hints);
        setUrlText(hints.map((h) => h.url).join("\n"));
        await runPreview(
          hints.map((h) => h.url),
          hints
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "CSV 파싱 실패");
      }
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kbeauty-discovery-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateRow(index: number, patch: Partial<PreviewRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function onCommit() {
    if (!selectedReady.length || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createDuplicateQueue,
          items: selectedReady.map((row) => ({
            canonicalUrl: row.canonicalUrl,
            productName: row.productName,
            brandName: row.brandName,
            detectedCountry: row.detectedCountry,
            sourceType: row.sourceType,
            notes: row.notes,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      setCommitResult(json.data as CommitResult);
      // mark created as non-selected duplicate-like
      const createdUrls = new Set(
        (json.data.created as Array<{ canonicalUrl: string }>).map(
          (c) => c.canonicalUrl
        )
      );
      setRows((prev) =>
        prev.map((row) =>
          row.canonicalUrl && createdUrls.has(row.canonicalUrl)
            ? { ...row, selected: false, status: "duplicate", warnings: [...row.warnings, "방금 등록됨"] }
            : row
        )
      );
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  function resetAll() {
    setUrlText("");
    setRows([]);
    setSummary(null);
    setError(null);
    setCommitResult(null);
    setCsvHints([]);
  }

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-800">제품 URL (한 줄에 하나, 최대 50)</span>
          <textarea
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            rows={8}
            placeholder={"https://...\nhttps://..."}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onAnalyze}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "분석 중…" : "분석"}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm"
          >
            입력 초기화
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm"
          >
            CSV 템플릿
          </button>
          <label className="cursor-pointer rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm">
            CSV 업로드
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={onCsvFile}
            />
          </label>
        </div>
      </section>

      {summary ? (
        <p className="text-sm text-gray-700">
          총 {summary.total} · 등록가능 {summary.ready} · 중복 {summary.duplicate} ·
          부족 {summary.incomplete} · 오류 {summary.failed}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              className="rounded border border-[#E8DFD8] bg-white px-2 py-1"
              onClick={() =>
                setRows((prev) => prev.map((r) => ({ ...r, selected: true })))
              }
            >
              전체 선택
            </button>
            <button
              type="button"
              className="rounded border border-[#E8DFD8] bg-white px-2 py-1"
              onClick={() =>
                setRows((prev) =>
                  prev.map((r) => ({
                    ...r,
                    selected: r.status === "ready",
                  }))
                )
              }
            >
              등록 가능만 선택
            </button>
            <button
              type="button"
              className="rounded border border-[#E8DFD8] bg-white px-2 py-1"
              onClick={() =>
                setRows((prev) =>
                  prev.map((r) => ({
                    ...r,
                    selected: r.status === "ready" ? r.selected : false,
                  }))
                )
              }
            >
              중복 제외
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-2 py-2">선택</th>
                  <th className="px-2 py-2">이미지</th>
                  <th className="px-2 py-2">제품명</th>
                  <th className="px-2 py-2">브랜드</th>
                  <th className="px-2 py-2">국가</th>
                  <th className="px-2 py-2">도메인</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">경고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.inputUrl}-${index}`} className="border-b border-[#F0E8E2]">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.status !== "ready"}
                        onChange={(e) =>
                          updateRow(index, { selected: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-12 w-12 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.productName ?? ""}
                        disabled={row.status === "failed"}
                        onChange={(e) =>
                          updateRow(index, { productName: e.target.value })
                        }
                        className="w-44 rounded border border-[#E8DFD8] px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.brandName ?? ""}
                        disabled={row.status === "failed"}
                        onChange={(e) =>
                          updateRow(index, { brandName: e.target.value })
                        }
                        className="w-32 rounded border border-[#E8DFD8] px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.detectedCountry ?? ""}
                        disabled={row.status === "failed"}
                        onChange={(e) =>
                          updateRow(index, { detectedCountry: e.target.value })
                        }
                        className="w-16 rounded border border-[#E8DFD8] px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">
                      {row.domain ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{statusLabel(row.status)}</div>
                      {row.duplicateCandidateId ? (
                        <Link
                          href={`/admin/discovery/${row.duplicateCandidateId}`}
                          className="text-xs text-[#8B6914] underline"
                        >
                          기존 후보
                        </Link>
                      ) : null}
                      {row.duplicateProductId != null ? (
                        <Link
                          href={`/admin/products/${row.duplicateProductId}`}
                          className="block text-xs text-[#8B6914] underline"
                        >
                          기존 제품 #{row.duplicateProductId}
                        </Link>
                      ) : null}
                      {row.errorMessage ? (
                        <div className="text-xs text-red-700">{row.errorMessage}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">
                      <div className="mb-1">{row.warnings.join(" · ") || "—"}</div>
                      <select
                        value={row.sourceType ?? "search_result"}
                        disabled={row.status === "failed"}
                        onChange={(e) =>
                          updateRow(index, { sourceType: e.target.value })
                        }
                        className="mb-1 w-full rounded border border-[#E8DFD8] px-1 py-0.5"
                      >
                        {SOURCE_TYPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        value={row.notes}
                        placeholder="notes"
                        disabled={row.status === "failed"}
                        onChange={(e) => updateRow(index, { notes: e.target.value })}
                        className="w-full rounded border border-[#E8DFD8] px-1 py-0.5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={createDuplicateQueue}
              onChange={(e) => setCreateDuplicateQueue(e.target.checked)}
            />
            등록 시 duplicate 검증 큐 자동 생성
          </label>

          <button
            type="button"
            disabled={pending || selectedReady.length === 0}
            onClick={onCommit}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            선택 등록 ({selectedReady.length})
          </button>
        </section>
      ) : null}

      {commitResult ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">등록 결과</p>
          <p className="mt-1">
            요청 {commitResult.summary.requested} · 생성 {commitResult.summary.created} ·
            중복 {commitResult.summary.duplicates} · 실패 {commitResult.summary.failed}
          </p>
          {commitResult.created.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {commitResult.created.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/discovery/${c.id}`}
                    className="font-medium underline"
                  >
                    {c.productName}
                  </Link>
                  {c.queueId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/verification/${c.queueId}`}
                        className="underline"
                      >
                        큐
                      </Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3">
            <Link href="/admin/discovery" className="font-medium underline">
              discovery 목록으로 이동
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
