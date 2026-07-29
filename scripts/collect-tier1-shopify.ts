/**
 * D단계 — Shopify 기반 Tier 1 브랜드에서 오퍼·전성분을 수집한다.
 *
 * Shopify 는 `/products.json` 을 공개 API 로 열어 두므로 HTML 파싱보다 정확하다.
 * 가격·재고·URL 이 구조화돼 있고, `body_html` 에 전성분이 실려 있는 경우가 많다.
 *
 * **DB 에 쓰지 않는다.** 결과를 `artifacts/tier1-collect/` 에 남기고, 활성화
 * 게이트를 offline 으로 평가해 «통과할 것» 목록만 만든다. Production 반영은
 * 승인 대상이므로 여기서 하지 않는다.
 *
 * 매칭 원칙: 제품명이 확실히 같을 때만 연결한다. 애매하면 연결하지 않고 남긴다 —
 * 엉뚱한 제품의 가격·성분을 붙이는 것이 빈 상태보다 나쁘다.
 *
 * 실행: npm run collect:tier1-shopify
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";

/** Production 브랜드 표기 → Shopify 도메인. 레지스트리에서 확인된 것만. */
const SHOPIFY_BRANDS: ReadonlyArray<{ brands: string[]; domain: string }> = [
  { brands: ["COSRX", "CosRX"], domain: "cosrx.com" },
  { brands: ["SKIN1004"], domain: "skin1004.com" },
  { brands: ["Beauty of Joseon"], domain: "beautyofjoseon.com" },
];

type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  available: boolean;
};
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  variants: ShopifyVariant[];
};

