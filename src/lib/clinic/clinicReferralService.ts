/**
 * Stage 6 — user-facing clinic referral presentation.
 * Publishable clinics only in primary lists; fixtures may appear as labeled demos.
 */

import type { ProfessionalRoute } from "@/lib/care/professionalRouting";
import { buildFixtureClinicCandidates } from "@/lib/clinic/clinicCollection";
import { buildReferralContextFromRoutes } from "@/lib/clinic/clinicReferralContext";
import {
  rankClinicCandidates,
  splitOrganicAndPartnered,
  type RankedClinic,
  type ReferralContext,
} from "@/lib/clinic/referralRankingPolicy";
import {
  isClinicPublishable,
  toRankingCandidate,
  type ClinicFieldRecord,
} from "@/lib/clinic/clinicVerification";

export type ClinicReferralCard = RankedClinic & {
  address: string | null;
  operatingHours: string | null;
  languages: string[];
  consultationBudgetBand: ClinicFieldRecord["consultationBudgetBand"];
  verificationStatus: ClinicFieldRecord["verificationStatus"];
  isDemo: boolean;
};

export type ClinicReferralPresentation = {
  context: ReferralContext;
  organic: ClinicReferralCard[];
  partnered: ClinicReferralCard[];
  demoPreview: ClinicReferralCard[];
  publishableCount: number;
  emptyReason:
    | "urgent_no_listing"
    | "no_publishable_clinics"
    | "no_symptom_match"
    | null;
  publishAllowed: false;
  databaseTouched: false;
  productionTouched: false;
  disclosure: {
    organic: string;
    partnered: string;
    demo: string;
  };
};

function toCard(
  ranked: RankedClinic,
  source: ClinicFieldRecord,
  isDemo: boolean,
): ClinicReferralCard {
  return {
    ...ranked,
    address: source.address,
    operatingHours: source.operatingHours,
    languages: source.languages,
    consultationBudgetBand: source.consultationBudgetBand,
    verificationStatus: source.verificationStatus,
    isDemo,
  };
}

export function buildClinicReferralPresentation(input: {
  routes: ProfessionalRoute[];
  catalog?: ClinicFieldRecord[];
  languages?: string[] | null;
  maxDistanceKm?: number | null;
  consultationBudgetBand?: ReferralContext["consultationBudgetBand"];
  includeDemoPreview?: boolean;
  now?: Date;
}): ClinicReferralPresentation {
  const catalog = input.catalog ?? buildFixtureClinicCandidates();
  const context = buildReferralContextFromRoutes(input.routes, {
    languages: input.languages,
    maxDistanceKm: input.maxDistanceKm,
    consultationBudgetBand: input.consultationBudgetBand,
  });

  const disclosure = {
    organic:
      "공식 근거·증상 태그·운영 정보가 검수된 의료기관만 Organic 안내로 표시합니다. 진단이 아닙니다.",
    partnered:
      "제휴·예약 수수료 의료기관은 Organic 목록과 분리하며, 광고비가 적합도 점수를 바꾸지 않습니다.",
    demo:
      "아래는 fixture 미리보기이며 실제 게시 병원이 아닙니다. 사용자 핵심 추천에 사용하지 않습니다.",
  };

  if (context.urgent) {
    return {
      context,
      organic: [],
      partnered: [],
      demoPreview: [],
      publishableCount: 0,
      emptyReason: "urgent_no_listing",
      publishAllowed: false,
      databaseTouched: false,
      productionTouched: false,
      disclosure,
    };
  }

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const publishable = catalog.filter(isClinicPublishable);
  const ranked = rankClinicCandidates(
    publishable.map(toRankingCandidate),
    context,
    input.now ?? new Date(),
  );
  const split = splitOrganicAndPartnered(ranked);

  const organic = split.organic
    .map((item) => {
      const source = byId.get(item.id);
      return source ? toCard(item, source, false) : null;
    })
    .filter((item): item is ClinicReferralCard => item != null);

  const partnered = split.partnered
    .map((item) => {
      const source = byId.get(item.id);
      return source ? toCard(item, source, false) : null;
    })
    .filter((item): item is ClinicReferralCard => item != null);

  let demoPreview: ClinicReferralCard[] = [];
  if (input.includeDemoPreview !== false && organic.length + partnered.length === 0) {
    const demoRanked = rankClinicCandidates(
      catalog.filter((item) => item.fixtureOnly && item.evidence.length > 0).map(toRankingCandidate),
      { ...context, languages: null, consultationBudgetBand: null },
      input.now ?? new Date(),
    );
    const demoSplit = splitOrganicAndPartnered(demoRanked);
    demoPreview = [...demoSplit.organic, ...demoSplit.partnered]
      .map((item) => {
        const source = byId.get(item.id);
        return source ? toCard(item, source, true) : null;
      })
      .filter((item): item is ClinicReferralCard => item != null)
      .slice(0, 3);
  }

  let emptyReason: ClinicReferralPresentation["emptyReason"] = null;
  if (organic.length + partnered.length === 0) {
    emptyReason =
      publishable.length === 0 ? "no_publishable_clinics" : "no_symptom_match";
  }

  return {
    context,
    organic,
    partnered,
    demoPreview,
    publishableCount: publishable.length,
    emptyReason,
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
    disclosure,
  };
}
