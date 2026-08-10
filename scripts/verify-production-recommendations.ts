/**
 * **Production 실데이터로 사용자가 실제 받을 추천**을 검증한다. 읽기 전용.
 *
 * ## 왜 따로 만드나
 *
 * `verify-recommendation-scenarios` 는 Staging 을 본다(그리고 Production ref 를 만나면
 * 일부러 멈춘다 — 그 가드는 그대로 둔다). Staging 은 활성 106건, Production 은 17건이라
 * **결과가 전혀 다르다.** 지금까지 «시나리오 통과» 라고 본 것은 전부 Staging 기준이었다.
 * 사용자가 실제로 무엇을 받는지는 Production 으로 봐야 안다.
 *
 * ## 무엇을 보는가
 *
 *   1. §29 KR 코어 시나리오 **30개 전부** — 6개만 보면 못 채우는 시나리오를 놓친다
 *   2. `finalRecommendationMin: 3` 을 못 채우는 시나리오 — 사용자에게 빈 화면이 되는 곳
 *   3. 브랜드 상한 적용 후의 결과 — 한 브랜드가 독차지하지 않는지
 *   4. 나라별 구매 가능 여부 — 지금 라이브의 «구매 링크가 안 뜬다» 가 어디서 오는지
 *
 * **읽기 전용.** DB 에 쓰지 않는다. Production SELECT 는 상시 승인 범위다.
 *
 * 실행: npm run check:production-recommendations
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** 고민 캐논컬 → 그 고민에 통상 쓰이는 성분. Staging 검증기와 같은 표를 쓴다. */
const CONCERN_ACTIVES: Record<string, string[]> = {
  redness: ["Centella Asiatica", "Madecassoside", "Panthenol", "Allantoin"],
  sensitivity: ["Panthenol", "Allantoin", "Beta-Glucan", "Centella Asiatica"],
  barrier: ["Ceramide NP", "Cholesterol", "Squalane", "Panthenol"],
  dryness: ["Hyaluronic Acid", "Glycerin", "Squalane", "Panthenol"],
  antiaging: ["Adenosine", "Peptide", "Retinol", "Tocopherol"],
  pigmentation: ["Niacinamide", "Tranexamic Acid", "Ascorbic Acid", "Azelaic Acid"],
  acne: ["Salicylic Acid", "Niacinamide", "Azelaic Acid", "Zinc PCA"],
  pores: ["Niacinamide", "Salicylic Acid", "Zinc PCA"],
  uv: ["Zinc Oxide", "Tocopherol", "Niacinamide"],
};

