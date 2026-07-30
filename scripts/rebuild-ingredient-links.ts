/**
 * `official_brand_page` 성분 링크를 **현재 `full_ingredients` 기준으로 다시 만든다.**
 *
 * 왜 필요한가 — 반영 스크립트에 «링크가 이미 있으면 건너뜀» 가드를 뒀는데, 그 뒤로
 * 추출기를 여러 번 고쳐 전성분이 바뀌었다. 그래서 링크는 옛 토큰 기준으로 남아
 * 게이트 판정이 실제 데이터와 어긋난다(DASHBOARD §35).
 *
 * 하는 일
 *   1. 대상 제품의 `official_brand_page` 링크를 파일로 백업
 *   2. 그 링크만 삭제 — `admin_entry` 등 다른 출처는 건드리지 않는다
 *   3. 현재 `full_ingredients` 로 다시 만든다 (순번은 남은 링크 뒤로 이어붙임)
 *
 * 실행: npm run rebuild:ingredient-links -- --apply
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const SOURCE_TYPE = "official_brand_page";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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

  // `product_ingredients_approved_source_chk` 는 approved 링크에 출처 URL 을 요구한다.
  // 수집 결과에서 제품별 판매 페이지 URL 을 가져온다.
  const artifact = JSON.parse(
    readFileSync("artifacts/tier1-collect/shopify-2026-07-28.json", "utf8")
  ) as { results: Array<{ productId: number; purchaseUrl: string | null }> };
  const urlByProduct = new Map<number, string>();
  for (const r of artifact.results) if (r.purchaseUrl) urlByProduct.set(r.productId, r.purchaseUrl);

  // 사전 (부연 괄호 변형 포함)
  const dict = await fetchIngredientDict(client);
  const byKey = new Map<string, number>();
  for (const r of dict) {
    for (const n of [r.name_en, r.name_ko]) {
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k && !byKey.has(k)) byKey.set(k, r.id);
      }
    }
  }
  console.log(`사전 키 ${byKey.size}개`);

  // 대상은 **수집 결과 기준**으로 잡는다. 기존 링크로 잡으면 한 번 지운 뒤에는
  // 목록이 비어 재생성이 안 된다 (2026-07-30 에 실제로 그렇게 567행이 지워진 채
  // 0건만 남았다).
  const productIds = [...urlByProduct.keys()].map(String);
  const { count: existingLinks } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true })
    .eq("source_type", SOURCE_TYPE);
  console.log(`대상 제품 ${productIds.length}개 · 기존 ${SOURCE_TYPE} 링크 ${existingLinks}행`);

  const { data: prods } = await client
    .from("products")
    .select("id,name,full_ingredients")
    .in("id", productIds);

  const plans: Array<{ id: number; name: string; tokens: string[]; matched: number }> = [];
  for (const p of (prods ?? []) as Array<{ id: number; name: string; full_ingredients: string[] | null }>) {
    const tokens = Array.isArray(p.full_ingredients) ? p.full_ingredients.map(String) : [];
    let matched = 0;
    for (const t of tokens) {
      const cand = ingredientTokenLookupCandidates(t);
      const hit =
        byKey.get(cand.whole) ??
        (cand.segments.length >= 2 && cand.segments.every((s) => byKey.has(s))
          ? byKey.get(cand.segments[0])
          : undefined);
      if (hit) matched += 1;
    }
    plans.push({ id: p.id, name: String(p.name), tokens, matched });
  }
  plans.sort((a, b) => a.tokens.length - a.matched - (b.tokens.length - b.matched));

  console.log("\n제품별 (미매칭 적은 순):");
  for (const p of plans)
    console.log(
      `  ${String(p.id).padStart(4)} ${p.name.slice(0, 32).padEnd(34)} 토큰 ${String(p.tokens.length).padStart(3)} · 매칭 ${String(p.matched).padStart(3)} · 미매칭 ${p.tokens.length - p.matched}`
    );
  console.log(`\n미매칭 0건 제품 ${plans.filter((p) => p.tokens.length === p.matched).length}개`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 재생성한다.");
    return;
  }

  // 백업
  const { data: full } = await client
    .from("product_ingredients")
    .select("*")
    .eq("source_type", SOURCE_TYPE);
  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_ingredient-links-재생성전.sql`;
  const cols = Object.keys((full ?? [])[0] ?? {});
  const lit = (v: unknown) =>
    v === null || v === undefined
      ? "NULL"
      : typeof v === "number"
        ? String(v)
        : typeof v === "boolean"
          ? v ? "TRUE" : "FALSE"
          : `'${String(v).replace(/'/g, "''")}'`;
  writeFileSync(
    path,
    [
      `-- ${SOURCE_TYPE} 링크 재생성 전 스냅샷 · ${(full ?? []).length}행`,
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...(full ?? []).map(
        (r) =>
          `INSERT INTO product_ingredients (${cols.join(", ")}) VALUES (${cols
            .map((c) => lit((r as Record<string, unknown>)[c]))
            .join(", ")});`
      ),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  const nowIso = new Date().toISOString();
  let removed = 0;
  let created = 0;

  for (const p of plans) {
    // 이 제품의 official_brand_page 링크만 지운다
    const { data: del } = await client
      .from("product_ingredients")
      .delete()
      .eq("product_id", String(p.id))
      .eq("source_type", SOURCE_TYPE)
      .select("id");
    removed += (del ?? []).length;

    // 남은 링크(admin_entry 등)의 최대 순번 뒤로 이어붙인다
    const { data: rest } = await client
      .from("product_ingredients")
      .select("ingredient_order")
      .eq("product_id", String(p.id))
      .order("ingredient_order", { ascending: false })
      .limit(1);
    let order = Number((rest ?? [])[0]?.ingredient_order ?? 0);

    const used = new Set<number>();
    const rows: Array<Record<string, unknown>> = [];
    for (const t of p.tokens) {
      const cand = ingredientTokenLookupCandidates(t);
      const hit =
        byKey.get(cand.whole) ??
        (cand.segments.length >= 2 && cand.segments.every((s) => byKey.has(s))
          ? byKey.get(cand.segments[0])
          : undefined);
      if (!hit || used.has(hit)) continue;
      used.add(hit);
      rows.push({
        product_id: String(p.id),
        ingredient_id: hit,
        ingredient_order: (order += 1),
        source_type: SOURCE_TYPE,
        source_url: urlByProduct.get(p.id) ?? null,
        verification_status: "approved",
        verified_at: nowIso,
        source_verified: true,
      });
    }
    if (rows.length > 0) {
      const { error } = await client.from("product_ingredients").insert(rows);
      if (error) console.log(`  ${p.id} 삽입 실패: ${error.code} ${error.message}`);
      else created += rows.length;
    }
  }

  const { count } = await client
    .from("product_ingredients")
    .select("*", { count: "exact", head: true });
  console.log(`\n삭제 ${removed} · 생성 ${created} · 링크 총 ${count}행`);
}

main().catch((e) => {
  console.error("[rebuild-ingredient-links] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
