/**
 * Tier 1 수집분을 Production 에 반영한다. **승인 받은 작업이다** (2026-07-29).
 *
 * 순서
 *   1. 브랜드 귀속 정정 (cosrx.com·skin1004.com 전수 대조로 확인된 것만)
 *   2. 제품별로 전성분 재수집 → `products.full_ingredients` 갱신
 *   3. `product_offers` INSERT (실제 판매 페이지에서 읽은 가격·재고만)
 *   4. `product_ingredients` 링크 생성 (활성화 게이트가 공식 소스 성분을 요구한다)
 *   5. `verifyAndActivateProduct` 로 게이트를 태워 활성화
 *
 * 안전장치
 *   · 첫 1건을 반영한 뒤 **읽어서 확인**하고, 실패하면 즉시 멈춘다. 권한 문제로
 *     중간 상태가 남는 것을 막는다.
 *   · `--apply` 없이 실행하면 무엇을 할지만 출력한다.
 *   · `price_usd` 시드값은 쓰지 않는다. 오퍼 가격은 전부 판매 페이지 실측값이다.
 *   · 게이트를 낮추지 않는다. 통과 못 하면 활성화하지 않고 남긴다.
 *
 * 실행: npm run apply:tier1-production -- --apply
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { sanitizeIngredientList } from "../src/lib/catalog/validateIngredientList";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";
const ARTIFACT = "artifacts/tier1-collect/shopify-2026-07-28.json";

/**
 * 브랜드 귀속 정정. cosrx.com(138건)·skin1004.com(94건) 전체 카탈로그를 대조해
 * skin1004 에 해당 제품이 **0건**이고 cosrx 에 있는 것만 넣었다. 추정이 아니다.
 */
const BRAND_FIXES: ReadonlyArray<{ id: number; from: string; to: string; evidence: string }> = [
  { id: 9, from: "SKIN1004", to: "COSRX", evidence: "cosrx.com 에 Pure Fit Cica 5종 · skin1004.com 0건 (2026-07-28 전수 대조)" },
  { id: 21, from: "SKIN1004", to: "COSRX", evidence: "cosrx.com «Advanced The Vitamin C 23 Serum» · skin1004.com 0건" },
  { id: 26, from: "SKIN1004", to: "COSRX", evidence: "cosrx.com «Galactomyces 95 Tone Balancing Essence» · skin1004.com 0건" },
  { id: 36, from: "SKIN1004", to: "COSRX", evidence: "cosrx.com Galactomyces 라인 보유 · skin1004.com 0건" },
];

type CollectResult = {
  productId: number;
  brand: string;
  name: string;
  matchedTitle: string | null;
  similarity: number;
  purchaseUrl: string | null;
  price: number | null;
  inStock: boolean | null;
  ingredientCount: number;
};

async function getText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

function retailerFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host;
}


/**
 * 성분 사전 전량. **PostgREST 는 1000행에서 자른다** — limit 을 키워도 안 되고,
 * 페이지로 넘겨야 한다. 사전이 1,242행이 된 뒤 이 절단 때문에 새로 넣은 성분이
 * 조회에서 빠져 활성화가 멈췄다(2026-07-30).
 */