/** 제품명 비교용 정규화 — 브랜드명·용량·기호를 걷어내고 핵심 토큰만 남긴다. */
function nameTokens(raw: string, brand: string): Set<string> {
  const stripped = raw
    .toLowerCase()
    .replace(new RegExp(brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ")
    .replace(/\d+(\.\d+)?\s*(ml|g|oz|매|ea|개|pcs)\b/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ");
  return new Set(stripped.split(/\s+/).filter((t) => t.length >= 2));
}

/**
 * 포함도(containment) — 교집합 / 짧은 쪽 크기.
 *
 * 자카드를 먼저 썼다가 실패했다. 사이트 제목이 «Relief Sun : Rice + Probiotics
 * SPF50+ PA++++» 처럼 DB 이름보다 토큰이 훨씬 많으면, 사실상 같은 제품인데도
 * 합집합이 커져 점수가 0.57 로 떨어진다. 한쪽이 다른 쪽을 «거의 포함» 하는지를
 * 보는 편이 이 경우에 맞다.
 *
 * 0.8 이상만 같은 제품으로 본다. 애매하면 연결하지 않는다 — 엉뚱한 제품의
 * 가격·성분을 붙이는 것이 빈 상태보다 나쁘다.
 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function getText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

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

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_ANON_KEY ??
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
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
  const { parseIngredientList } = await import("@/lib/pipeline/ingredient-normalize");

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    verified_at: string | null;
  }>(client, "products", "id,brand,name,verified_at");
  const targets = products.filter((p) => p.verified_at == null);

  type Result = {
    productId: number;
    brand: string;
    name: string;
    matchedTitle: string | null;
    similarity: number;
    purchaseUrl: string | null;
    price: number | null;
    inStock: boolean | null;
    ingredientCount: number;
    note: string;
  };
  const results: Result[] = [];

  for (const group of SHOPIFY_BRANDS) {
    const mine = targets.filter((p) => group.brands.includes(String(p.brand ?? "")));
    if (mine.length === 0) continue;

    console.log(`\n=== ${group.brands[0]} (${group.domain}) — 대상 ${mine.length}건 ===`);

    // 전체 제품 목록을 페이지로 받는다.
    const catalog: ShopifyProduct[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const data = await getJson<{ products: ShopifyProduct[] }>(
        `https://${group.domain}/products.json?limit=250&page=${page}`
      );
      const batch = data?.products ?? [];
      catalog.push(...batch);
      if (batch.length < 250) break;
      await new Promise((r) => setTimeout(r, 800));
    }
    console.log(`  사이트 제품 ${catalog.length}건 확보`);

    const prepared = catalog.map((c) => ({
      product: c,
      tokens: nameTokens(c.title, group.brands[0]),
    }));

    for (const p of mine) {
      const mineTokens = nameTokens(String(p.name ?? ""), group.brands[0]);
      let best: { product: ShopifyProduct; score: number } | null = null;
      for (const cand of prepared) {
        const score = similarity(mineTokens, cand.tokens);
        if (!best || score > best.score) best = { product: cand.product, score };
      }

      if (!best || best.score < 0.8) {
        results.push({
          productId: p.id,
          brand: String(p.brand),
          name: String(p.name),
          matchedTitle: best ? best.product.title : null,
          similarity: best ? Number(best.score.toFixed(2)) : 0,
          purchaseUrl: null,
          price: null,
          inStock: null,
          ingredientCount: 0,
          note: "매칭 실패 — 애매해서 연결하지 않음",
        });
        continue;
      }

      const sp = best.product;
      const variant = sp.variants?.[0];
      const productUrl = `https://${group.domain}/products/${sp.handle}`;

      // 전성분은 body_html 에 거의 없다 — Shopify 는 보통 별도 탭·메타필드에
      // 넣는다. 실제 제품 페이지를 한 번 더 받아 거기서 찾는다.
      let raw = extractLabeledIngredientsRaw(sp.body_html ?? "");
      if (!raw) {
        const page = await getText(productUrl);
        if (page) raw = extractLabeledIngredientsRaw(page);
        await new Promise((r) => setTimeout(r, 600));
      }
      const parsed = raw ? parseIngredientList(raw.raw) : null;

      results.push({
        productId: p.id,
        brand: String(p.brand),
        name: String(p.name),
        matchedTitle: sp.title,
        similarity: Number(best.score.toFixed(2)),
        purchaseUrl: productUrl,
        price: variant ? Number(variant.price) : null,
        inStock: variant ? variant.available === true : null,
        ingredientCount: parsed?.normalized.length ?? 0,
        note: raw ? "오퍼+전성분" : "오퍼만 (전성분 라벨 없음)",
      });
    }
  }

  // ── 게이트 예상 평가 (offline)
  const withOffer = results.filter((r) => r.purchaseUrl && r.price != null && r.price > 0);
  const inStock = withOffer.filter((r) => r.inStock === true);
  const withIngredients = inStock.filter((r) => r.ingredientCount > 0);

  console.log("\n════ 결과 ════");
  console.log(`  대상                       ${results.length}`);
  console.log(`  제품 매칭 성공             ${results.filter((r) => r.matchedTitle && r.similarity >= 0.8).length}`);
  console.log(`  오퍼 확보(가격>0)          ${withOffer.length}`);
  console.log(`  그중 재고 있음             ${inStock.length}`);
  console.log(`  **전성분까지 확보**        ${withIngredients.length}  ← 활성화 가능 후보`);

  console.log("\n── 활성화 가능 후보 ──");
  for (const r of withIngredients) {
    console.log(
      `  ${String(r.productId).padStart(4)} ${r.brand.padEnd(18)}${r.name.slice(0, 44).padEnd(46)}` +
        `${String(r.price).padStart(8)} 성분 ${r.ingredientCount}`
    );
  }

  const failed = results.filter((r) => !r.matchedTitle || r.similarity < 0.8);
  if (failed.length > 0) {
    console.log(`\n── 매칭 실패 ${failed.length}건 (연결하지 않음) ──`);
    for (const r of failed.slice(0, 20))
      console.log(`  ${String(r.productId).padStart(4)} ${r.brand.padEnd(18)}${r.name.slice(0, 40)}  (최고 유사도 ${r.similarity})`);
  }

  mkdirSync("artifacts/tier1-collect", { recursive: true });
  const path = "artifacts/tier1-collect/shopify-2026-07-28.json";
  writeFileSync(path, JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2), "utf8");
  console.log(`\n결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[collect-tier1-shopify] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
