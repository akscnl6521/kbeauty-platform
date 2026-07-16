import type {
  DedupeDecision,
  ExtractedCatalogProduct,
  QualityScore,
  SiteDiscoveryResult,
} from "@/lib/pipeline/types";
import type { OfficialSiteResolution } from "@/lib/pipeline/official-site-resolver";
import {
  isPlaceholderBrand,
  looksLikeProductTitle,
  looksLikeProductUrl,
} from "@/lib/pipeline/product-page";

export type GateResult = {
  pass: boolean;
  reasons: string[];
  blockers: string[];
};

/**
 * Quality gate for autonomous candidate commit (never publish).
 */
export function evaluateCandidateCommitGate(input: {
  site: OfficialSiteResolution | SiteDiscoveryResult | null;
  product: ExtractedCatalogProduct;
  dedupe: DedupeDecision;
  quality: QualityScore;
  officialConfidence: number;
}): GateResult {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (!input.product.canonicalUrl?.startsWith("https://")) {
    blockers.push("https canonical URL 필요");
  }
  if (!looksLikeProductUrl(input.product.canonicalUrl ?? "")) {
    blockers.push("제품 URL 패턴 아님");
  }
  if (!input.product.productName?.trim()) blockers.push("제품명 없음");
  if (!looksLikeProductTitle(input.product.productName)) {
    blockers.push("제품명 패턴 아님");
  }
  if (isPlaceholderBrand(input.product.brandName)) {
    blockers.push("브랜드명 없음/Unknown");
  }
  if (input.product.confidence < 0.5) blockers.push("추출 confidence 미달");
  if (input.officialConfidence < 0.65) blockers.push("공식 사이트 confidence 미달");
  if (input.dedupe.action !== "create_candidate") {
    blockers.push(`중복 판정: ${input.dedupe.action}`);
  }
  if (input.quality.publishEligible) {
    blockers.push("publishEligible true는 정책 위반 — 차단");
  }

  if (input.site && "allowCrawl" in input.site && !input.site.allowCrawl) {
    blockers.push("공식 사이트 crawl 미허용");
  }
  if (input.site && "classification" in input.site) {
    const c = input.site.classification;
    if (["marketplace", "retailer", "social", "blocked", "unrelated"].includes(c)) {
      blockers.push(`사이트 분류 ${c}`);
    }
  }

  if (!blockers.length) {
    reasons.push("게이트 통과 — candidate commit 가능");
  }

  return { pass: blockers.length === 0, reasons, blockers };
}

export function evaluateBatchCommitReadiness(input: {
  successItems: number;
  reviewItems: number;
  failedItems: number;
  processedItems: number;
}): GateResult {
  const blockers: string[] = [];
  if (input.processedItems < 1) blockers.push("처리 항목 없음");
  if (input.successItems < 1) blockers.push("성공 항목 없음");
  const failRate =
    input.processedItems > 0 ? input.failedItems / input.processedItems : 1;
  if (failRate > 0.6) blockers.push("실패율 과다");
  return {
    pass: blockers.length === 0,
    reasons: blockers.length ? [] : ["배치 커밋 준비됨"],
    blockers,
  };
}
