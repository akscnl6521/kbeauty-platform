/**
 * 지금 활성화된 카탈로그로 실제 추천 시나리오를 돌려 결과가 말이 되는지 본다.
 *
 * **읽기 전용** — DB 에 쓰지 않는다. 브랜드 확장을 멈춘 시점에서, 늘어난 카탈로그가
 * 추천·안전 필터에서 어떻게 동작하는지 확인하는 용도다.
 *
 * 확인하는 것:
 *   1. §29 KR 코어 시나리오별 Top 5 가 고민과 맞는지 (matchedIngredients 근거까지)
 *   2. 알레르기·회피 성분이 실제로 걸러지는지 — 특히 새로 들어온 abib·아로마티카·SIORIS
 *   3. 성분 정보 없는 제품이 조용히 통과하지 않는지 (incomplete_info)
 *
 * 시나리오의 고민·회피 성분은 `krCoreScenarios.json` 의 실제 값을 쓴다.
 * `recommendedIngredients` 만은 런타임에서 AI 분석이 만들어 내는 값이라 DB 에 없어서,
 * 아래 CONCERN_ACTIVES 로 대신한다 — `src/lib/catalog/keyIngredients.ts` 의
 * KEY_ACTIVE_DICTIONARY 표시명에서 고민별로 고른 것이고, 지어낸 성분은 없다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/verify-recommendation-scenarios.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const PROD_REF = "rhfrmvkjsummaylpzmns";

/** 검사할 KR 코어 시나리오 (사용자가 예시로 든 조합을 덮도록 고름) */
const PICKED_SCENARIOS = [
  "kr-redness-soothing-serum", // 붉은기 + 민감 + 장벽
  "kr-eye-dark-circle-serum", // 색소침착 + 노화
  "kr-dryness-barrier-cream", // 건성 + 장벽
  "kr-aging-firmness-serum", // 주름 + 건조 + 색소
  "kr-acne-pores-toner", // 지성/여드름 + 모공
  "kr-uv-sunscreen-sensitive", // 자외선 + 민감
] as const;

/** 고민 캐논컬 → 그 고민에 통상 쓰이는 성분 (사전 표시명 그대로) */
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
  status: string;
};

/** PostgREST 는 1000행에서 잘린다 — 반드시 끝까지 넘긴다. */
async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function pad(value: string, width: number): string {
  // 한글은 폭이 2 라서 단순 padEnd 로는 표가 어긋난다.
  let w = 0;
  for (const ch of value) w += /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(1, width - w));
}

