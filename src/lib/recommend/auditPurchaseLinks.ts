import { selectPurchaseLink } from "./selectPurchaseLink";
import type { CandidateProduct } from "./types";

const AUDIT_LINK_FIELDS = [
  "link_amazon_us",
  "link_amazon_jp",
  "link_yesstyle",
  "link_sephora",
  "link_qoo10",
] as const;

type AuditLinkField = (typeof AUDIT_LINK_FIELDS)[number];

function hasLink(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Sprint 3 Phase 3C — 후보 제품 구매 링크 커버리지 집계 (개발 전용).
 */
export function countPurchaseLinkCoverage(products: CandidateProduct[]): {
  productCount: number;
  withAnyOfFive: number;
  counts: Record<AuditLinkField, number>;
} {
  const counts: Record<AuditLinkField, number> = {
    link_amazon_us: 0,
    link_amazon_jp: 0,
    link_yesstyle: 0,
    link_sephora: 0,
    link_qoo10: 0,
  };
  let withAnyOfFive = 0;

  for (const p of products) {
    let any = false;
    for (const field of AUDIT_LINK_FIELDS) {
      if (hasLink(p[field])) {
        counts[field] += 1;
        any = true;
      }
    }
    if (any) withAnyOfFive += 1;
  }

  return {
    productCount: products.length,
    withAnyOfFive,
    counts,
  };
}

/** fetchCandidateProducts 직후 커버리지 로그 */
export function logPurchaseLinkCoverage(products: CandidateProduct[]): void {
  if (process.env.NODE_ENV !== "development") return;

  const summary = countPurchaseLinkCoverage(products);
  console.log("[purchaseLinkAudit]", {
    stage: "fetchCandidateProducts",
    productCount: summary.productCount,
    withAnyAuditedLink: summary.withAnyOfFive,
    link_amazon_us: summary.counts.link_amazon_us,
    link_amazon_jp: summary.counts.link_amazon_jp,
    link_yesstyle: summary.counts.link_yesstyle,
    link_sephora: summary.counts.link_sephora,
    link_qoo10: summary.counts.link_qoo10,
  });
}

function listAvailableLinks(product: CandidateProduct): string[] {
  const available: string[] = [];
  for (const field of AUDIT_LINK_FIELDS) {
    if (hasLink(product[field])) available.push(field);
  }
  // 감사 대상 외 링크도 참고용으로 포함
  if (hasLink(product.link_oliveyoung)) available.push("link_oliveyoung");
  if (hasLink(product.link_coupang)) available.push("link_coupang");
  return available;
}

/**
 * Top5 추천 카드 렌더 시 제품별 선택 링크 감사 (개발 전용).
 */
export function logTopProductPurchaseLinkAudit(
  product: CandidateProduct,
  countryCode: string | null | undefined,
  productName: string
): void {
  if (process.env.NODE_ENV !== "development") return;

  const selected = selectPurchaseLink(product, countryCode);
  console.log("[purchaseLinkAudit]", {
    stage: "recommendationRender",
    productId: product.id,
    productName,
    availableLinks: listAvailableLinks(product),
    selectedMarketplace: selected?.marketplace ?? null,
    selectedUrl: selected?.url ?? null,
    selectedStatus: selected?.verificationStatus ?? null,
    selectedReason: selected?.reason ?? null,
    countryCode: countryCode ?? null,
    note:
      selected == null
        ? "no verified link for selected country (Amazon US unverified → hidden)"
        : undefined,
  });
}
