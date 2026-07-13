/**
 * Marketplace / retailer / social host classifiers (no crawl as official).
 */

const MARKETPLACE = [
  "amazon.",
  "coupang.",
  "oliveyoung.",
  "sephora.",
  "yesstyle.",
  "qoo10.",
  "iherb.",
  "stylekorean.",
  "sokoglam.",
  "jolse.",
  "wishtrend.",
  "ebay.",
  "rakuten.",
  "shopee.",
  "aliexpress.",
  "walmart.",
  "target.",
  "ulta.",
];

const SOCIAL = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "linkedin.com",
  "linktr.ee",
  "linktree",
  "naver.blog",
  "blog.naver",
];

export type DomainClass =
  | "verified_official"
  | "likely_official"
  | "retailer"
  | "marketplace"
  | "social"
  | "unrelated"
  | "needs_review"
  | "blocked";

export function classifyHost(hostname: string): DomainClass | null {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (SOCIAL.some((s) => h.includes(s))) return "social";
  if (MARKETPLACE.some((s) => h.includes(s))) return "marketplace";
  return null;
}

export function brandNameMatchesHost(
  brandName: string,
  hostname: string
): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
  const brand = brandName
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, "");
  const hostNorm = host.replace(/[^a-z0-9]+/g, "");
  if (!brand || !hostNorm) return false;
  if (hostNorm.includes(brand) || brand.includes(hostNorm)) return true;
  // compact compare e.g. beautyofjoseon vs beauty-of-joseon
  const brandCompact = brand.replace(/\s+/g, "");
  return (
    hostNorm.includes(brandCompact.slice(0, Math.min(8, brandCompact.length))) ||
    brandCompact.includes(hostNorm.slice(0, Math.min(8, hostNorm.length)))
  );
}

export function canAutoCrawl(classification: DomainClass, confidence: number): boolean {
  if (classification === "verified_official") return true;
  if (classification === "likely_official" && confidence >= 0.72) return true;
  return false;
}
