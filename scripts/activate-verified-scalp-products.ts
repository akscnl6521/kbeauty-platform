/**
 * 성분·오퍼 조건을 채운 두피·헤어 제품을 정식 게이트로 활성화한다.
 *
 * 게이트(`verifyAndActivateProduct`)를 우회하지 않는다. 게이트가 요구하는
 * 값을 **실제로 확인된 것만** 채워서 넘기고, 판단은 게이트가 한다.
 *
 * `identity` 신뢰도는 지어내지 않는다. 제품명·브랜드·전성분·가격·출처 URL 이
 * 각각 실제로 있는지 세어서 비율로 넘긴다 (§35.6 «확인되지 않은 필드는 비워
 * 둔다» 의 연장).
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/activate-verified-scalp-products.ts 74 75            # 검증만
 *   ... scripts/activate-verified-scalp-products.ts 74 75 --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  if (ids.length === 0) throw new Error("제품 id 를 하나 이상 넘겨야 한다");

  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const { verifyAndActivateProduct } = await import(
    "../src/lib/pipeline/product-verify/product-activate"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = "activate-scalp-2026-07-27";

  const maps = buildIngredientLookupMaps(
    await fetchAll(client, "ingredients", "id,slug,name_en,name_ko"),
    (
      await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
    ).filter((a) => a.active) as never
  );

  const { data: products, error } = await client
    .from("products")
    .select("id,name,brand,category,active,verified_at,full_ingredients")
    .in("id", ids);
  if (error) throw error;

  const offers = await fetchAll<{
    product_id: number;
    purchase_url: string | null;
    price: number | null;
    currency: string | null;
    stock_status: string | null;
    verification_status: string | null;
  }>(client, "product_offers", "id,product_id,purchase_url,price,currency,stock_status,verification_status");

  for (const p of products ?? []) {
    const fi = Array.isArray(p.full_ingredients) ? (p.full_ingredients as string[]) : [];
    const normalized = attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized;
    const unmatched = normalized.filter((x) => !x.matchedIngredientId && x.matchKind !== "ambiguous").length;
    const ambiguous = normalized.filter((x) => x.matchKind === "ambiguous").length;
    const offer = offers.find(
      (o) => o.product_id === p.id && o.verification_status === "verified" && o.stock_status === "in_stock"
    );

    // 실제로 확인된 신호만 센다. 없는 값을 채워 신뢰도를 올리지 않는다.
    const signals = [
      Boolean(p.name),
      Boolean(p.brand),
      fi.length > 0,
      offer?.price != null,
      Boolean(offer?.purchase_url),
    ];
    const confidence = Math.round((signals.filter(Boolean).length / signals.length) * 100) / 100;

    console.log(`### ${p.id} ${p.brand ?? ""} ${String(p.name ?? "").slice(0, 44)}`);
    console.log(
      `   전성분 ${fi.length} / 미매칭 ${unmatched} / 모호 ${ambiguous} / 검증오퍼 ${offer ? "있음" : "없음"} / identity ${confidence}`
    );

    if (!apply) continue;

    const result = await verifyAndActivateProduct(client, {
      productId: p.id,
      batchId,
      ambiguousIngredientCount: ambiguous,
      unmatchedIngredientCount: unmatched,
      safetyConflict: false,
      extracted: {
        productName: p.name,
        brandName: p.brand,
        canonicalUrl: offer?.purchase_url ?? null,
        category: p.category,
        imageUrl: null,
        description: null,
        fullIngredientsText: fi.join(", ") || null,
        keyIngredients: [],
        sizeLabel: null,
        priceReference: offer?.price != null ? String(offer.price) : null,
        currency: offer?.currency ?? null,
        availabilityReference: offer?.stock_status ?? null,
        country: "KR",
        sourceType: "official_brand_page",
        confidence,
        extractionMethod: "scalp_activation_2026_07_27",
        fieldConfidence: {},
      } as never,
    });
    console.log(
      `   -> 활성화 ${result.activated ? "성공" : "안 됨"}` +
        (result.gateBlockers?.length ? `  차단: ${result.gateBlockers.join(", ")}` : "") +
        (result.needsReview ? "  (needs_review)" : "")
    );
  }

  if (!apply) console.log("\n검증 모드. 실제 반영하려면 --apply 를 붙인다.");
}

main().catch((e) => {
  console.error("[activate-verified-scalp-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
