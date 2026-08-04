/**
 * 성분 사전 대조가 끝난 제품을 **활성화 게이트에 태운다.**
 *
 * 활성화를 막던 것은 `unmatchedIngredientCount > 0` 이었고, 그 원인은 두 성분이 한
 * 토큰으로 붙어 저장된 것이었다(§41 의 쉼표 분리 버그). 재분리로 해소한 뒤
 * 미매칭 0 이 된 제품을 여기서 게이트에 통과시킨다.
 *
 * **게이트를 낮추지 않는다.** `verifyAndActivateProduct` 를 그대로 부르고, 통과
 * 못 하면 이유를 찍고 남긴다 — 통과시키려고 값을 조작하지 않는다.
 *
 * 미매칭 수는 **여기서 실제로 계산해서 넘긴다.** 0 이라고 우기지 않는다 —
 * 사전과 대조해 나온 값을 그대로 준다.
 *
 * 안전장치 — `--apply` 없이는 게이트 판정만 보여주고 쓰지 않는다.
 *
 * 실행: npm run apply:activate-ready -- --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

type Row = {
  id: number;
  brand: string | null;
  name: string | null;
  active: boolean | null;
  verified_at: string | null;
  full_ingredients: string[] | string | null;
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

  // 활성화 경로는 admin 클라이언트를 쓰므로 그쪽 환경변수에 Production 을 물린다.
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;

  const { normalizeTextKey, ingredientNameVariants, isIngredientTokenKnown } = await import(
    "@/lib/pipeline/ingredient-normalize"
  );
  const { verifyAndActivateProduct } = await import(
    "@/lib/pipeline/product-verify/product-activate"
  );

  const client = createClient(url, key, { auth: { persistSession: false } });

  // 성분 사전 전량 (PostgREST 는 1000행에서 자른다)
  const dict = await fetchAll<{ name_en: string | null; name_ko: string | null }>(
    client,
    "ingredients",
    "id,name_en,name_ko"
  );
  const keys = new Set<string>();
  for (const r of dict)
    for (const n of [r.name_en, r.name_ko])
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k) keys.add(k);
      }

  const products = await fetchAll<Row>(
    client,
    "products",
    "id,brand,name,active,verified_at,full_ingredients"
  );
  // 아직 검증 안 됐고 전성분이 있는 것만 본다.
  const candidates = products.filter(
    (p) => p.verified_at == null && Array.isArray(p.full_ingredients) && p.full_ingredients.length > 0
  );

  const ready: Array<{ row: Row; unmatched: number }> = [];
  for (const p of candidates) {
    const toks = (p.full_ingredients as string[]).map(String);
    const unmatched = toks.filter((t) => !isIngredientTokenKnown(t, keys)).length;
    if (unmatched === 0) ready.push({ row: p, unmatched });
  }

  console.log(`미검증 + 전성분 보유 ${candidates.length}건 · 그중 미매칭 0 인 것 ${ready.length}건\n`);
  for (const r of ready)
    console.log(`  ${String(r.row.id).padStart(4)} ${String(r.row.brand).padEnd(17)} ${String(r.row.name).slice(0, 40)}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 게이트에 태운다.");
    return;
  }
  if (ready.length === 0) return;

  console.log("\n게이트 판정:");
  let activated = 0;
  const batchId = `activate-ready-${Date.now()}`;
  for (const r of ready) {
    try {
      const res = await verifyAndActivateProduct(client, {
        productId: r.row.id,
        batchId,
        unmatchedIngredientCount: r.unmatched,
      });
      if (res.activated) {
        activated += 1;
        console.log(`  ${String(r.row.id).padStart(4)} 활성화됨`);
      } else {
        console.log(
          `  ${String(r.row.id).padStart(4)} 통과 못 함 — ${(res.gateBlockers ?? []).join(", ") || res.skippedReason || "사유 없음"}`
        );
      }
    } catch (e) {
      console.log(`  ${String(r.row.id).padStart(4)} 오류: ${e instanceof Error ? e.message.slice(0, 70) : e}`);
    }
  }
  console.log(`\n활성화 ${activated}건`);
}

main().catch((e) => {
  console.error("[activate-ingredient-ready-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
