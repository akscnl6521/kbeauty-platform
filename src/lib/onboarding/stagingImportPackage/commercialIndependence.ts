/**
 * P3-T05 commercial separation proof for Staging import eligibility.
 * Paid lanes must not reorder Organic candidates or invent organic eligibility.
 */

import type { StagingCommercialIndependenceProof, StagingImportRow } from "./types";

export function proveStagingCommercialIndependence(
  rows: readonly StagingImportRow[],
): StagingCommercialIndependenceProof {
  const organic = rows
    .filter((r) => r.commercialLane === "organic" || r.commercialLane === "none")
    .map((r) => r.importId)
    .sort();

  const withPaidNoise = [...organic, ...rows
    .filter(
      (r) =>
        r.commercialLane === "affiliate" || r.commercialLane === "sponsored",
    )
    .map((r) => `paid:${r.importId}`)];

  // Organic order is derived without paid ids — compare organic-only slice.
  const organicFromNoise = withPaidNoise
    .filter((id) => !id.startsWith("paid:"))
    .sort();

  const organicOrderUnchanged =
    organic.length === organicFromNoise.length &&
    organic.every((id, i) => id === organicFromNoise[i]);

  const paidRows = rows.filter(
    (r) =>
      r.commercialLane === "affiliate" || r.commercialLane === "sponsored",
  );
  const stagingEligibilityIgnoresPaidLane = paidRows.every(
    (r) =>
      r.structurallyStagingImportEligible === false ||
      r.commercialLane === "organic",
  );

  // Stronger rule: paid commercial lane never grants structural staging eligibility
  // in this package (organic/none only may be eligible when non-fixture).
  const paidNeverEligible = paidRows.every(
    (r) => r.structurallyStagingImportEligible === false,
  );

  return {
    organicOrderUnchanged,
    organicOrderIds: organic,
    paidNoiseOrderIds: withPaidNoise,
    stagingEligibilityIgnoresPaidLane:
      stagingEligibilityIgnoresPaidLane && paidNeverEligible,
    noteKo:
      "제휴·스폰서 레인은 Organic 정렬을 바꾸지 않으며, 유료 레인만으로 Staging import 구조적 적격을 부여하지 않는다.",
  };
}
