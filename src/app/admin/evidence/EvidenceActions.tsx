"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ReviewItem = { id: string; reviewStatus: string };

export function EvidenceCreateForm({
  defaultIngredientId,
}: {
  defaultIngredientId?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setOk(null);
    const body = {
      ingredientId: Number(formData.get("ingredientId")),
      concernCode: String(formData.get("concernCode") || ""),
      evidenceType: String(formData.get("evidenceType") || "cosmetic_study"),
      evidenceLevel: String(
        formData.get("evidenceLevel") || "controlled_clinical_study"
      ),
      pmid: String(formData.get("pmid") || "") || null,
      doi: String(formData.get("doi") || "") || null,
      sourceUrl: String(formData.get("sourceUrl") || "") || null,
      outcomeSummary: String(formData.get("outcomeSummary") || ""),
      journal: String(formData.get("journal") || "") || null,
      publicationYear: formData.get("publicationYear")
        ? Number(formData.get("publicationYear"))
        : null,
      approveNow: formData.get("approveNow") === "on",
    };

    const res = await fetch("/api/admin/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: { message?: string };
      data?: { id?: string; reviewStatus?: string };
    } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "등록 실패");
      return;
    }
    setOk(
      `등록됨 · ${json.data?.reviewStatus ?? "pending"} · id ${json.data?.id ?? ""}`
    );
    startTransition(() => router.refresh());
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-[#E8DFD8] bg-white p-4"
      action={(fd) => {
        void onSubmit(fd);
      }}
    >
      <p className="text-sm font-semibold text-gray-900">근거 등록</p>
      <p className="text-xs text-gray-600">
        PMID/DOI/https URL 중 하나 필수. claim·가짜 논문 금지. researcher는
        pending, admin은 즉시 승인 가능.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-600">
          ingredientId
          <input
            name="ingredientId"
            type="number"
            required
            defaultValue={defaultIngredientId ?? ""}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          concernCode
          <select
            name="concernCode"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            defaultValue="redness"
          >
            <option value="redness">redness</option>
            <option value="dryness">dryness</option>
            <option value="sensitivity">sensitivity</option>
            <option value="acne">acne</option>
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          evidenceType
          <select
            name="evidenceType"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            defaultValue="cosmetic_study"
          >
            <option value="cosmetic_study">cosmetic_study</option>
            <option value="drug_study">drug_study</option>
            <option value="guideline">guideline</option>
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          evidenceLevel
          <select
            name="evidenceLevel"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            defaultValue="controlled_clinical_study"
          >
            <option value="systematic_review">systematic_review</option>
            <option value="randomized_controlled_trial">
              randomized_controlled_trial
            </option>
            <option value="controlled_clinical_study">
              controlled_clinical_study
            </option>
            <option value="observational_study">observational_study</option>
            <option value="expert_guideline">expert_guideline</option>
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          PMID
          <input
            name="pmid"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          DOI
          <input
            name="doi"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">
          sourceUrl (https)
          <input
            name="sourceUrl"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
          />
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">
          outcomeSummary
          <textarea
            name="outcomeSummary"
            required
            rows={3}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          journal
          <input
            name="journal"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          publicationYear
          <input
            name="publicationYear"
            type="number"
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input name="approveNow" type="checkbox" />
        즉시 승인 (admin/reviewer 권한일 때만 적용)
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "저장 중…" : "근거 등록"}
      </button>
    </form>
  );
}

export function EvidenceReviewButtons({
  item,
}: {
  item: ReviewItem;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const show = useMemo(
    () => item.reviewStatus !== "approved" && item.reviewStatus !== "rejected",
    [item.reviewStatus]
  );

  if (!show) return null;

  async function review(action: "approve" | "reject" | "needs_review") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/evidence/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.ok) {
        setMsg(json?.error?.message ?? "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void review("approve")}
        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800"
      >
        승인
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void review("reject")}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-800"
      >
        거절
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void review("needs_review")}
        className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800"
      >
        needs_review
      </button>
      {msg ? <span className="text-xs text-red-700">{msg}</span> : null}
    </div>
  );
}
