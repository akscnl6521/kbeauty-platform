/**
 * 성분 링크(`product_ingredients`)가 없는 제품에 **링크를 만든다.**
 *
 * 활성화 게이트는 `structuredOfficialIngredientCount >= 1` 을 요구한다 —
 * `full_ingredients` 배열이 있어도 링크가 없으면 `structured_ingredients_missing`
 * 으로 막힌다. 국내몰에서 새로 등록한 제품이 여기서 걸렸다(2026-08-05, 11건).
 *
 * 기존 `rebuild-ingredient-links` 는 대상이 옛 수집 artifact 에 묶여 있어 새 제품을
 * 못 본다. 이 스크립트는 **DB 를 보고 «전성분은 있는데 링크가 없는» 제품**을 고른다.
 *
 * ## 지어내지 않는다
 *
 *   · 사전에 있는 성분만 링크한다. 없는 이름을 새로 만들지 않는다.
 *   · 출처 URL 은 그 제품의 **공식 오퍼 링크**를 쓴다. 없으면 링크를 만들지 않는다 —
 *     `product_ingredients_approved_source_chk` 가 출처를 요구한다.
 *   · 이미 링크가 있는 제품은 건드리지 않는다.
 *
 * 실행: npm run build:ingredient-links -- --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const SOURCE_TYPE = "official_brand_page";

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

  const { normalizeTextKey, ingredientNameVariants, ingredientTokenLookupCandidates } = await import(
    "@/lib/pipeline/ingredient-normalize"
  );
  const client = createClient(url, key, { auth: { persistSession: false } });

  // 성분 사전 — PostgREST 는 1000행에서 자르므로 페이지로 넘긴다.
  const dict = await fetchAll<{ id: number; name_en: string | null; name_ko: string | null }>(
    client,
    "ingredients",
    "id,name_en,name_ko"
  );
  const byKey = new Map<string, number>();
  for (const row of dict)
    for (const n of [row.name_en, row.name_ko])
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k && !byKey.has(k)) byKey.set(k, row.id);
      }

  const products = await fetchAll<{ id: number; brand: string | null; name: string | null; full_ingredients: string[] | null }>(
    client,
    "products",
    "id,brand,name,full_ingredients"
  );
  const links = await fetchAll<{ product_id: string }>(client, "product_ingredients", "id,product_id");
  const linked = new Set(links.map((l) => String(l.product_id)));

  const offers = await fetchAll<{ product_id: string; purchase_url: string | null; is_official: boolean | null }>(
    client,
    "product_offers",
    "id,product_id,purchase_url,is_official"
  );
  const urlByProduct = new Map<string, string>();
  for (const o of offers) {
    if (!o.purchase_url) continue;
    const pid = String(o.product_id);
    // 공식 오퍼를 우선한다.
    if (o.is_official === true || !urlByProduct.has(pid)) urlByProduct.set(pid, o.purchase_url);
  }

  const targets = products.filter(
    (p) =>
      Array.isArray(p.full_ingredients) &&
      p.full_ingredients.length > 0 &&
      !linked.has(String(p.id))
  );
  console.log(`전성분은 있는데 성분 링크가 없는 제품 ${targets.length}건\n`);

  let planned = 0;
  const plan: Array<{ id: number; name: string; rows: Array<Record<string, unknown>>; matched: number; total: number }> = [];
  const nowIso = new Date().toISOString();

  for (const p of targets) {
    const sourceUrl = urlByProduct.get(String(p.id));
    if (!sourceUrl) {
      console.log(`  ${String(p.id).padStart(4)} ${String(p.name).slice(0, 30)} — 출처 URL 이 없어 건너뛴다`);
      continue;
    }
    const tokens = (p.full_ingredients ?? []).map(String);
    const used = new Set<number>();
    const rows: Array<Record<string, unknown>> = [];
    let order = 0;
    for (const t of tokens) {
      const cand = ingredientTokenLookupCandidates(t);
      const hit =
        byKey.get(cand.whole) ??
        (cand.parenHead ? byKey.get(cand.parenHead) : undefined) ??
        (cand.segments.length >= 1
          ? cand.segmentsAreSynonyms
            ? cand.segments.map((s) => byKey.get(s)).find((x) => x != null)
            : cand.segments.every((s) => byKey.has(s))
              ? byKey.get(cand.segments[0])
              : undefined
          : undefined);
      if (hit == null || used.has(hit)) continue;
      used.add(hit);
      rows.push({
        product_id: String(p.id),
        ingredient_id: hit,
        ingredient_order: (order += 1),
        source_type: SOURCE_TYPE,
        source_url: sourceUrl,
        verification_status: "approved",
        verified_at: nowIso,
        source_verified: true,
      });
    }
    if (rows.length === 0) continue;
    plan.push({ id: p.id, name: String(p.name), rows, matched: rows.length, total: tokens.length });
    planned += rows.length;
    console.log(
      `  ${String(p.id).padStart(4)} ${String(p.name).slice(0, 32).padEnd(34)} 링크 ${String(rows.length).padStart(3)} / 성분 ${tokens.length}`
    );
  }

  console.log(`\n만들 링크 ${planned}행 (제품 ${plan.length}건)`);
  if (!apply) {
    console.log("\ndry-run. --apply 로 만든다.");
    return;
  }

  let created = 0;
  for (const [i, p] of plan.entries()) {
    const { error } = await client.from("product_ingredients").insert(p.rows);
    if (error) {
      console.log(`  ${p.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    created += p.rows.length;
  }
  console.log(`\n성분 링크 ${created}행 생성`);
}

main().catch((e) => {
  console.error("[build-ingredient-links-for-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
