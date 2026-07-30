/**
 * 사전 보강 뒤 기존 제품의 전성분을 다시 매칭해 product_ingredients 를 채운다.
 *
 * 왜 필요한가: 링크는 매칭 시점의 사전 상태로 한 번 만들어진다. 나중에
 * 별칭을 추가하거나 키 정규화를 고쳐도 이미 저장된 링크는 저절로 늘지 않는다.
 * `linkProductIngredients` 는 이미 있는 (product, ingredient) 쌍을 건너뛰므로
 * 다시 돌려도 중복이 생기지 않는다 (멱등).
 *
 * 기존 링크를 지우지 않는다. 오직 추가만 한다.
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/relink-product-ingredients.ts            # 검증만
 *   ... scripts/relink-product-ingredients.ts --apply  # 실제 INSERT
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/** PostgREST 는 응답을 1000행에서 자른다. 전량이 필요하면 반드시 페이지네이션. */
async function fetchAll<T>(
  client: SupabaseClient,
  table: string,
  select: string
): Promise<T[]> {
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
  const apply = process.argv.includes("--apply");
  const { parseIngredientList } = await import("../src/lib/pipeline/ingredient-normalize");
  const { linkProductIngredients } = await import("../src/lib/pipeline/ingredient-link");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = "relink-after-ko-alias-2026-07-27";

  const products = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    full_ingredients: unknown;
  }>(client, "products", "id,brand,name,full_ingredients");

  const before = (await fetchAll<{ id: number }>(client, "product_ingredients", "id")).length;

  let touched = 0;
  let addedTotal = 0;
  const perProduct: Array<[number, string, number, number]> = [];

  for (const p of products) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    const parsed = parseIngredientList(fi.join(", "));
    if (parsed.normalized.length === 0) continue;

    if (!apply) {
      touched += 1;
      continue;
    }

    const result = await linkProductIngredients(client, {
      productId: p.id,
      parsed,
      // 이 재링크의 출처는 크롤 원본이 아니라 «이미 저장된 full_ingredients» 다.
      // 새 사실을 가져온 게 아니라 매칭만 다시 한 것이므로 그대로 기록한다.
      sourceUrl: `internal:relink/products/${p.id}`,
      batchId,
    });
    if (result.skippedReason) {
      console.log(`  ${p.id} 건너뜀: ${result.skippedReason}`);
      continue;
    }
    touched += 1;
    if (result.linked > 0) {
      addedTotal += result.linked;
      perProduct.push([p.id, `${p.brand ?? ""} ${p.name ?? ""}`.trim(), result.linked, result.unmatched]);
    }
  }

  if (!apply) {
    console.log(`검증 모드: 전성분이 있는 제품 ${touched}건이 대상. --apply 로 실제 실행.`);
    return;
  }

  const after = (await fetchAll<{ id: number }>(client, "product_ingredients", "id")).length;
  console.log(`\n대상 제품 ${touched}건 / 새 링크 ${addedTotal}건`);
  console.log(`product_ingredients: ${before} -> ${after} (+${after - before})`);
  console.log("\n제품별 신규 링크 (상위 30):");
  for (const [id, label, added, unmatched] of perProduct
    .sort((a, b) => b[2] - a[2])
    .slice(0, 30)) {
    console.log(`  ${String(id).padStart(3)}  +${String(added).padStart(3)}  미매칭 ${String(unmatched).padStart(3)}  ${label.slice(0, 50)}`);
  }
}

main().catch((e) => {
  console.error("[relink-product-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
