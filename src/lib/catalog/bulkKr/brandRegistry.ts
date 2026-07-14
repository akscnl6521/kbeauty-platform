/**
 * KR official brand allowlist — domains for source policy.
 * Live crawl remains OFF (allowsAutomation: false) until terms/robots review.
 */

export type KrBrandSeedEntry = {
  brandId: string;
  canonicalBrand: string;
  officialDomains: string[];
  country: string;
  language: string;
  allowsAutomation: boolean;
  productSitemapUrl?: string;
  collectionUrls?: string[];
  parserType: string;
  rateLimitPerMinute: number;
  lastTermsReviewAt: string | null;
};

export const KR_BRAND_SEED_REGISTRY: KrBrandSeedEntry[] = [
  { brandId: "cosrx", canonicalBrand: "COSRX", officialDomains: ["cosrx.co.kr", "www.cosrx.co.kr", "cosrx.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "beauty-of-joseon", canonicalBrand: "Beauty of Joseon", officialDomains: ["beautyofjoseon.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "anua", canonicalBrand: "Anua", officialDomains: ["anua.shop", "anuabeauty.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "round-lab", canonicalBrand: "ROUND LAB", officialDomains: ["roundlab.co.kr", "roundlab.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "isntree", canonicalBrand: "Isntree", officialDomains: ["isntree.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "some-by-mi", canonicalBrand: "SOME BY MI", officialDomains: ["somebymi.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "skin1004", canonicalBrand: "SKIN1004", officialDomains: ["skin1004.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "torriden", canonicalBrand: "Torriden", officialDomains: ["torriden.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "numbuzin", canonicalBrand: "numbuzin", officialDomains: ["numbuzin.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "medicube", canonicalBrand: "medicube", officialDomains: ["medicube.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "axis-y", canonicalBrand: "AXIS-Y", officialDomains: ["axis-y.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "purito", canonicalBrand: "PURITO", officialDomains: ["purito.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "klairs", canonicalBrand: "Klairs", officialDomains: ["klairs.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "heimish", canonicalBrand: "heimish", officialDomains: ["heimish.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "dr-jart", canonicalBrand: "Dr.Jart+", officialDomains: ["drjart.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "laneige", canonicalBrand: "LANEIGE", officialDomains: ["laneige.com", "laneige.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "innisfree", canonicalBrand: "innisfree", officialDomains: ["innisfree.com", "innisfree.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "missha", canonicalBrand: "MISSHA", officialDomains: ["missha.com", "missha.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "etude", canonicalBrand: "ETUDE", officialDomains: ["etude.com", "etude.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "banila-co", canonicalBrand: "banila co.", officialDomains: ["banilaco.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "goodal", canonicalBrand: "goodal", officialDomains: ["goodal.co.kr", "goodal.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "tocobo", canonicalBrand: "TOCOBO", officialDomains: ["tocobo.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "mixsoon", canonicalBrand: "mixsoon", officialDomains: ["mixsoon.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "haruharu", canonicalBrand: "Haruharu Wonder", officialDomains: ["haruharuwonder.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "romand", canonicalBrand: "rom&nd", officialDomains: ["romand.com", "romand.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "peripera", canonicalBrand: "PERIPERA", officialDomains: ["peripera.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "clio", canonicalBrand: "CLIO", officialDomains: ["cliocosmetic.com", "clio.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "3ce", canonicalBrand: "3CE", officialDomains: ["3ce.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "espoir", canonicalBrand: "espoir", officialDomains: ["espoir.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "amortepacific", canonicalBrand: "AMOREPACIFIC", officialDomains: ["amorepacific.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "sulwhasoo", canonicalBrand: "Sulwhasoo", officialDomains: ["sulwhasoo.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "hera", canonicalBrand: "HERA", officialDomains: ["hera.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "lador", canonicalBrand: "Lador", officialDomains: ["lador.co.kr", "lador.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "ryses", canonicalBrand: "RYSES", officialDomains: ["ryses.co.kr"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
  { brandId: "mise-en-scene", canonicalBrand: "mise en scène", officialDomains: ["miseenscene.com"], country: "KR", language: "ko", allowsAutomation: false, parserType: "brand_official", rateLimitPerMinute: 6, lastTermsReviewAt: null },
];
