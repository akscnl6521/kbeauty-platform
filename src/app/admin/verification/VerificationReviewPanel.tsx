"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  queueId: string;
  status: string;
  reviewType: string;
  canReview: boolean;
  canPublish: boolean;
};

type ApiError = {
  ok: false;
  error: { code: string; message: string };
};

/**
 * Verification review actions (start / approve / reject / needs_review).
 */
export function VerificationReviewPanel({
  queueId,
  status,
  reviewType,
  canReview,
  canPublish,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const closed = status === "approved" || status === "rejected";
  const publishBlocked = reviewType === "publish" && !canPublish;

  async function run(action: string) {
    if (pending || !canReview || closed) return;
    if (
      (action === "reject" || action === "needs_review") &&
      notes.trim().length < 2
    ) {
      setError("반려/추가 검토에는 메모가 필요합니다.");
      return;
    }
    if (action === "approve" && publishBlocked) {
      setError("게시(publish) 권한이 없습니다.");
      return;
    }

    const labels: Record<string, string> = {
      start_review: "검토를 시작",
      approve: "승인",
      reject: "반려",
      needs_review: "추가 검토 필요로 표시",
    };
    if (!window.confirm(`정말 ${labels[action] ?? action}할까요?`)) return;

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/verification/${queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewerNotes: notes,
        }),
      });
      const json = (await res.json()) as
        | {
            ok: true;
            data: { status: string; candidateWorkflowStatus: string | null };
          }
        | ApiError;

      if (!res.ok || !json.ok) {
        const fail = json as ApiError;
        setError(fail.error?.message ?? "처리 실패");
        return;
      }

      setMessage(
        json.data.candidateWorkflowStatus
          ? `처리 완료 · candidate workflow: ${json.data.candidateWorkflowStatus}`
          : "처리 완료"
      );
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setPending(false);
    }
  }

  if (!canReview) {
    return (
      <section className="mt-10 border-t border-[#E8DFD8] pt-6">
        <h2 className="text-lg font-semibold">검토 처리</h2>
        <p className="mt-2 text-sm text-gray-500">
          검토 권한이 없습니다. 읽기만 가능합니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-[#E8DFD8] pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        검토 처리
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        pending → 검토 시작 → 승인/반려/추가 검토. 직접 pending→승인 금지.
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

      <label className="mt-4 block text-sm">
        <span className="text-gray-600">reviewer notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={closed || pending}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 disabled:opacity-60"
          placeholder="반려/추가 검토 시 필수"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || closed || status !== "pending"}
          onClick={() => run("start_review")}
          className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          검토 시작
        </button>
        <button
          type="button"
          disabled={
            pending || closed || status !== "in_review" || publishBlocked
          }
          onClick={() => run("approve")}
          className="rounded-lg bg-[#8B6914] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          title={
            publishBlocked
              ? "publish 승인은 admin만 가능"
              : undefined
          }
        >
          승인
        </button>
        <button
          type="button"
          disabled={pending || closed || status !== "in_review"}
          onClick={() => run("reject")}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
        >
          반려
        </button>
        <button
          type="button"
          disabled={pending || closed || status !== "in_review"}
          onClick={() => run("needs_review")}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
        >
          추가 검토 필요
        </button>
      </div>

      {publishBlocked ? (
        <p className="mt-3 text-xs text-amber-800">
          review_type=publish 승인은 admin 권한과 verified·제품연결·check pass
          전제조건이 필요합니다.
        </p>
      ) : null}
    </section>
  );
}
