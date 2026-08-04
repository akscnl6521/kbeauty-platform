/**
 * **새로 분석했을 때 나올 Top 5 에 «구매하기» 가 붙는지** 실제 파이프라인으로 확인한다.
 *
 * 결과 화면은 브라우저 localStorage 에서 읽으므로 curl 로는 확인할 수 없다. 대신
 * 카드가 CTA 를 띄울 때 쓰는 것과 **똑같은 함수**(`resolveProductOffers` →
 * `isOfferPurchasableForCta`)를 Production 데이터에 태워, 캐시가 폐기되고 다시
 * 계산되면 무엇이 나오는지 본다.
 *
 * 파이프라인 순서는 `persistTopRankedProducts` 와 같게 맞춘다:
 *   후보 조회(오퍼 포함) → 공개 카탈로그 필터 → 국가별 오퍼 자격 → 안전 필터
 *   → 랭킹 → 근거 필터 → 브랜드 상한 → Top N
 *
 * **읽기 전용.** DB 에 쓰지 않는다.
 *
 * 실행: npm run check:fresh-recommendation
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** 대표 시나리오 — §29 KR 코어에서 성격이 다른 것들로 고른다. */
const CASES: Array<{ label: string; concerns: string[]; actives: string[]; avoid: string[] }> = [
  { label: "건성 + 장벽", concerns: ["dryness", "barrier"], actives: ["Hyaluronic Acid", "Ceramide NP", "Panthenol", "Squalane"], avoid: [] },
  { label: "붉은기 + 민감", concerns: ["redness", "sensitivity"], actives: ["Centella Asiatica", "Panthenol", "Allantoin"], avoid: ["Fragrance", "Alcohol Denat"] },
  { label: "지성 + 모공", concerns: ["acne", "pores"], actives: ["Niacinamide", "Salicylic Acid", "Zinc PCA"], avoid: [] },
  { label: "색소침착", concerns: ["pigmentation"], actives: ["Niacinamide", "Ascorbic Acid", "Tranexamic Acid"], avoid: [] },
  { label: "향료 알레르기 + 건성", concerns: ["dryness"], actives: ["Hyaluronic Acid", "Glycerin", "Panthenol"], avoid: ["Fragrance"] },
];

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: Production ref 가 아니다.");
    process.exitCode = 1;
    return;
  }

  const {
    rankProducts,
    filterCandidatesBySafety,
    filterRankedByMatchEvidence,
    filterCandidatesByOfferAvailability,
    mapRowToCandidateProduct,
    isExcludedFromPublicCatalog,
    isOutsideFaceTrack,
    applyBrandDiversity,
    resolveProductOffers,
    isOfferPurchasableForCta,
    normalizeProductOffer,
  } = await import("@/lib/recommend");

  const client = createClient(url, key, { auth: { persistSession: false } });

  const rows = await fetchAll<Record<string, unknown>>(
    client,
    "products",
    "id,name,name_ko,name_ja,brand,category,skin_concern,skin_tone,key_ingredients,key_ingredients_ja," +
      "price_usd,recommendation_reason,recommendation_reason_ko,recommendation_reason_ja,slug," +
      "link_sephora,link_amazon_us,link_amazon_jp,link_qoo10,link_oliveyoung,link_coupang,link_yesstyle," +
      "active,verified_at,full_ingredients"
  );
  const offerRows = await fetchAll<Record<string, unknown>>(
    client,
    "product_offers",
    "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency," +
      "stock_status,verification_status,is_official,verified_at,last_checked_at,rating,review_count,source,active"
  );

  // 오퍼를 제품에 붙인다 — `fetchCandidateProducts({ includeOffers: true })` 와 같은 모양.
  const offersByProduct = new Map<string, unknown[]>();
  for (const o of offerRows) {
    const pid = String(o.product_id);
    offersByProduct.set(pid, [...(offersByProduct.get(pid) ?? []), o]);
  }

  const candidates = rows
    .filter((r) => r.active === true && r.verified_at != null)
    .map((r) => {
      const p = mapRowToCandidateProduct(r as never);
      if (!p) return null;
      const offers = (offersByProduct.get(String(r.id)) ?? [])
        .map((o) => normalizeProductOffer(o))
        .filter(Boolean);
      return offers.length > 0 ? ({ ...p, offers } as typeof p) : p;
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .filter((p) => !isExcludedFromPublicCatalog(p))
    .filter((p) => !isOutsideFaceTrack(p));

  for (const country of ["KR", "US"] as const) {
    console.log(`\n${"═".repeat(66)}`);
    console.log(`  배송 국가 ${country} — 새로 분석하면 나올 결과`);
    console.log("═".repeat(66));

    const { eligible: sellable, excludedCount } = filterCandidatesByOfferAvailability(
      candidates,
      country
    );

    let allHaveCta = true;
    for (const c of CASES) {
      const rec = {
        skinConcerns: c.concerns,
        recommendedIngredients: c.actives,
        ingredientsToAvoid: c.avoid,
        confidenceScore: 0.85,
      };
      const safe = filterCandidatesBySafety(sellable, rec);
      const ranked = rankProducts(rec, safe.safe);
      const withEvidence = filterRankedByMatchEvidence(ranked);
      const top = applyBrandDiversity(withEvidence, 5);

      console.log(`\n  ▶ ${c.label}  (후보 ${sellable.length} → 안전 ${safe.safe.length} → 최종 ${top.length})`);
      if (top.length === 0) {
        console.log("     *** 결과 없음 ***");
        allHaveCta = false;
        continue;
      }
      for (const [i, r] of top.entries()) {
        const offers = resolveProductOffers(r.product as never);
        const buyable = offers.filter((o) => isOfferPurchasableForCta(o, country));
        const mark = buyable.length > 0 ? "구매하기 O" : "구매하기 X";
        if (buyable.length === 0) allHaveCta = false;
        const best = buyable[0];
        const priceStr = best ? `${best.price} ${best.currency} · ${best.retailerName ?? "-"}` : "-";
        console.log(
          `     ${i + 1}. ${mark}  ${String(r.product.brand ?? "-").padEnd(17)}` +
            `${String(r.product.name ?? "-").slice(0, 32).padEnd(34)}${priceStr}`
        );
      }
    }
    console.log(
      `\n  오퍼 자격 미달로 제외된 후보 ${excludedCount}건 · ` +
        `모든 시나리오 Top 전원 구매 가능: ${allHaveCta ? "예" : "아니오"}`
    );
  }
}

main().catch((e) => {
  console.error("[simulate-fresh-recommendation] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
