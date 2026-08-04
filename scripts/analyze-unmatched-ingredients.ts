/**
 * 활성화를 막는 «미매칭 성분» 실태 조사. 읽기 전용.
 *
 * 게이트는 `unmatchedIngredientCount === 0` 을 요구한다. 제품당 성분이 30~60개인데
 * 하나라도 사전에 없으면 막힌다. 몇 개가 남았고 어떤 것들인지 봐야 다음 수를 정한다.
 *
 * 실행: npm run check:unmatched-ingredients
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const ARTIFACT = "artifacts/tier1-collect/shopify-2026-07-28.json";

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const { normalizeTextKey, ingredientNameVariants, isIngredientTokenKnown } =
    await import("@/lib/pipeline/ingredient-normalize");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: dict } = await client.from("ingredients").select("id,name_en,name_ko");
  const keys = new Set<string>();
  for (const r of (dict ?? []) as Array<{ name_en: string | null; name_ko: string | null }>) {
    for (const n of [r.name_en, r.name_ko]) {
      for (const variant of ingredientNameVariants(n)) {
        const k = normalizeTextKey(variant);
        if (k) keys.add(k);
      }
    }
  }
  console.log(`사전 키 ${keys.size}개\n`);

  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8")) as {
    results: Array<{ productId: number; name: string; ingredientCount: number }>;
  };
  const ids = artifact.results.filter((r) => r.ingredientCount > 0).map((r) => r.productId);

  const { data: prods } = await client
    .from("products")
    .select("id,name,full_ingredients")
    .in("id", ids);

  const missCount = new Map<string, number>();
  const perProduct: Array<{ id: number; name: string; total: number; miss: number }> = [];

  for (const p of (prods ?? []) as Array<{ id: number; name: string; full_ingredients: string[] | null }>) {
    const tokens = Array.isArray(p.full_ingredients) ? p.full_ingredients : [];
    if (tokens.length === 0) continue;
    let miss = 0;
    for (const t of tokens) {
      // 동의어 슬래시( ` / ` )는 조각 하나만 맞아도 같은 성분이고, 화학명 슬래시는
      // 통째로 봐야 한다. 괄호 머리말(`Water (Aqua/Eau)` → `Water`)도 후보에 넣는다.
      const matched = isIngredientTokenKnown(String(t), keys);
      if (!matched) {
        miss += 1;
        missCount.set(String(t), (missCount.get(String(t)) ?? 0) + 1);
      }
    }
    perProduct.push({ id: p.id, name: String(p.name), total: tokens.length, miss });
  }

  perProduct.sort((a, b) => a.miss - b.miss);
  console.log("제품별 미매칭 (적은 순):");
  for (const p of perProduct)
    console.log(
      `  ${String(p.id).padStart(4)} ${p.name.slice(0, 34).padEnd(36)} ${String(p.miss).padStart(3)} / ${p.total}`
    );

  const zero = perProduct.filter((p) => p.miss === 0).length;
  const few = perProduct.filter((p) => p.miss > 0 && p.miss <= 3).length;
  console.log(`\n미매칭 0건(활성화 가능) ${zero} · 1~3건 ${few} · 4건 이상 ${perProduct.length - zero - few}`);

  console.log("\n가장 자주 빠지는 성분 상위 30:");
  for (const [name, n] of [...missCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30))
    console.log(`  ${String(n).padStart(3)}회  ${name.slice(0, 60)}`);
  console.log(`\n서로 다른 미매칭 성분 ${missCount.size}종`);
}

main().catch((e) => {
  console.error("[analyze-unmatched-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
