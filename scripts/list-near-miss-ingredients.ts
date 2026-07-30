/**
 * 미매칭이 **몇 개 안 남은 제품**의 빠진 성분만 뽑는다. 읽기 전용.
 *
 * 게이트는 미매칭 0 을 요구한다. 1~2개만 남은 제품은 그 성분 몇 개를 사전에
 * 넣으면 바로 활성화된다 — 가장 값싼 다음 단계다.
 *
 * 실행: npm run check:near-miss-ingredients
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
/** 이 개수 이하로 남은 제품만 본다 */
const MAX_MISS = 6;


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

  const { normalizeTextKey, ingredientNameVariants, ingredientTokenLookupCandidates } =
    await import("@/lib/pipeline/ingredient-normalize");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const dict = await fetchIngredientDict(client);
  const keys = new Set<string>();
  for (const r of dict) {
    for (const n of [r.name_en, r.name_ko]) {
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k) keys.add(k);
      }
    }
  }

  const { data: prods } = await client
    .from("products")
    .select("id,brand,name,full_ingredients,active,verified_at")
    .not("full_ingredients", "is", null);

  const rows: Array<{ id: number; brand: string; name: string; miss: string[]; active: boolean }> = [];
  for (const p of (prods ?? []) as Array<{
    id: number;
    brand: string;
    name: string;
    full_ingredients: string[];
    active: boolean | null;
    verified_at: string | null;
  }>) {
    const tokens = Array.isArray(p.full_ingredients) ? p.full_ingredients.map(String) : [];
    const miss: string[] = [];
    for (const t of tokens) {
      const cand = ingredientTokenLookupCandidates(t);
      const matched =
        keys.has(cand.whole) ||
        (cand.segments.length >= 2 && cand.segments.every((s) => keys.has(s)));
      if (!matched) miss.push(t);
    }
    rows.push({
      id: p.id,
      brand: String(p.brand),
      name: String(p.name),
      miss,
      active: p.active === true && p.verified_at != null,
    });
  }

  const near = rows
    .filter((r) => r.miss.length > 0 && r.miss.length <= MAX_MISS && !r.active)
    .sort((a, b) => a.miss.length - b.miss.length);

  console.log(`미매칭 1~${MAX_MISS}개 · 아직 비활성인 제품 ${near.length}건\n`);
  const allMiss = new Map<string, number>();
  for (const r of near) {
    console.log(`  ${String(r.id).padStart(4)} ${r.brand.padEnd(18)}${r.name.slice(0, 34).padEnd(36)}미매칭 ${r.miss.length}`);
    for (const m of r.miss) {
      console.log(`         · ${m.slice(0, 70)}`);
      allMiss.set(m, (allMiss.get(m) ?? 0) + 1);
    }
  }

  console.log(`\n── 넣어야 할 성분 ${allMiss.size}종 (빈도순) ──`);
  for (const [name, n] of [...allMiss.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(2)}회  ${name.slice(0, 70)}`);
}

main().catch((e) => {
  console.error("[list-near-miss-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
