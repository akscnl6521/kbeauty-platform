import { supabase } from "@/lib/supabase";
import type { CandidateProduct, FetchCandidateProductsOptions } from "./types";

/**
 * Supabase select 컬럼.
 * results/page.tsx ProductRow 와 동일한 products 필드만 사용.
 * 제품 이미지 컬럼은 코드베이스에 없어 select 하지 않는다.
 */
const CANDIDATE_PRODUCT_COLUMNS = [
  "id",
  "name",
  "name_ko",
  "name_ja",
  "brand",
  "category",
  "skin_concern",
  "skin_tone",
  "key_ingredients",
  "key_ingredients_ja",
  "price_usd",
  "recommendation_reason",
  "recommendation_reason_ko",
  "recommendation_reason_ja",
  "slug",
  "link_sephora",
  "link_amazon_us",
  "link_amazon_jp",
  "link_qoo10",
  "link_oliveyoung",
  "link_coupang",
  "link_yesstyle",
].join(", ");

/** DB 행의 느슨한 형태 (null / 타입 불확실 대비) */
type ProductRowRaw = {
  id?: unknown;
  name?: unknown;
  name_ko?: unknown;
  name_ja?: unknown;
  brand?: unknown;
  category?: unknown;
  skin_concern?: unknown;
  skin_tone?: unknown;
  key_ingredients?: unknown;
  key_ingredients_ja?: unknown;
  price_usd?: unknown;
  recommendation_reason?: unknown;
  recommendation_reason_ko?: unknown;
  recommendation_reason_ja?: unknown;
  slug?: unknown;
  link_sephora?: unknown;
  link_amazon_us?: unknown;
  link_amazon_jp?: unknown;
  link_qoo10?: unknown;
  link_oliveyoung?: unknown;
  link_coupang?: unknown;
  link_yesstyle?: unknown;
};

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * key_ingredients 계열을 string[] | null 로 정규화.
 * 배열이 아니면 null (빈 배열은 [] 유지).
 */
function asIngredientArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
            .filter(Boolean);
        }
      } catch {
        // 쉼표 구분으로 폴백
      }
    }
    return trimmed
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return null;
}

/**
 * DB 한 행 → CandidateProduct.
 * id 가 없으면 null (해당 행 스킵).
 */
export function mapRowToCandidateProduct(
  row: ProductRowRaw
): CandidateProduct | null {
  const id = asNullableString(row.id);
  if (!id) return null;

  return {
    id,
    name: asNullableString(row.name),
    name_ko: asNullableString(row.name_ko),
    name_ja: asNullableString(row.name_ja),
    brand: asNullableString(row.brand),
    category: asNullableString(row.category),
    skin_concern: asNullableString(row.skin_concern),
    skin_tone: asNullableString(row.skin_tone),
    key_ingredients: asIngredientArray(row.key_ingredients),
    key_ingredients_ja: asIngredientArray(row.key_ingredients_ja),
    price_usd: asNullableNumber(row.price_usd),
    recommendation_reason: asNullableString(row.recommendation_reason),
    recommendation_reason_ko: asNullableString(row.recommendation_reason_ko),
    recommendation_reason_ja: asNullableString(row.recommendation_reason_ja),
    slug: asNullableString(row.slug),
    link_sephora: asNullableString(row.link_sephora),
    link_amazon_us: asNullableString(row.link_amazon_us),
    link_amazon_jp: asNullableString(row.link_amazon_jp),
    link_qoo10: asNullableString(row.link_qoo10),
    link_oliveyoung: asNullableString(row.link_oliveyoung),
    link_coupang: asNullableString(row.link_coupang),
    link_yesstyle: asNullableString(row.link_yesstyle),
  };
}

/**
 * Phase 3A — 추천 엔진용 후보 제품 로더.
 *
 * 기존 `src/lib/supabase` 클라이언트를 재사용해 products 테이블을 조회한다.
 * - UI / AI 프롬프트 / rankProducts 와 연결하지 않음 (호출측에서 사용)
 * - DB에 is_active 컬럼이 코드·마이그레이션에 없으므로,
 *   현재는 anon SELECT 가능한 전체 행을 “활성 후보”로 취급한다.
 *
 * @returns CandidateProduct[] (RankableProduct 호환)
 * @throws Supabase 오류 시 Error
 */
export async function fetchCandidateProducts(
  options: FetchCandidateProductsOptions = {}
): Promise<CandidateProduct[]> {
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? Math.floor(options.limit)
      : 10000;

  const { data, error } = await supabase
    .from("products")
    .select(CANDIDATE_PRODUCT_COLUMNS)
    .limit(limit);

  if (error) {
    throw new Error(
      `[fetchCandidateProducts] Supabase error: ${error.message}`
    );
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  // Sprint 3 Phase 2B: 개발 전용 — 매핑 전 raw 성분 필드 형식 감사 (점수/UI 변경 없음)
  if (process.env.NODE_ENV === "development") {
    const { auditIngredientFormats, logIngredientFormatAudit } = await import(
      "./auditIngredientFormats"
    );
    const auditRows = (data as ProductRowRaw[]).map((row) => ({
      productId: asNullableString(row.id) ?? "(missing-id)",
      key_ingredients: row.key_ingredients,
      key_ingredients_ja: row.key_ingredients_ja,
    }));
    logIngredientFormatAudit(auditIngredientFormats(auditRows));
  }

  const products: CandidateProduct[] = [];
  for (const row of data as ProductRowRaw[]) {
    const mapped = mapRowToCandidateProduct(row);
    if (mapped) products.push(mapped);
  }

  // Sprint 3 Phase 3C: 개발 전용 구매 링크 커버리지
  if (process.env.NODE_ENV === "development") {
    const { logPurchaseLinkCoverage } = await import("./auditPurchaseLinks");
    logPurchaseLinkCoverage(products);
  }

  return products;
}
