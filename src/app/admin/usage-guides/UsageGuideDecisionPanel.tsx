"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DECISIONS = [
  { value: "approved", label: "승인" },
  { value: "needs_review", label: "보류 (재검수)" },
  { value: "rejected", label: "반려" },
  { value: "superseded", label: "대체됨" },
] as const;

type Decision = (typeof DECISIONS)[number]["value"];

/** Records a review decision. The server refuses approval without evidence. */
export function UsageGuideDecisionPanel({
  guideId,
  canApprove,
}: {
  guideId: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>(
    canApprove ? "approved" : "needs_review"
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/usage-guides/${guideId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        error?: { message?: string; details?: { reasonCodes?: string[] } };
      };
      if (!res.ok || !body.ok) {
        const reasons = body.error?.details?.reasonCodes;
        setMessage({
          kind: "error",
          text: [
            body.error?.message ?? "처리하지 못했습니다.",
            reasons?.length ? `(${reasons.join(", ")})` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
        return;
      }
      setMessage({ kind: "ok", text: "검수 결과를 저장했습니다." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "네트워크 오류로 저장하지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-800">검수 결과</legend>
        {DECISIONS.map((option) => {
          const disabled = option.value === "approved" && !canApprove;
          return (
            <label
              key={option.value}
              className={`flex items-center gap-2 text-sm ${
                disabled ? "text-gray-400" : "text-gray-800"
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={option.value}
                checked={decision === option.value}
                disabled={disabled}
                onChange={() => setDecision(option.value)}
              />
              {option.label}
              {disabled ? (
                <span className="text-xs">— 근거 부족으로 선택 불가</span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <label className="block text-sm">
        <span className="text-gray-600">
          메모 {decision === "rejected" ? "(반려 시 필수)" : "(선택)"}
        </span>
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          placeholder="원문과 대조한 결과를 남겨 주세요."
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "검수 결과 저장"}
      </button>

      {message ? (
        <p
          role="status"
          className={
            message.kind === "ok"
              ? "text-sm text-emerald-800"
              : "text-sm text-red-800"
          }
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
