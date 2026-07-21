"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  buildPreviewTestEmailPreview,
  type PreviewTestEmailKind,
} from "@/lib/retention/checkinEmailPreviewTestPayload";
import type { CheckinLocale, CheckinMilestone } from "@/lib/retention/checkinPolicy";

export type CheckInEmailTestClientProps = {
  deliveryMode: string;
  providerName: string;
  fromMasked: string;
  recipientMasked: string;
  previewOnly: boolean;
  sendEnabled: boolean;
  productionBlocked: boolean;
  initialMilestone: CheckinMilestone;
  initialLocale: CheckinLocale;
  initialKind: PreviewTestEmailKind;
  siteOrigin: string | null;
};

const MILESTONES: CheckinMilestone[] = ["day3", "day7", "day15", "day30"];
const LOCALES: CheckinLocale[] = ["ko", "en", "ja"];
const KINDS: PreviewTestEmailKind[] = ["checkin_due", "checkin_reminder"];

const COOLDOWN_MS = 60_000;

export function CheckInEmailTestClient(props: CheckInEmailTestClientProps) {
  const [milestone, setMilestone] = useState(props.initialMilestone);
  const [locale, setLocale] = useState(props.initialLocale);
  const [kind, setKind] = useState(props.initialKind);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    outcome?: string;
    reasonCode?: string;
    recipientMask?: string;
    providerMessageIdPrefix?: string;
    errorCode?: string;
  } | null>(null);

  const preview = useMemo(
    () =>
      buildPreviewTestEmailPreview({
        milestone,
        kind,
        locale,
        siteOrigin: props.siteOrigin,
      }),
    [milestone, kind, locale, props.siteOrigin]
  );

  const inCooldown = cooldownUntil !== null && Date.now() < cooldownUntil;
  const sendDisabled =
    props.productionBlocked ||
    !props.sendEnabled ||
    !confirmed ||
    loading ||
    inCooldown;

  const send = useCallback(async () => {
    if (sendDisabled) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/checkin-email/test-send", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone, kind, locale, confirm: true }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: {
          outcome: string;
          reasonCode: string;
          recipientMask: string;
          providerMessageIdPrefix?: string;
        };
        error?: { code: string; message: string };
      };
      if (json.ok && json.data) {
        setResult({
          ok: true,
          outcome: json.data.outcome,
          reasonCode: json.data.reasonCode,
          recipientMask: json.data.recipientMask,
          providerMessageIdPrefix: json.data.providerMessageIdPrefix,
        });
        if (json.data.outcome === "live_completed") {
          setCooldownUntil(Date.now() + COOLDOWN_MS);
        }
      } else {
        setResult({
          ok: false,
          errorCode: json.error?.code ?? "unknown_error",
        });
      }
    } catch {
      setResult({ ok: false, errorCode: "network_error" });
    } finally {
      setLoading(false);
    }
  }, [kind, locale, milestone, sendDisabled]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <p className="font-semibold">Preview 전용 — 실제 이메일 1건이 발송됩니다</p>
        <p className="mt-1 text-xs">
          테스트 데이터만 사용합니다. Production에서는 발송할 수 없습니다.
        </p>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">발송 모드</dt>
          <dd>{props.deliveryMode}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">Provider</dt>
          <dd>{props.providerName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">발신</dt>
          <dd>{props.fromMasked}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">수신 (allowlist)</dt>
          <dd>{props.recipientMasked}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">환경</dt>
          <dd>
            {props.productionBlocked
              ? "Production 차단"
              : props.previewOnly
                ? "Preview"
                : "Preview 아님"}
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">Milestone</span>
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={milestone}
            onChange={(e) => setMilestone(e.target.value as CheckinMilestone)}
          >
            {MILESTONES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Locale</span>
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={locale}
            onChange={(e) => setLocale(e.target.value as CheckinLocale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Kind</span>
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={kind}
            onChange={(e) => setKind(e.target.value as PreviewTestEmailKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-lg border bg-gray-50 p-4">
        <h2 className="text-sm font-semibold">미리보기</h2>
        <p className="mt-2 text-sm font-medium">{preview.subject}</p>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
          {preview.textBody}
        </pre>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          이 작업은 실제 이메일 1건을 발송하며 Preview 환경에서만 실행된다는 것을
          확인했습니다.
        </span>
      </label>

      <button
        type="button"
        disabled={sendDisabled}
        onClick={() => void send()}
        className="rounded bg-[#8B6914] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "발송 중…"
          : inCooldown
            ? "60초 후 재발송 가능"
            : "테스트 이메일 발송"}
      </button>

      {result && (
        <div
          className={`rounded border p-3 text-sm ${
            result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}
        >
          {result.ok ? (
            <ul className="space-y-1">
              <li>outcome: {result.outcome}</li>
              <li>reasonCode: {result.reasonCode}</li>
              <li>recipientMask: {result.recipientMask}</li>
              {result.providerMessageIdPrefix && (
                <li>messageIdPrefix: {result.providerMessageIdPrefix}</li>
              )}
            </ul>
          ) : (
            <p>errorCode: {result.errorCode}</p>
          )}
        </div>
      )}

      <Link href="/admin/care/check-ins" className="inline-block text-[#8B6914] underline">
        ← 체크인 집계
      </Link>
    </div>
  );
}
