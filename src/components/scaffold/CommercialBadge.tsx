/**
 * Scaffold-mode placeholder for ad/affiliate disclosure. Structure only —
 * defaults to hidden (`show=false`) since no real ad/affiliate contract is
 * active yet. Flip `show` to true per-item once a real commercial
 * relationship exists; the label/style is already wired.
 */
export type CommercialBadgeKind = "ad" | "affiliate";

const LABEL: Record<CommercialBadgeKind, string> = {
  ad: "광고",
  affiliate: "제휴",
};

/** Full disclosure sentence — not just the bare word, so the user knows what it means. */
const DISCLOSURE: Record<CommercialBadgeKind, string> = {
  ad: "광고 — 비용을 받고 노출되는 항목입니다. 적합도 순위에는 영향을 주지 않습니다.",
  affiliate:
    "제휴 — 연결·구매·상담 성사 시 운영사가 수수료를 받을 수 있습니다. 적합도 순위에는 영향을 주지 않습니다.",
};

const STYLE: Record<CommercialBadgeKind, string> = {
  ad: "border-orange-300 bg-orange-50 text-orange-800",
  affiliate: "border-violet-300 bg-violet-50 text-violet-900",
};

export function CommercialBadge({
  kind,
  show = false,
}: {
  kind: CommercialBadgeKind;
  show?: boolean;
}) {
  if (!show) return null;
  return (
    <span
      title={DISCLOSURE[kind]}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STYLE[kind]}`}
    >
      {LABEL[kind]}
    </span>
  );
}
