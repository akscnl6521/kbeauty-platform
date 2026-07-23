import {
  COMMERCE_LANE_HINTS_KO,
  COMMERCE_LANE_LABELS_KO,
  type CommerceLaneLabelKey,
} from "@/lib/commercial/commerceLabels";

const TONE: Record<CommerceLaneLabelKey, string> = {
  organic: "border-blue-100 bg-blue-50/50 text-blue-950",
  affiliate: "border-amber-200 bg-amber-50/60 text-amber-950",
  sponsored: "border-violet-200 bg-violet-50/50 text-violet-950",
  partner_clinic: "border-violet-200 bg-violet-50/50 text-violet-950",
  demo_fixture: "border-dashed border-gray-300 bg-gray-50 text-gray-800",
};

/**
 * Explicit lane label — keeps Organic / paid placements visually separated.
 */
export function CommerceLaneBadge({
  lane,
  showHint = false,
}: {
  lane: CommerceLaneLabelKey;
  showHint?: boolean;
}) {
  return (
    <div className={`rounded-md border px-2 py-1 text-xs ${TONE[lane]}`}>
      <p className="font-semibold">{COMMERCE_LANE_LABELS_KO[lane]}</p>
      {showHint ? (
        <p className="mt-0.5 leading-snug opacity-90">
          {COMMERCE_LANE_HINTS_KO[lane]}
        </p>
      ) : null}
    </div>
  );
}
