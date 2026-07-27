/**
 * 옛 파서가 만든 **틀린** product_ingredients 링크를 걷어낸다.
 *
 * 배경: §35.7 을 구현하기 전 파서는 성분명을 쪼갰다.
 * `알라닌/히스티딘/라이신폴리펩타이드카퍼에이치씨엘` 을 세 조각으로 갈라
 * `알라닌` 과 `히스티딘` 을 각각 성분으로 연결했는데, 그 제품에는 둘 다
 * 들어 있지 않다. 파서를 고쳐도 **이미 저장된 링크는 그대로 남는다** —
 * `linkProductIngredients` 는 추가만 하고 지우지 않기 때문이다.
 *
 * 성분은 안전 판정의 근거이므로, 없는 성분이 붙어 있는 상태를 두면 안 된다.
 *
 * 판단 기준: 지금 파서로 `products.full_ingredients` 를 다시 읽어 나오는
 * 성분 집합에 없는 링크만 지운다. 전성분이 없는 제품은 비교 기준이 없으므로
 * 손대지 않는다 (다른 경로로 들어온 링크를 지울 위험).
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/prune-stale-product-ingredients.ts            # 검증만
 *   ... scripts/prune-stale-product-ingredients.ts --apply  # 실제 삭제
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
  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const ingredients = await fetchAll<Record<string, never>>(client, "ingredients", "id,slug,name_en,name_ko");
  const aliases = (
    await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
  ).filter((a) => a.active);
  const products = await fetchAll<{ id: number; brand: string | null; name: string | null; full_ingredients: unknown }>(
    client,
    "products",
    "id,brand,name,full_ingredients"
  );
  const links = await fetchAll<{ id: string; product_id: number; ingredient_id: number }>(
    client,
    "product_ingredients",
    "id,product_id,ingredient_id"
  );
  const maps = buildIngredientLookupMaps(ingredients as never, aliases as never);
  const nameOf = new Map(
    (ingredients as unknown as Array<{ id: number; name_ko: string | null; name_en: string | null }>).map((r) => [
      r.id,
      r.name_ko || r.name_en || String(r.id),
    ])
  );

  const stale: Array<{ linkId: string; productId: number; ingredientId: number }> = [];
  let comparedProducts = 0;
  let skippedProducts = 0;
  const perProduct = new Map<number, number>();

  for (const p of products) {
    const fi = p.full_ingredients;
    const own = links.filter((l) => l.product_id === p.id);
    if (own.length === 0) continue;
    if (!Array.isArray(fi) || fi.length === 0) {
      // 비교 기준이 없다. 다른 경로로 들어온 링크일 수 있으니 건드리지 않는다.
      skippedProducts += 1;
      continue;
    }
    comparedProducts += 1;
    const valid = new Set(
      attachIngredientMatches(parseIngredientList(fi.join(", ")), maps)
        .normalized.map((x) => x.matchedIngredientId)
        .filter((x): x is number => x != null)
    );
    for (const l of own) {
      if (valid.has(l.ingredient_id)) continue;
      stale.push({ linkId: l.id, productId: p.id, ingredientId: l.ingredient_id });
      perProduct.set(p.id, (perProduct.get(p.id) ?? 0) + 1);
    }
  }

  console.log(`제품 ${comparedProducts}건 대조 / 전성분 없어 건너뜀 ${skippedProducts}건`);
  console.log(`현재 링크 ${links.length}행 중 지금 파서로 재현되지 않는 링크: ${stale.length}행\n`);

  const freq = new Map<number, number>();
  for (const s of stale) freq.set(s.ingredientId, (freq.get(s.ingredientId) ?? 0) + 1);
  console.log("--- 가장 많이 잘못 붙은 성분 (상위 20) ---");
  for (const [id, n] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log(`  ${String(n).padStart(3)}개 제품  id ${String(id).padStart(4)}  ${nameOf.get(id) ?? "?"}`);

  console.log("\n--- 링크가 가장 많이 줄어드는 제품 (상위 15) ---");
  for (const [pid, n] of [...perProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    const p = products.find((x) => x.id === pid);
    console.log(`  ${String(pid).padStart(3)}  -${String(n).padStart(3)}  ${String(p?.brand ?? "").slice(0, 12).padEnd(13)}${String(p?.name ?? "").slice(0, 38)}`);
  }

  if (!apply) {
    console.log("\n검증 모드. 실제 삭제하려면 --apply 를 붙인다.");
    return;
  }
  if (stale.length === 0) return;

  let deleted = 0;
  for (let i = 0; i < stale.length; i += 100) {
    const chunk = stale.slice(i, i + 100).map((s) => s.linkId);
    const { error } = await client.from("product_ingredients").delete().in("id", chunk);
    if (error) {
      console.error(`\n[중단] 삭제 실패: ${error.code} ${error.message}`);
      if (error.code === "42501")
        console.error("필요한 GRANT:\n  GRANT DELETE ON TABLE public.product_ingredients TO service_role;");
      process.exitCode = 1;
      return;
    }
    deleted += chunk.length;
  }
  const after = await fetchAll<{ id: string }>(client, "product_ingredients", "id");
  console.log(`\n삭제 ${deleted}행. product_ingredients ${links.length} -> ${after.length}`);
}

main().catch((e) => {
  console.error("[prune-stale-product-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
