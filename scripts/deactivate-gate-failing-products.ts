/**
 * 게이트 조건을 실제로는 못 채운 활성 제품을 비활성으로 되돌린다.
 *
 * 배경: `verifyAndActivateProduct` 는 미매칭·모호 성분 개수를 **호출자에게서
 * 받는다.** `collect-scalp-hair-tier1.ts` 가 그 값을 넘기지 않아 0 으로
 * 간주됐고, `ingredient_unmatched` 조건이 한 번도 발동하지 않았다. 게이트를
 * 낮춘 적이 없는데 통과한 셈이다.
 *
 * 성분은 안전 판정의 근거다. 매칭되지 않은 성분이 남은 제품은 그 성분이
 * 무엇인지 시스템이 모르는 상태이므로, 공개해 두면 안 된다.
 *
 * `active=false` 로만 되돌리고 데이터는 지우지 않는다 — 사전이 더 채워지면
 * 다시 통과할 수 있다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/deactivate-gate-failing-products.ts                 # 검증만
 *   ... --apply                       # 되돌리기
 *   ... --apply --only 80,81,82       # 지정한 id 만
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
  const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
  const only =
    process.argv.includes("--only") && onlyArg
      ? new Set(onlyArg.split(",").map((s) => Number(s.trim())))
      : null;

  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const maps = buildIngredientLookupMaps(
    await fetchAll(client, "ingredients", "id,slug,name_en,name_ko"),
    (
      await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
    ).filter((a) => a.active) as never
  );
  const products = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    active: boolean;
    full_ingredients: unknown;
  }>(client, "products", "id,brand,name,active,full_ingredients");

  const failing = products
    .filter((p) => p.active)
    .map((p) => {
      const fi = Array.isArray(p.full_ingredients) ? (p.full_ingredients as string[]) : [];
      const n = attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized;
      return {
        id: p.id,
        brand: p.brand ?? "",
        name: p.name ?? "",
        tokens: n.length,
        unmatched: n.filter((x) => !x.matchedIngredientId).length,
      };
    })
    .filter((r) => r.unmatched > 0)
    .filter((r) => (only ? only.has(r.id) : true));

  console.log(`되돌릴 대상 ${failing.length}건${only ? " (--only 지정)" : ""}`);
  for (const r of failing.sort((a, b) => b.unmatched - a.unmatched))
    console.log(
      `  ${String(r.id).padStart(3)}  미매칭 ${String(r.unmatched).padStart(3)}/${String(r.tokens).padStart(3)}  ${r.brand.slice(0, 12).padEnd(13)}${r.name.slice(0, 40)}`
    );

  if (!apply) {
    console.log("\n검증 모드. 되돌리려면 --apply 를 붙인다.");
    return;
  }
  if (failing.length === 0) return;

  for (const r of failing) {
    // verified_at 은 남긴다. 검증 사실 자체가 거짓이었던 게 아니라,
    // 성분 조건을 확인하지 않은 채 공개된 것이 문제다.
    const { error } = await client.from("products").update({ active: false }).eq("id", r.id);
    if (error) throw new Error(`${r.id} 비활성화 실패: ${error.code} ${error.message}`);
  }
  const after = (await fetchAll<{ id: number; active: boolean }>(client, "products", "id,active")).filter(
    (p) => p.active
  ).length;
  console.log(`\n${failing.length}건 비활성화. 활성 제품 ${after}건 남음`);
}

main().catch((e) => {
  console.error("[deactivate-gate-failing-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
