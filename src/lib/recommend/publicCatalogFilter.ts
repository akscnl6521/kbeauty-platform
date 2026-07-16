/**
 * 공개 결과·검색용 카탈로그 노이즈 필터.
 * 테스트·probe·alias·HTTP API 검증용 제품은 사용자 화면에서 제외한다.
 */

const EXCLUDE_NAME_PATTERNS: readonly RegExp[] = [
  /\bHTTP\s*API\b/i,
  /\bAlias\s*Probe\b/i,
  /\bprobe\b/i,
  /\balias\s*select\b/i,
  /권한\s*검증/,
  /검증용/,
  /테스트\s*제품/,
  /\btest[\s_-]*only\b/i,
  /\bfixture\b/i,
  /\bstaging[\s_-]*probe\b/i,
];

const EXCLUDE_SLUG_PATTERNS: readonly RegExp[] = [
  /http-api/i,
  /alias-probe/i,
  /probe-/i,
  /test-only/i,
  /fixture/i,
];

export type PublicCatalogProductLike = {
  id?: string | number | null;
  name?: string | null;
  name_ko?: string | null;
  name_ja?: string | null;
  slug?: string | null;
  brand?: string | null;
};

function haystack(product: PublicCatalogProductLike): string {
  return [
    product.name,
    product.name_ko,
    product.name_ja,
    product.slug,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

/** 공개 결과/검색에서 제외해야 하는 검증·테스트 제품인지 */
export function isExcludedFromPublicCatalog(
  product: PublicCatalogProductLike
): boolean {
  const text = haystack(product);
  if (!text) return false;
  for (const re of EXCLUDE_NAME_PATTERNS) {
    if (re.test(text)) return true;
  }
  const slug = typeof product.slug === "string" ? product.slug : "";
  for (const re of EXCLUDE_SLUG_PATTERNS) {
    if (slug && re.test(slug)) return true;
  }
  return false;
}

export function filterPublicCatalogProducts<T extends PublicCatalogProductLike>(
  products: T[]
): T[] {
  if (!Array.isArray(products) || products.length === 0) return [];
  return products.filter((p) => !isExcludedFromPublicCatalog(p));
}

/**
 * 위험 신호(전문가 상담 우선) 시 제외할 자극·강한 활성 성분.
 * 제품명·주요 성분 라벨 기준 (진단 아님).
 */
const STIMULATING_ACTIVE_PATTERNS: readonly RegExp[] = [
  /\bretinol\b/i,
  /레티놀/,
  /\bretinal\b/i,
  /레티날/,
  /\btretinoin\b/i,
  /\baha\b/i,
  /\bbha\b/i,
  /glycolic\s*acid/i,
  /salicylic\s*acid/i,
  /betaine\s*salicylate/i,
  /ascorbic\s*acid/i,
  /vitamin\s*c\s*23/i,
  /비타민\s*c\s*23/i,
  /고함량\s*비타민/,
];

export function hasStimulatingActives(
  product: PublicCatalogProductLike & {
    key_ingredients?: string[] | string | null;
  }
): boolean {
  const parts: string[] = [
    typeof product.name === "string" ? product.name : "",
    typeof product.name_ko === "string" ? product.name_ko : "",
  ];
  const ings = product.key_ingredients;
  if (Array.isArray(ings)) {
    for (const i of ings) {
      if (typeof i === "string") parts.push(i);
    }
  } else if (typeof ings === "string") {
    parts.push(ings);
  }
  const blob = parts.join("\n");
  return STIMULATING_ACTIVE_PATTERNS.some((re) => re.test(blob));
}

export function filterOutStimulatingActives<
  T extends PublicCatalogProductLike & {
    key_ingredients?: string[] | string | null;
  },
>(products: T[]): T[] {
  if (!Array.isArray(products) || products.length === 0) return [];
  return products.filter((p) => !hasStimulatingActives(p));
}