type ScenarioRow = {
  scenarioId: string;
  displayNameKo: string;
  primaryConcern: string;
  secondaryConcerns?: string[];
  productCategory: string;
  prohibitedOrCautionIngredients?: string[];
  finalRecommendationMin?: number;
  finalRecommendationMax?: number;
  status?: string;
};

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

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
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
  // 이 스크립트는 **Production 을 보라고 만든 것**이라, 다른 곳을 보면 멈춘다.
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: Production ref 가 아니다.");
    process.exitCode = 1;
    return;
  }

  const [
    {
      rankProducts,
      filterCandidatesBySafety,
      filterRankedByMatchEvidence,
      mapRowToCandidateProduct,
      isExcludedFromPublicCatalog,
      isOutsideFaceTrack,
      applyBrandDiversity,
      normalizeProductOffer,
      isOfferPurchasableForCta,
    },
    { toCanonicalConcern },
    scenariosModule,
  ] = await Promise.all([
    import("@/lib/recommend"),
    import("@/lib/recommend/concernAliases"),
    import("@/lib/recommend/scenarios/krCoreScenarios.json", { with: { type: "json" } }),
  ]);

  const scenarios = ((scenariosModule as { default?: unknown }).default ??
    scenariosModule) as unknown as ScenarioRow[];
  const client = createClient(url, key, { auth: { persistSession: false } });

  const rows = await fetchAll<Record<string, unknown>>(
    client,
    "products",
    "id,name,name_ko,name_ja,brand,category,skin_concern,skin_tone,key_ingredients,key_ingredients_ja," +
      "price_usd,recommendation_reason,recommendation_reason_ko,recommendation_reason_ja,slug," +
      "link_sephora,link_amazon_us,link_amazon_jp,link_qoo10,link_oliveyoung,link_coupang,link_yesstyle," +
      "active,verified_at,full_ingredients"
  );

  const candidates = rows
    .filter((r) => r.active === true && r.verified_at != null)
    .map((r) => mapRowToCandidateProduct(r as never))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .filter((p) => !isExcludedFromPublicCatalog(p))
    .filter((p) => !isOutsideFaceTrack(p));

  const offers = await fetchAll<Record<string, unknown>>(
    client,
    "product_offers",
    "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency," +
      "stock_status,verification_status,is_official,verified_at,last_checked_at,rating,review_count,source,active"
  );

  /**
   * «구매 가능» 은 **실제 CTA 관문**으로 판정한다.
   *
   * 처음에는 `retailer_country` · `verification_status` · `stock_status` 세 가지만 봤다.
   * 그건 진짜 관문(`isOfferPurchasableForCta`)보다 느슨해서, 통화 불일치·
   * `ships_to_countries` 누락 같은 탈락 사유를 못 본다. 2026-08-04 «구매하기가 안
   * 뜬다» 를 조사하면서 드러났다 — 검증기가 화면보다 후하면 «검증 통과» 가 거짓말이 된다.
   */
  const buyableBy = (country: "KR" | "US") =>
    new Set(
      offers
        .map((o) => ({ pid: String(o.product_id), offer: normalizeProductOffer(o) }))
        .filter((x) => x.offer != null && isOfferPurchasableForCta(x.offer, country))
        .map((x) => x.pid)
    );
  const krBuyable = buyableBy("KR");
  const usBuyable = buyableBy("US");

  console.log(`추천 풀 ${candidates.length}건 (active + verified_at + 공개 필터 적용)`);
  console.log(`  국내 구매 가능 ${candidates.filter((p) => krBuyable.has(p.id)).length}건`);
  console.log(`  미국 구매 가능 ${candidates.filter((p) => usBuyable.has(p.id)).length}건`);
  const brandCount = new Map<string, number>();
  for (const p of candidates) brandCount.set(String(p.brand ?? "-"), (brandCount.get(String(p.brand ?? "-")) ?? 0) + 1);
  console.log(
    `  브랜드 구성: ${[...brandCount.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(" · ")}\n`
  );

  const active = scenarios.filter((s) => s.status !== "draft");
  console.log(`═══ §29 KR 코어 시나리오 ${active.length}개 — 실제 결과 ═══\n`);
  console.log(`${pad("시나리오", 30)}${"안전통과".padStart(8)}${"근거있음".padStart(8)}${"최종".padStart(6)}  ${"국내구매".padStart(8)}  브랜드`);

  const results: Array<{
    scenarioId: string;
    name: string;
    safe: number;
    withEvidence: number;
    finalCount: number;
    min: number;
    krBuyableCount: number;
    /** Top N 중 화면에 «매칭된 성분 없음» 이 뜨는 제품 수 */
    noMatchCount: number;
    /** Top N 안에서 전성분이 똑같은 제품이 겹친 수 */
    sameFormulaPairs: number;
    brands: string[];
    short: boolean;
  }> = [];

  for (const s of active) {
    const concerns = [s.primaryConcern, ...(s.secondaryConcerns ?? [])];
    const canonical = concerns.map((c) => toCanonicalConcern(c)).filter(Boolean);
    const recommendedIngredients = [...new Set(canonical.flatMap((c) => CONCERN_ACTIVES[c] ?? []))];
    const rec = {
      skinConcerns: concerns,
      recommendedIngredients,
      ingredientsToAvoid: s.prohibitedOrCautionIngredients ?? [],
      confidenceScore: 0.85,
    };

    const safe = filterCandidatesBySafety(candidates, rec);
    const ranked = rankProducts(rec, safe.safe);
    const withEvidence = filterRankedByMatchEvidence(ranked);
    const max = s.finalRecommendationMax ?? 5;
    const min = s.finalRecommendationMin ?? 3;
    // 실제 경로와 같이 브랜드 상한을 적용한 뒤의 결과를 본다.
    const final = applyBrandDiversity(withEvidence, max);

    const brands = final.map((r) => String(r.product.brand ?? "-"));
    const krCount = final.filter((r) => krBuyable.has(r.product.id)).length;
    // **화면에 «매칭된 성분 없음» 이 뜨는 제품 수.**
    // 카드는 DB 의 추천 이유가 아니라 «매칭 성분» 을 보여준다. 매칭이 비면
    // 사용자는 «왜 이게 추천됐는지» 를 알 수 없는 카드를 본다.
    const noMatch = final.filter((r) => (r.matchedIngredients?.length ?? 0) === 0).length;

    // **같은 처방이 한 화면에 두 번 뜨는가.**
    // 용량만 다른 같은 제형(`진설크림` / `진설크림 리필`)은 카탈로그에는 둘 다
    // 맞지만, Top 5 에 나란히 뜨면 사용자가 고를 것이 하나 줄어든다.
    const formulaKeys = final.map((r) => {
      const fi = (r.product as { full_ingredients?: unknown }).full_ingredients;
      const list = Array.isArray(fi) ? fi : [];
      return list.length >= 5
        ? `${String(r.product.brand ?? "").toLowerCase()}||${list.map((x) => String(x).replace(/\s+/g, "").toLowerCase()).join(",")}`
        : `unique-${r.product.id}`;
    });
    const sameFormulaPairs = formulaKeys.length - new Set(formulaKeys).size;
    const short = final.length < min;

    results.push({
      scenarioId: s.scenarioId,
      name: s.displayNameKo,
      safe: safe.safe.length,
      withEvidence: withEvidence.length,
      finalCount: final.length,
      min,
      krBuyableCount: krCount,
      noMatchCount: noMatch,
      sameFormulaPairs,
      brands,
      short,
    });

    console.log(
      `${pad(s.displayNameKo, 30)}${String(safe.safe.length).padStart(8)}${String(withEvidence.length).padStart(8)}` +
        `${String(final.length).padStart(6)}${short ? " !" : "  "}${String(krCount).padStart(7)}  ` +
        `${[...new Set(brands)].join(", ") || "-"}`
    );
  }

  const shortfall = results.filter((r) => r.short);
  const withNoMatch = results.filter((r) => r.noMatchCount > 0);
  console.log(
    `  화면에 «매칭된 성분 없음» 이 뜨는 제품이 있는 시나리오 ` +
      `**${withNoMatch.length}개** (총 ${results.reduce((a, r) => a + r.noMatchCount, 0)}건)`
  );
  for (const r of withNoMatch.slice(0, 10))
    console.log(`    ! ${pad(r.name, 30)} ${r.noMatchCount}/${r.finalCount}건`);

  const dupFormula = results.filter((r) => r.sameFormulaPairs > 0);
  console.log(
    `  **같은 처방이 한 화면에 두 번 뜨는 시나리오 ${dupFormula.length}개** ` +
      `(총 ${results.reduce((a, r) => a + r.sameFormulaPairs, 0)}쌍)`
  );
  for (const r of dupFormula.slice(0, 10)) console.log(`    ! ${pad(r.name, 30)} ${r.sameFormulaPairs}쌍`);

  const noKr = results.filter((r) => r.finalCount > 0 && r.krBuyableCount === 0);

  console.log(`\n── 요약 ──`);
  console.log(`  시나리오 ${results.length}개 중 최소 개수(3)를 못 채우는 것 **${shortfall.length}개**`);
  if (shortfall.length > 0)
    for (const r of shortfall)
      console.log(`    ! ${pad(r.name, 30)} 최종 ${r.finalCount}건 (안전통과 ${r.safe} → 근거있음 ${r.withEvidence})`);

  console.log(`  결과는 있으나 **국내 구매처가 하나도 없는** 시나리오 ${noKr.length}개`);
  for (const r of noKr.slice(0, 10)) console.log(`    · ${r.name}`);

  const overCap = results.filter((r) => {
    const c = new Map<string, number>();
    for (const b of r.brands) c.set(b.toLowerCase().trim(), (c.get(b.toLowerCase().trim()) ?? 0) + 1);
    return [...c.values()].some((n) => n > 2);
  });
  console.log(`  브랜드 상한(2)을 넘는 시나리오 ${overCap.length}개 ${overCap.length === 0 ? "(정상)" : "← 확인 필요"}`);

  mkdirSync("artifacts/production-audit", { recursive: true });
  const path = "artifacts/production-audit/production-recommendations.json";
  writeFileSync(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        poolSize: candidates.length,
        krBuyable: candidates.filter((p) => krBuyable.has(p.id)).length,
        usBuyable: candidates.filter((p) => usBuyable.has(p.id)).length,
        scenarios: results,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\n결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[verify-production-recommendations] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
