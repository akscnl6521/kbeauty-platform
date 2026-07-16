"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Caps = {
  canUpdateDiscovery: boolean;
  canLinkProduct: boolean;
  canCreateQueue: boolean;
  canPublish: boolean;
};

type Props = {
  candidateId: string;
  caps: Caps;
  initial: {
    discoveredName: string;
    discoveredBrand: string | null;
    discoveredUrl: string | null;
    discoveredCountry: string | null;
    sourceType: string | null;
    notes: string | null;
    duplicateCheckStatus: string;
    linkedProductId: number | null;
    workflowStatus: string;
  };
  openQueueCount: number;
  hasOpenDuplicateQueue: boolean;
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

const REVIEW_TYPES = [
  "duplicate",
  "sale",
  "ingredients",
  "evidence",
  "safety",
  "other",
  "publish",
] as const;

type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};

/**
 * Write controls for discovery candidate detail.
 */
export function DiscoveryWritePanel({
  candidateId,
  caps,
  initial,
  openQueueCount,
  hasOpenDuplicateQueue,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const locked =
    initial.workflowStatus === "published" ||
    initial.workflowStatus === "rejected";

  async function patchCandidate(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/discovery/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: true } | ApiError;
    if (!res.ok || !json.ok) {
      const fail = json as ApiError;
      throw new Error(fail.error?.message ?? "수정 실패");
    }
  }

  async function onSaveBasic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || locked || !caps.canUpdateDiscovery) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      await patchCandidate({
        discoveredName: String(form.get("discoveredName") ?? ""),
        discoveredBrand: String(form.get("discoveredBrand") ?? ""),
        discoveredUrl: String(form.get("discoveredUrl") ?? ""),
        discoveredCountry: String(form.get("discoveredCountry") ?? ""),
        sourceType: String(form.get("sourceType") ?? "") || null,
        notes: String(form.get("notes") ?? ""),
        duplicateCheckStatus: String(form.get("duplicateCheckStatus") ?? ""),
      });
      setMessage("후보 정보가 저장되었습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setPending(false);
    }
  }

  async function onLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || locked || !caps.canLinkProduct) return;
    if (initial.linkedProductId != null) {
      setError("이미 제품이 연결되어 있습니다. 교체는 admin만 가능합니다.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const linkedProductId = String(form.get("linkedProductId") ?? "").trim();
    try {
      await patchCandidate({ linkedProductId });
      setMessage("제품이 연결되었습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "연결 실패");
    } finally {
      setPending(false);
    }
  }

  async function onCreateQueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !caps.canCreateQueue) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const reviewType = String(form.get("reviewType") ?? "duplicate");
    const reason = String(form.get("reason") ?? "");
    const priority = Number(form.get("priority") ?? 100);

    try {
      const res = await fetch("/api/admin/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "candidate",
          entityId: candidateId,
          reviewType,
          priority,
          reason,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { id: string } }
        | ApiError;
      if (!res.ok || !json.ok) {
        const fail = json as ApiError;
        if (fail.error?.code === "QUEUE_ALREADY_OPEN") {
          setError(
            `열린 큐가 이미 있습니다. (${String(fail.error.details?.existingId ?? "")})`
          );
        } else {
          setError(fail.error?.message ?? "큐 생성 실패");
        }
        return;
      }
      setMessage("검증 큐가 생성되었습니다.");
      router.push(`/admin/verification/${json.data.id}`);
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setPending(false);
    }
  }

  if (
    !caps.canUpdateDiscovery &&
    !caps.canLinkProduct &&
    !caps.canCreateQueue
  ) {
    return null;
  }

  return (
    <section className="mt-10 border-t border-[#E8DFD8] pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        쓰기 작업
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        서버에서 권한·상태·중복을 재검증합니다. 열린 큐: {openQueueCount}건
      </p>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {locked ? (
        <p className="mt-4 text-sm text-gray-500">
          {initial.workflowStatus} 상태에서는 쓰기 작업이 잠겨 있습니다.
        </p>
      ) : null}

      {caps.canUpdateDiscovery && !locked ? (
        <form onSubmit={onSaveBasic} className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">기본정보 편집</h3>
          <label className="block text-sm">
            <span className="text-gray-600">제품명</span>
            <input
              name="discoveredName"
              defaultValue={initial.discoveredName}
              required
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">브랜드</span>
            <input
              name="discoveredBrand"
              defaultValue={initial.discoveredBrand ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">URL (https)</span>
            <input
              name="discoveredUrl"
              defaultValue={initial.discoveredUrl ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-600">국가</span>
              <input
                name="discoveredCountry"
                defaultValue={initial.discoveredCountry ?? ""}
                className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">source_type</span>
              <select
                name="sourceType"
                defaultValue={initial.sourceType ?? ""}
                className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              >
                <option value="">선택 안 함</option>
                {SOURCE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">duplicate_check_status</span>
            <select
              name="duplicateCheckStatus"
              defaultValue={initial.duplicateCheckStatus}
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            >
              <option value="pending">pending</option>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={initial.notes ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            저장
          </button>
        </form>
      ) : null}

      {caps.canLinkProduct && !locked ? (
        <form onSubmit={onLink} className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">제품 연결</h3>
          <p className="text-xs text-gray-500">
            현재 연결: {initial.linkedProductId ?? "없음"} · 해제 불가 · 교체는
            admin만
          </p>
          <label className="block text-sm">
            <span className="text-gray-600">products.id</span>
            <input
              name="linkedProductId"
              required
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              placeholder="예: 4"
            />
          </label>
          <button
            type="submit"
            disabled={pending || initial.linkedProductId != null}
            className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-60"
          >
            제품 연결
          </button>
        </form>
      ) : null}

      {caps.canCreateQueue ? (
        <form onSubmit={onCreateQueue} className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">검증 큐 생성</h3>
          {hasOpenDuplicateQueue ? (
            <p className="text-xs text-amber-800">
              동일 review_type의 열린 큐가 있으면 서버가 409로 차단합니다.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-600">review_type</span>
              <select
                name="reviewType"
                defaultValue="duplicate"
                className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              >
                {REVIEW_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                    {v === "publish" && !caps.canPublish ? " (admin)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">priority</span>
              <input
                name="priority"
                type="number"
                min={1}
                max={1000}
                defaultValue={100}
                className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">reason</span>
            <input
              name="reason"
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            검증 큐 생성
          </button>
        </form>
      ) : null}
    </section>
  );
}
