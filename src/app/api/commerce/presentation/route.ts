import { NextRequest, NextResponse } from "next/server";
import type { CommercialMetadata } from "@/lib/catalog/commonProduct";
import {
  buildOrganicCommercePresentation,
  type OrganicRankInput,
} from "@/lib/commercial/organicRanking";
import { resolveAdSlot, type AdSlotZone } from "@/lib/commercial/adSlotPolicy";
import { commerceLaneLabel } from "@/lib/commercial/commerceLabels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCommercial(raw: unknown): CommercialMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    organicRank: typeof row.organicRank === "number" ? row.organicRank : null,
    isAffiliate: row.isAffiliate === true,
    isSponsored: row.isSponsored === true,
    disclosureLabel:
      typeof row.disclosureLabel === "string" ? row.disclosureLabel : null,
    partner: typeof row.partner === "string" ? row.partner : null,
    commissionType:
      typeof row.commissionType === "string" ? row.commissionType : null,
    campaignId: typeof row.campaignId === "string" ? row.campaignId : null,
    sponsoredPlacement:
      typeof row.sponsoredPlacement === "number" ? row.sponsoredPlacement : null,
    affiliateUrl: typeof row.affiliateUrl === "string" ? row.affiliateUrl : null,
    affiliateVerifiedAt:
      typeof row.affiliateVerifiedAt === "string"
        ? row.affiliateVerifiedAt
        : null,
  };
}

function parseCandidates(raw: unknown): OrganicRankInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const organicScore =
      typeof row.organicScore === "number" ? row.organicScore : null;
    const commercial = parseCommercial(row.commercial);
    if (!id || organicScore == null || !commercial) return [];
    return [
      {
        id,
        entityType: row.entityType === "clinic" ? "clinic" : "product",
        organicScore,
        commercial,
        organicRankEligible:
          typeof row.organicRankEligible === "boolean"
            ? row.organicRankEligible
            : undefined,
      },
    ];
  });
}

/**
 * Build Organic / Affiliate / Sponsored presentation.
 * Paid fields never reorder Organic lane.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const candidates = parseCandidates(body.candidates);
    if (candidates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CANDIDATES_REQUIRED",
            message: "commercial candidates가 필요합니다.",
          },
        },
        { status: 400 },
      );
    }

    const presentation = buildOrganicCommercePresentation(candidates);
    const zone =
      body.zone === "urgent_safety" ||
      body.zone === "expert_first_safety" ||
      body.zone === "affiliate_aside" ||
      body.zone === "sponsored_rail" ||
      body.zone === "clinic_partner_aside" ||
      body.zone === "organic_recommendation"
        ? (body.zone as AdSlotZone)
        : "organic_recommendation";

    return NextResponse.json({
      ok: true,
      data: {
        presentation,
        adSlot: resolveAdSlot(zone),
        labels: {
          organic: commerceLaneLabel("organic"),
          affiliate: commerceLaneLabel("affiliate"),
          sponsored: commerceLaneLabel("sponsored"),
        },
        productionTouched: false,
        databaseTouched: false,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "COMMERCE_PRESENTATION_UNAVAILABLE",
          message: "상업 분리 안내를 불러오지 못했습니다.",
        },
      },
      { status: 500 },
    );
  }
}
