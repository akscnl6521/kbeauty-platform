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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STYLE[kind]}`}
    >
      {LABEL[kind]}
    </span>
  );
}
