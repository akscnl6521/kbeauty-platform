/**
 * Ad slot safety — sponsored placements stay outside Organic recommendation lanes.
 */

export type AdSlotZone =
  | "organic_recommendation"
  | "affiliate_aside"
  | "sponsored_rail"
  | "clinic_partner_aside"
  | "urgent_safety"
  | "expert_first_safety";

export type AdSlotDecision = {
  zone: AdSlotZone;
  allowOrganic: boolean;
  allowAffiliate: boolean;
  allowSponsored: boolean;
  allowPartnerClinic: boolean;
  reasonCodes: string[];
};

const ZONE_RULES: Record<AdSlotZone, Omit<AdSlotDecision, "zone">> = {
  organic_recommendation: {
    allowOrganic: true,
    allowAffiliate: false,
    allowSponsored: false,
    allowPartnerClinic: false,
    reasonCodes: ["organic_lane_only"],
  },
  affiliate_aside: {
    allowOrganic: false,
    allowAffiliate: true,
    allowSponsored: false,
    allowPartnerClinic: false,
    reasonCodes: ["affiliate_aside_separated"],
  },
  sponsored_rail: {
    allowOrganic: false,
    allowAffiliate: false,
    allowSponsored: true,
    allowPartnerClinic: false,
    reasonCodes: ["sponsored_rail_separated"],
  },
  clinic_partner_aside: {
    allowOrganic: false,
    allowAffiliate: false,
    allowSponsored: false,
    allowPartnerClinic: true,
    reasonCodes: ["partner_clinic_aside"],
  },
  urgent_safety: {
    allowOrganic: false,
    allowAffiliate: false,
    allowSponsored: false,
    allowPartnerClinic: false,
    reasonCodes: ["urgent_blocks_all_commercial"],
  },
  expert_first_safety: {
    allowOrganic: true,
    allowAffiliate: false,
    allowSponsored: false,
    allowPartnerClinic: false,
    reasonCodes: ["expert_first_hides_paid_product_placements"],
  },
};

export function resolveAdSlot(zone: AdSlotZone): AdSlotDecision {
  return { zone, ...ZONE_RULES[zone] };
}

export function assertSponsoredNotInOrganicLane(
  zone: AdSlotZone,
  placement: "organic" | "affiliate" | "sponsored" | "partner_clinic",
): boolean {
  const decision = resolveAdSlot(zone);
  if (placement === "organic") return decision.allowOrganic;
  if (placement === "affiliate") return decision.allowAffiliate;
  if (placement === "sponsored") return decision.allowSponsored;
  return decision.allowPartnerClinic;
}
