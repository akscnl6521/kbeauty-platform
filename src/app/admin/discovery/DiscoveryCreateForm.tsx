"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};

/**
 * Manual discovery candidate registration form.
 */
export function DiscoveryCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body = {
      discoveredName: String(form.get("discoveredName") ?? ""),
      discoveredBrand: String(form.get("discoveredBrand") ?? ""),
      discoveredUrl: String(form.get("discoveredUrl") ?? ""),
      discoveredCountry: String(form.get("discoveredCountry") ?? ""),
      sourceType: String(form.get("sourceType") ?? "") || null,
      notes: String(form.get("notes") ?? ""),
    };

    try {
      const res = await fetch("/api/admin/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as
        | { ok: true; data: { id: string } }
        | ApiError;

      if (!res.ok || !json.ok) {
        const fail = json as ApiError;
        if (fail.error?.code === "DUPLICATE_CANDIDATE") {
          const existingId = fail.error.details?.existingId;
          setError(
            existingId
              ? `중복 후보입니다. 기존 ID: ${String(existingId)}`
              : fail.error.message
          );
        } else {
          setError(fail.error?.message ?? "등록에 실패했습니다.");
        }
        setPending(false);
        return;
      }

      router.push(`/admin/discovery/${json.data.id}`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="text-gray-600">제품명 (필수)</span>
        <input
          name="discoveredName"
          required
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-gray-600">브랜드</span>
        <input
          name="discoveredBrand"
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-gray-600">출처 URL (https만)</span>
        <input
          name="discoveredUrl"
          type="url"
          placeholder="https://"
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-gray-600">국가 코드</span>
          <input
            name="discoveredCountry"
            maxLength={8}
            placeholder="KR"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">source_type</span>
          <select
            name="sourceType"
            defaultValue="admin_entry"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">선택 안 함</option>
            {SOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-gray-600">notes</span>
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "등록 중…" : "제품 후보 등록"}
      </button>
    </form>
  );
}