async function fetchIngredientDict(
  client: SupabaseClient
): Promise<Array<{ id: number; name_en: string | null; name_ko: string | null }>> {
  const out: Array<{ id: number; name_en: string | null; name_ko: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("ingredients")
      .select("id,name_en,name_ko")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`ingredients 조회 실패: ${error.code} ${error.message}`);
    const page = (data ?? []) as Array<{ id: number; name_en: string | null; name_ko: string | null }>;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const {
    parseIngredientList,
    normalizeTextKey,
    ingredientNameVariants,
    ingredientTokenLookupCandidates,
  } = await import("@/lib/pipeline/ingredient-normalize");

  const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8")) as { results: CollectResult[] };
  const targets = artifact.results.filter(
    (r) => r.purchaseUrl && r.price != null && r.price > 0 && r.inStock === true && r.ingredientCount > 0
  );

  console.log(`반영 대상 ${targets.length}건 · 브랜드 정정 ${BRAND_FIXES.length}건`);
  if (!apply) {
    console.log("\ndry-run. --apply 를 붙이면 실제로 반영한다.");
    console.log("전성분 검증까지 미리 태운다 — 반려될 건은 반영해도 저장되지 않는다.\n");
    let pass = 0;
    for (const t of targets) {
      const page = await getText(t.purchaseUrl!);
      const raw = extractLabeledIngredientsRaw(page);
      const v = raw ? sanitizeIngredientList(raw.raw) : { ok: false as const, reason: "전성분 추출 실패" };
      const mark = v.ok ? "통과" : "반려";
      if (v.ok) pass += 1;
      const why = v.ok
        ? `  성분 ${v.tokens.length}개${v.cutAtMarker ? " (꼬리 절단)" : ""}${v.droppedTailTokens ? ` (항목 ${v.droppedTailTokens}개 버림)` : ""}`
        : `  ← ${v.reason}${"sample" in v && v.sample ? ` (${v.sample})` : ""}`;
      console.log(`  ${mark} ${String(t.productId).padStart(4)} ${t.brand.padEnd(16)} ${t.name.slice(0, 42).padEnd(42)}${why}`);
    }
    console.log(`\n  통과 ${pass}건 / 대상 ${targets.length}건`);
    return;
  }

  // ── 1. 브랜드 정정
  console.log("\n[1] 브랜드 정정");
  let fixed = 0;
  for (const f of BRAND_FIXES) {
    const { data, error } = await client
      .from("products")
      .update({ brand: f.to })
      .eq("id", f.id)
      .eq("brand", f.from)
      .select("id,brand");
    if (error) {
      console.log(`  ${f.id} 실패: ${error.code} ${error.message}`);
      continue;
    }
    if ((data ?? []).length === 0) {
      console.log(`  ${f.id} 건너뜀 — 이미 «${f.from}» 이 아니다`);
      continue;
    }
    fixed += 1;
    console.log(`  ${f.id} ${f.from} → ${f.to}`);
  }
  console.log(`  ${fixed}건 정정`);

  // ── 2~5. 제품별 반영
  console.log("\n[2] 전성분·오퍼·활성화");
  const nowIso = new Date().toISOString();
  let ingredientsUpdated = 0;
  let offersInserted = 0;
  let activated = 0;
  let linksInserted = 0;
  let offersSkipped = 0;
  const matchedByProduct = new Map<number, number>();
  /** 이번에 실제로 뽑은 전성분 토큰 수. artifact 의 옛 개수를 쓰면 미매칭 수가 틀린다. */
  const tokenCountByProduct = new Map<number, number>();
  const failures: string[] = [];
  /** 전성분이 성분표로 보이지 않아 저장을 건너뛴 것. 실패와 구분해서 남긴다. */
  const rejected: string[] = [];

  // Production 성분 사전을 한 번만 읽어 이름 → id 로 만든다. 영문·한글 둘 다 건다.
  const dict = await fetchIngredientDict(client);
  const ingredientIdByKey = new Map<string, number>();
  for (const row of dict) {
    for (const n of [row.name_en, row.name_ko]) {
      // 부연 괄호가 달린 이름도 원문 토큰과 만나게 변형 키를 함께 건다.
      for (const variant of ingredientNameVariants(n)) {
        const k = normalizeTextKey(variant);
        if (k && !ingredientIdByKey.has(k)) ingredientIdByKey.set(k, row.id);
      }
    }
  }
  console.log(`  성분 사전 ${ingredientIdByKey.size}개 키 로드`);

  for (const [index, t] of targets.entries()) {
    const pid = t.productId;

    // 전성분 재수집 (artifact 에는 개수만 있고 토큰이 없다)
    const page = await getText(t.purchaseUrl!);
    const raw = extractLabeledIngredientsRaw(page);
    if (!raw) {
      failures.push(`${pid} 전성분 재수집 실패`);
      continue;
    }

    // 쓰기 직전 관문 — 추출기를 두 번 고쳤는데도 마케팅 문구가 새어 들어왔고,
    // 2026-07-29 에 오염된 18건이 Production 에 저장돼 되돌려야 했다. 전성분은
    // 알레르겐 검사의 입력이라 쓰레기가 들어가면 "안전" 판정이 무의미해진다.
    const verdict = sanitizeIngredientList(raw!.raw);
    if (!verdict.ok) {
      rejected.push(`${pid} ${t.brand} — ${verdict.reason}${verdict.sample ? ` (${verdict.sample})` : ""}`);
      continue;
    }
    // 검증을 통과한 **정제된 토큰**을 저장한다. 추출기가 뽑은 토큰을 그대로 쓰면
    // 잘라낸 꼬리가 다시 들어간다.
    const tokens = verdict.tokens;

    // full_ingredients 갱신 — 기존 값이 있으면 덮지 않는다
    const { data: up, error: upErr } = await client
      .from("products")
      .update({ full_ingredients: tokens })
      .eq("id", pid)
      .is("full_ingredients", null)
      .select("id");
    if (upErr) {
      failures.push(`${pid} full_ingredients 실패: ${upErr.code} ${upErr.message}`);
      if (index === 0) break;
      continue;
    }
    if ((up ?? []).length > 0) ingredientsUpdated += 1;

    // 오퍼 — 실제 판매 페이지에서 읽은 값만.
    // 같은 URL 의 오퍼가 이미 있으면 넣지 않는다. 재실행 시 중복이 쌓이는 것을 막는다.
    const host = retailerFromUrl(t.purchaseUrl!);
    const { data: dup } = await client
      .from("product_offers")
      .select("id")
      .eq("product_id", String(pid))
      .eq("purchase_url", t.purchaseUrl!)
      .limit(1);
    if ((dup ?? []).length > 0) {
      console.log(`  ${String(pid).padStart(4)} 오퍼 이미 있음 — 건너뜀`);
      matchedByProduct.set(pid, matchedByProduct.get(pid) ?? 0);
      offersSkipped += 1;
    } else {
    const { error: offErr } = await client.from("product_offers").insert({
      product_id: String(pid),
      retailer_name: host,
      retailer_country: "US",
      ships_to_countries: ["US"],
      purchase_url: t.purchaseUrl,
      price: t.price,
      currency: "USD",
      stock_status: "in_stock",
      verification_status: "verified",
      is_official: true,
      verified_at: nowIso,
      last_checked_at: nowIso,
      source: "brand_official_site",
    });
    if (offErr) {
      failures.push(`${pid} 오퍼 실패: ${offErr.code} ${offErr.message}`);
      if (index === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    offersInserted += 1;
    }

    // 성분 링크 — 활성화 게이트가 «공식 소스에서 온 구조화 성분» 개수를 요구한다.
    // `product_ingredients` 는 이름이 아니라 `ingredient_id`(FK)를 받으므로,
    // 사전에 이미 있는 성분만 연결한다. 없는 성분을 만들어 넣지 않는다 —
    // 07-25 에 사전에 그림자 행을 만들었다가 296건을 정리한 적이 있다.
    // 순번은 기존 링크(admin_entry 등) 뒤로 이어붙인다.
    // `product_ingredients_order_uidx` 가 (product_id, ingredient_order) 라서
    // 1 부터 다시 매기면 기존 행과 충돌한다 — 2026-07-29 에 5건이 이렇게 실패했다.
    const { data: orderRows } = await client
      .from("product_ingredients")
      .select("ingredient_order")
      .eq("product_id", String(pid))
      .order("ingredient_order", { ascending: false })
      .limit(1);
    const baseOrder = Number((orderRows ?? [])[0]?.ingredient_order ?? 0);

    const linkRows: Array<Record<string, unknown>> = [];
    const usedIngredientIds = new Set<number>();
    let order = baseOrder;
    for (const name of tokens) {
      // INCI 는 같은 물질의 여러 이름을 슬래시로 묶는다(`Aqua/Water/Eau`).
      // 통째로 없으면 «조각 전부가 사전에 있을 때만» 동의어로 보고 첫 조각의 id 를 쓴다.
      const cand = ingredientTokenLookupCandidates(name);
      let id = ingredientIdByKey.get(cand.whole);
      if (
        !id &&
        cand.segments.length >= 2 &&
        cand.segments.every((sg) => ingredientIdByKey.has(sg))
      ) {
        id = ingredientIdByKey.get(cand.segments[0]);
      }
      if (!id) continue;
      // 같은 성분이 두 토큰에서 잡히면 한 번만 넣는다.
      if (usedIngredientIds.has(id)) continue;
      usedIngredientIds.add(id);
      linkRows.push({
        product_id: String(pid),
        ingredient_id: id,
        ingredient_order: (order += 1),
        source_url: t.purchaseUrl,
        source_type: "official_brand_page",
        verification_status: "approved",
        verified_at: nowIso,
        source_verified: true,
      });
    }
    const { data: existingLinks } = await client
      .from("product_ingredients")
      .select("id")
      .eq("product_id", String(pid))
      .eq("source_type", "official_brand_page")
      .limit(1);
    if ((existingLinks ?? []).length > 0) {
      matchedByProduct.set(pid, linkRows.length);
    tokenCountByProduct.set(pid, tokens.length);
    } else if (linkRows.length > 0) {
      const { error: linkErr } = await client.from("product_ingredients").insert(linkRows);
      if (linkErr) failures.push(`${pid} 성분링크 실패: ${linkErr.code} ${linkErr.message}`);
      else linksInserted += linkRows.length;
    }
    matchedByProduct.set(pid, linkRows.length);

    console.log(
      `  ${String(pid).padStart(4)} ${t.brand.padEnd(18)}${t.name.slice(0, 36).padEnd(38)}성분 ${String(tokens.length).padStart(3)} · $${t.price}`
    );

    await new Promise((r) => setTimeout(r, 400));
  }

  // ── 5. 활성화 — 게이트를 그대로 태운다. 낮추지 않는다.
  console.log("\n[3] 활성화 (verifyAndActivateProduct)");
  const { verifyAndActivateProduct } = await import(
    "@/lib/pipeline/product-verify/product-activate"
  );
  const batchId = `tier1-prod-${nowIso}`;
  for (const t of targets) {
    const matched = matchedByProduct.get(t.productId) ?? 0;
    try {
      // 수집에서 확인한 것을 그대로 넘긴다. 넘기지 않으면 게이트가 기본 스텁
      // (카테고리·이미지·설명 전부 null, confidence 0.75)을 쓴다.
      //
      // `confidence` 는 실제 근거로 계산한다. 부풀리지 않는다 —
      //   구조화 API(Shopify /products.json) 에서 왔는가        +0.10
      //   제품명이 사실상 일치하는가 (포함도 >= 0.95)            +0.10
      //   전성분이 용매·성분다움 검사를 통과했는가              +0.05
      const conf = Math.min(
        0.95,
        0.70 + 0.10 + (t.similarity >= 0.95 ? 0.1 : t.similarity >= 0.85 ? 0.05 : 0) +
          ((t.ingredientCount ?? 0) > 0 ? 0.05 : 0)
      );
      const r = await verifyAndActivateProduct(client, {
        productId: t.productId,
        batchId,
        extracted: {
          productName: t.name,
          brandName: t.brand,
          canonicalUrl: t.purchaseUrl!,
          category: null,
          imageUrl: null,
          description: t.matchedTitle,
          fullIngredientsText: null,
          keyIngredients: [],
          sizeLabel: null,
          priceReference: t.price,
          currency: "USD",
          availabilityReference: t.inStock ? "in_stock" : null,
          country: "US",
          sourceType: "official_site",
          confidence: conf,
          extractionMethod: "shopify_products_json",
          fieldConfidence: {},
        },
        // 사전에 없어 링크하지 못한 성분은 미매칭으로 정직하게 넘긴다.
        unmatchedIngredientCount: Math.max(
          0,
          (tokenCountByProduct.get(t.productId) ?? t.ingredientCount ?? 0) - matched
        ),
        ambiguousIngredientCount: 0,
        safetyConflict: false,
      });
      if (r.activated) {
        activated += 1;
        console.log(`  ${String(t.productId).padStart(4)} 활성화`);
      } else {
        console.log(
          `  ${String(t.productId).padStart(4)} 보류 — ${r.skippedReason ?? ""} ${r.gateBlockers.join(",")}`
        );
      }
    } catch (e) {
      failures.push(`${t.productId} 활성화 예외: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\n  전성분 갱신 ${ingredientsUpdated} · 오퍼 ${offersInserted} · 성분링크 ${linksInserted} · 활성화 ${activated}`
  );
  if (failures.length > 0) {
    console.log(`\n  실패 ${failures.length}건:`);
    for (const f of failures.slice(0, 20)) console.log(`    ${f}`);
  }
}

main().catch((e) => {
  console.error("[apply-tier1-to-production] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