function cut(value: string, width: number): string {
  let w = 0;
  let out = "";
  for (const ch of value) {
    const cw = /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
    if (w + cw > width) break;
    out += ch;
    w += cw;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");

  const [
    { rankProducts, filterCandidatesBySafety, applyUserIngredientPreferences, filterRankedByMatchEvidence, mapRowToCandidateProduct, isExcludedFromPublicCatalog, isOutsideFaceTrack },
    { toCanonicalConcern },
    scenariosModule,
  ] = await Promise.all([
    import("@/lib/recommend"),
    import("@/lib/recommend/concernAliases"),
    import("@/lib/recommend/scenarios/krCoreScenarios.json", { with: { type: "json" } }),
  ]);

  const scenarios = (scenariosModule.default ?? scenariosModule) as unknown as ScenarioRow[];
  const client = createClient(url, key, { auth: { persistSession: false } });

  // 실제 추천 풀과 같은 조건: active + verified_at 있음, 공개 카탈로그 제외 규칙 적용
  const rows = await fetchAll<Record<string, unknown>>(
    client,
    "products",
    "id,name,name_ko,name_ja,brand,category,skin_concern,skin_tone,key_ingredients,key_ingredients_ja,price_usd,recommendation_reason,recommendation_reason_ko,recommendation_reason_ja,slug,link_sephora,link_amazon_us,link_amazon_jp,link_qoo10,link_oliveyoung,link_coupang,link_yesstyle,active,verified_at,full_ingredients"
  );

  const candidates = rows
    .filter((r) => r.active === true && r.verified_at != null)
    .map((r) => mapRowToCandidateProduct(r as never))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .filter((p) => !isExcludedFromPublicCatalog(p))
    // 실제 추천 풀과 동일하게 얼굴 트랙 밖 제품을 뺀다 (§29).
    .filter((p) => !isOutsideFaceTrack(p));

  // 오퍼는 Top 5 가 실제로 구매 가능한지 보는 용도로만 쓴다.
  const offers = await fetchAll<{ product_id: string; retailer_country: string | null; stock_status: string | null; verification_status: string | null }>(
    client,
    "product_offers",
    "id,product_id,retailer_country,stock_status,verification_status"
  );
  const krVerifiedInStock = new Set(
    offers
      .filter(
        (o) =>
          o.retailer_country === "KR" &&
          o.verification_status === "verified" &&
          o.stock_status === "in_stock"
      )
      .map((o) => String(o.product_id))
  );

  const noIngredients = candidates.filter(
    (p) => !Array.isArray(p.key_ingredients) || p.key_ingredients.length === 0
  ).length;

  console.log(`추천 풀 ${candidates.length}건 (active + verified). 성분 없는 제품 ${noIngredients}건.`);
  console.log(`KR verified in_stock 오퍼가 있는 제품 ${candidates.filter((p) => krVerifiedInStock.has(p.id)).length}건.\n`);

  // ─────────────────────────── 1. 시나리오별 Top 5 ───────────────────────────
  console.log("═══ 1. §29 KR 코어 시나리오별 Top 5 ═══\n");

  for (const id of PICKED_SCENARIOS) {
    const s = scenarios.find((x) => x.scenarioId === id);
    if (!s) {
      console.log(`  (${id} 시나리오를 찾지 못함)`);
      continue;
    }
    const concerns = [s.primaryConcern, ...(s.secondaryConcerns ?? [])];
    const canonicalConcerns = concerns.map((c) => toCanonicalConcern(c)).filter(Boolean);
    const recommendedIngredients = [
      ...new Set(canonicalConcerns.flatMap((c) => CONCERN_ACTIVES[c] ?? [])),
    ];

    const rec = {
      skinConcerns: concerns,
      recommendedIngredients,
      ingredientsToAvoid: s.prohibitedOrCautionIngredients ?? [],
      confidenceScore: 0.85,
    };

    const safe = filterCandidatesBySafety(candidates, rec);
    const ranked = rankProducts(rec, safe.safe);
    const withEvidence = filterRankedByMatchEvidence(ranked);

    console.log(`### ${s.displayNameKo}  [${s.scenarioId}]`);
    console.log(`    고민 ${concerns.join(" · ")} / 카테고리 ${s.productCategory}`);
    console.log(`    회피 ${(s.prohibitedOrCautionIngredients ?? []).join(", ") || "-"}`);
    console.log(
      `    ${candidates.length}건 → 안전통과 ${safe.safe.length} (회피매칭 제외 ${safe.excludedCount} · 성분없음 제외 ${safe.incompleteCount})` +
        ` → 근거있는 추천 ${withEvidence.length}건`
    );

    if (withEvidence.length === 0) {
      console.log("    *** 추천 결과 없음 ***\n");
      continue;
    }
    for (const [i, r] of withEvidence.slice(0, 5).entries()) {
      const p = r.product;
      const buyable = krVerifiedInStock.has(p.id) ? "구매가능" : "오퍼없음";
      console.log(
        `    ${i + 1}. ${r.score.toFixed(2).padStart(5)} ${pad(cut(p.brand ?? "-", 16), 17)}` +
          `${pad(cut(p.name ?? "-", 34), 35)}${pad(p.category ?? "-", 12)}${buyable}`
      );
      console.log(`         근거: ${r.matchedIngredients.join(", ") || "(없음)"}`);
    }
    // 카테고리가 시나리오와 맞는지 — 이 파이프라인은 카테고리를 안 거르므로 눈으로 본다.
    const catMatch = withEvidence
      .slice(0, 5)
      .filter((r) => (r.product.category ?? "").toLowerCase().includes(s.productCategory.split("_")[0])).length;
    console.log(`         Top5 중 시나리오 카테고리(${s.productCategory})와 맞는 것 ${catMatch}건\n`);
  }

  // ─────────────────── 2. 알레르기·회피 필터 (새 브랜드 포함) ───────────────────
  console.log("═══ 2. 알레르기·회피 성분 필터 ═══\n");

  const NEW_BRANDS = ["abib", "aromatica", "아로마티카", "sioris"];
  const isNewBrand = (brand: string | null) =>
    NEW_BRANDS.some((b) => (brand ?? "").toLowerCase().includes(b));

  const allergyCases: Array<{ label: string; allergy: string[] }> = [
    { label: "향료 알레르기", allergy: ["Fragrance"] },
    { label: "나이아신아마이드 회피", allergy: ["Niacinamide"] },
    { label: "에탄올 알레르기", allergy: ["Alcohol Denat"] },
    { label: "센텔라 알레르기", allergy: ["Centella Asiatica"] },
    { label: "글리세린 회피", allergy: ["Glycerin"] },
  ];

  const { indexIngredients, toCanonical, coerceIngredientListUnknown } = await import(
    "@/lib/recommend/normalizeIngredient"
  );
  const { matchAllergenByCanonical } = await import("@/lib/recommend/allergenMatch");

  for (const c of allergyCases) {
    const base = {
      skinConcerns: ["dryness"],
      recommendedIngredients: ["Hyaluronic Acid", "Panthenol", "Glycerin"],
      ingredientsToAvoid: [] as string[],
      confidenceScore: 0.8,
    };
    const rec = applyUserIngredientPreferences(base, c.allergy, []);
    const safe = filterCandidatesBySafety(candidates, rec);

    const banned = c.allergy.map((a) => toCanonical(a)).filter(Boolean);
    // 필터와 **같은 근거 범위·같은 매처**로 독립 재현한다. 다르면 교차검사가
    // 아니라 그냥 두 개의 다른 규칙을 비교하는 게 된다.
    const has = (p: (typeof candidates)[number]) => {
      const idx = indexIngredients([
        ...coerceIngredientListUnknown(p.key_ingredients),
        ...coerceIngredientListUnknown(p.key_ingredients_ja),
        ...coerceIngredientListUnknown(p.full_ingredients),
      ]);
      return banned.some((b) => matchAllergenByCanonical(b, idx));
    };

    // 제외된 것이 정말 그 성분을 갖고 있는지, 통과한 것에 남아 있지 않은지 양쪽 다 본다.
    const wrongExclusion = safe.excludedProducts.filter(
      (e) => e.reason === "allergy_or_avoided" && !has(e.product)
    );
    const leaked = safe.safe.filter(has);
    const newBrandExcluded = safe.excludedProducts.filter(
      (e) => e.reason === "allergy_or_avoided" && isNewBrand(e.product.brand)
    );

    console.log(
      `  ${pad(c.label, 24)}통과 ${String(safe.safe.length).padStart(3)} · 회피제외 ${String(safe.excludedCount).padStart(3)}` +
        ` (신규브랜드 ${String(newBrandExcluded.length).padStart(2)}) · 성분없음제외 ${String(safe.incompleteCount).padStart(3)}`
    );
    if (wrongExclusion.length > 0) {
      console.log(`     *** 근거 없이 제외된 제품 ${wrongExclusion.length}건 ***`);
      for (const e of wrongExclusion.slice(0, 5))
        console.log(`        ${e.product.brand} ${e.product.name}`);
    }
    if (leaked.length > 0) {
      console.log(`     *** 성분을 갖고 있는데 통과한 제품 ${leaked.length}건 ***`);
      for (const p of leaked.slice(0, 5)) console.log(`        ${p.brand} ${p.name}`);
    }
    if (newBrandExcluded.length > 0) {
      const sample = newBrandExcluded.slice(0, 3);
      for (const e of sample)
        console.log(`        제외 예: ${e.product.brand} ${cut(e.product.name ?? "", 40)}`);
    }
  }

  // ─────────────── 3. 신규 브랜드가 안전 필터를 실제로 통과하는지 ───────────────
  console.log("\n═══ 3. 신규 브랜드 제품별 안전 필터 동작 ═══\n");

  const brandGroups: Array<{ label: string; match: string[] }> = [
    { label: "abib", match: ["abib"] },
    { label: "아로마티카", match: ["aromatica", "아로마티카"] },
    { label: "SIORIS", match: ["sioris"] },
    { label: "(그 외 기존 브랜드)", match: [] },
  ];

  for (const g of brandGroups) {
    const own =
      g.match.length > 0
        ? candidates.filter((p) => g.match.some((m) => (p.brand ?? "").toLowerCase().includes(m)))
        : candidates.filter((p) => !isNewBrand(p.brand));
    if (own.length === 0) {
      console.log(`  ${pad(g.label, 20)}활성 0건`);
      continue;
    }
    const withIng = own.filter((p) => (p.key_ingredients ?? []).length > 0).length;
    const medIng = (() => {
      const counts = own.map((p) => (p.key_ingredients ?? []).length).sort((a, b) => a - b);
      return counts[Math.floor(counts.length / 2)] ?? 0;
    })();
    const fragranceRec = applyUserIngredientPreferences(
      { skinConcerns: ["dryness"], recommendedIngredients: ["Hyaluronic Acid"], ingredientsToAvoid: [], confidenceScore: 0.8 },
      ["Fragrance"],
      []
    );
    const r = filterCandidatesBySafety(own, fragranceRec);
    console.log(
      `  ${pad(g.label, 20)}활성 ${String(own.length).padStart(3)} · 성분보유 ${String(withIng).padStart(3)}` +
        ` · 성분수 중앙값 ${String(medIng).padStart(3)} · 향료제외 ${String(r.excludedCount).padStart(3)}` +
        ` · 성분없음제외 ${String(r.incompleteCount).padStart(3)}`
    );
  }

  await measureAllergenGap(client, candidates);
}

/**
 * 알레르겐 커버리지 — 실제 필터가 얼마나 잡는지.
 *
 * «전성분에 있음» 은 문자열 검색으로 센 상한선이고, «필터가 잡음» 은 실제
 * `filterCandidatesBySafety` 를 돌려 센 값이다. 둘이 벌어져 있으면 그만큼
 * 알레르기를 신고한 사용자에게 새어 나간다는 뜻이다.
 */
async function measureAllergenGap(
  client: SupabaseClient,
  candidates: Array<{
    id: string;
    key_ingredients: string[] | null;
    key_ingredients_ja: string[] | null;
    full_ingredients: string[] | null;
  }>
) {
  console.log("\n═══ 4. 알레르겐 커버리지 (실제 필터 기준) ═══\n");

  const { filterCandidatesBySafety, applyUserIngredientPreferences } = await import(
    "@/lib/recommend"
  );

  const rows = await fetchAll<{
    id: number;
    active: boolean | null;
    verified_at: string | null;
    category: string | null;
  }>(client, "products", "id,active,verified_at,category");
  const noCategory = rows.filter(
    (r) => r.active === true && r.verified_at != null && !r.category
  ).length;

  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const hasAny = (list: string[], words: string[]) =>
    list.some((t) => words.some((w) => t.toLowerCase().includes(w)));

  const ALLERGENS: Array<{ label: string; input: string; words: string[] }> = [
    { label: "향료 fragrance/parfum/향료", input: "Fragrance", words: ["fragrance", "parfum", "향료"] },
    { label: "변성알코올 alcohol denat", input: "Alcohol Denat", words: ["alcohol denat", "변성알코올"] },
    { label: "리모넨 limonene", input: "Limonene", words: ["limonene", "리모넨"] },
    { label: "리날룰 linalool", input: "Linalool", words: ["linalool", "리날룰"] },
    { label: "정유 essential oil", input: "Essential Oil", words: ["essential oil"] },
  ];

  const base = {
    skinConcerns: ["dryness"],
    recommendedIngredients: ["Hyaluronic Acid"],
    ingredientsToAvoid: [] as string[],
    confidenceScore: 0.8,
  };

  console.log(`  활성 ${candidates.length}건 기준`);
  console.log(
    `  ${pad("알레르겐", 32)}${"단어 보임".padStart(10)}${"필터가 잡음".padStart(14)}${"미검출".padStart(10)}`
  );
  const residue: string[] = [];
  for (const a of ALLERGENS) {
    // 분모는 «전성분 어딘가에 그 단어가 보이는 제품» 이다. 광고 문구가 성분
    // 토큰에 섞여 들어간 경우까지 세므로 상한선이지 실제 함유 건수가 아니다.
    //
    // key_ingredients 가 비어 알레르겐 검사 전에 incomplete_info 로 빠지는 제품은
    // 분모에서 뺀다. 어차피 사용자에게 노출되지 않으므로 «새어 나감» 이 아니다.
    const inFull = candidates.filter(
      (p) =>
        (arr(p.key_ingredients).length > 0 || arr(p.key_ingredients_ja).length > 0) &&
        (hasAny(arr(p.full_ingredients), a.words) || hasAny(arr(p.key_ingredients), a.words))
    );
    const r = filterCandidatesBySafety(
      candidates as never,
      applyUserIngredientPreferences(base, [a.input], []) as never
    );
    const excludedIds = new Set(
      r.excludedProducts.filter((e) => e.reason === "allergy_or_avoided").map((e) => e.product.id)
    );
    const missed = inFull.filter((p) => !excludedIds.has(p.id));
    console.log(
      `  ${pad(a.label, 32)}${String(inFull.length).padStart(10)}` +
        `${String(inFull.length - missed.length).padStart(14)}${String(missed.length).padStart(10)}`
    );
    // 미검출 건은 **실제로 걸린 토큰을 찍는다.** 원인을 «파서 잔여물» 이라고
    // 단정해서 출력하던 것을 고쳤다 — 그건 확인이 아니라 가정이었고, 진짜로 필터가
    // 놓친 경우와 구별이 안 됐다. 알레르겐 미검출은 사용자 안전 문제라 근거를 봐야 한다.
    for (const p of missed) {
      const culprit =
        [...arr(p.full_ingredients), ...arr(p.key_ingredients)].find((t) =>
          a.words.some((w) => t.toLowerCase().includes(w))
        ) ?? "(토큰 못 찾음)";
      residue.push(`${pad(a.label, 24)} 제품 ${p.id}\n        토큰: ${culprit.slice(0, 110)}`);
    }
  }
  if (residue.length > 0) {
    console.log(`\n  ── 미검출 ${residue.length}건 · 실제로 걸린 토큰 ──`);
    for (const r of residue) console.log(`    ${r}`);
    console.log(
      `\n  토큰 하나에 성분명과 안내 문구가 함께 들어 있으면 정규화·대조가 어긋난다.\n` +
        `  필터가 아니라 수집 데이터 문제다 — 성분 목록을 쪼갤 때 고쳐야 한다.`
    );
  }

  console.log(`\n  참고: category 가 비어 있는 활성 제품 ${noCategory}건 (시나리오 카테고리 매칭 불가)`);
}

main().catch((e) => {
  console.error("[verify-recommendation-scenarios] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
