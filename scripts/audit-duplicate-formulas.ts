/**
 * 추천 풀에서 **전성분이 글자까지 같은 제품 쌍**을 찾는다.
 *
 * ## 왜 이걸 봐야 하나
 *
 * 같은 브랜드에서 전성분이 완전히 같으면 셋 중 하나다:
 *
 *   1. **같은 제품이 두 번 등록됐다** — Top 5 에 같은 제품이 두 번 나온다.
 *   2. **용량만 다른 같은 제형** — 150ml/160ml. 카탈로그에는 둘 다 맞지만
 *      한 화면에 같이 뜨면 고를 것이 하나 줄어든다.
 *   3. **한쪽에 다른 제품의 전성분이 들어갔다** — 이게 제일 위험하다.
 *      알레르기·회피 판정이 **엉뚱한 제형**을 보고 내려진다.
 *
 * 셋을 가르는 단서는 `product_ingredients.source_url` 이다. 두 제품의 성분
 * 출처가 **다른 제품 페이지**를 가리키면 3번이다. 2026-08-08 Production 실측:
 *
 *     77 «Black Snail All In One Cream»
 *        성분 출처 → cosrx.com/products/advanced-snail-92-all-in-one-cream
 *
 * 즉 Black Snail 의 안전 판정이 Advanced Snail 92 의 성분으로 내려지고 있었다.
 *
 * ## 지어내지 않는다
 *
 * 이 스크립트는 **찾아서 보여줄 뿐 고치지 않는다.** 어느 쪽이 맞는지는 출처를
 * 봐야 알 수 있고, 그 판단을 자동화하면 멀쩡한 제품을 지우게 된다.
 *
 * 실행: npm run check:duplicate-formulas
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
/** 성분이 너무 적으면 «같다» 가 우연일 수 있다. */
const MIN_INGREDIENTS = 5;

type ProductRow = {
  id: number;
  brand: string | null;
  name: string | null;
  slug: string | null;
  active: boolean | null;
  verified_at: string | null;
  full_ingredients: unknown;
};

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  // PostgREST 는 1000행에서 자른다.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function formulaKey(p: ProductRow): string | null {
  const fi = Array.isArray(p.full_ingredients) ? (p.full_ingredients as unknown[]) : [];
  if (fi.length < MIN_INGREDIENTS) return null;
  const brand = String(p.brand ?? "").trim().toLowerCase();
  const list = fi.map((x) => String(x).replace(/\s+/g, "").toLowerCase()).join(",");
  return `${brand}||${list}`;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }
  console.log(`대상 DB: Production (${ref})\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<ProductRow>(
    client,
    "products",
    "id,brand,name,slug,active,verified_at,full_ingredients"
  );
  const pool = products.filter((p) => p.active === true && p.verified_at != null);

  const links = await fetchAll<{ product_id: string; source_url: string | null }>(
    client,
    "product_ingredients",
    "id,product_id,source_url"
  );
  const sourceByProduct = new Map<string, string>();
  for (const l of links) {
    const pid = String(l.product_id);
    if (l.source_url && !sourceByProduct.has(pid)) sourceByProduct.set(pid, l.source_url);
  }

  const groups = new Map<string, ProductRow[]>();
  for (const p of pool) {
    const k = formulaKey(p);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  const findings: Array<{ ids: number[]; kind: string; detail: string }> = [];
  for (const [, g] of groups) {
    if (g.length < 2) continue;
    const sources = g.map((p) => sourceByProduct.get(String(p.id)) ?? "");
    const distinctSources = new Set(sources.filter(Boolean));

    // 출처가 하나뿐이면 같은 페이지에서 온 것 — 같은 제품이 두 번 등록됐다.
    // 출처가 여럿인데 성분이 똑같으면, 한쪽이 남의 성분을 들고 있을 수 있다.
    const kind =
      distinctSources.size <= 1 ? "같은 제품이 두 번 등록됨" : "출처는 다른데 전성분이 똑같음 — 한쪽이 남의 성분일 수 있다";

    const count = (g[0].full_ingredients as unknown[]).length;
    console.log(`\n[${kind}] 성분 ${count}개 동일`);
    for (const p of g)
      console.log(
        `   ${String(p.id).padStart(4)} ${String(p.brand).padEnd(10)} «${String(p.name).slice(0, 38)}»\n` +
          `        slug=${p.slug}\n` +
          `        성분 출처=${sourceByProduct.get(String(p.id)) ?? "(없음)"}`
      );
    findings.push({ ids: g.map((p) => p.id), kind, detail: `성분 ${count}개 동일` });
  }

  console.log(`\n추천 풀 ${pool.length}건 · 전성분이 똑같은 그룹 ${findings.length}개`);
  if (findings.length === 0) console.log("이상 없음.");

  mkdirSync("artifacts/production-audit", { recursive: true });
  writeFileSync(
    "artifacts/production-audit/duplicate-formulas.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), poolSize: pool.length, findings }, null, 2),
    "utf8"
  );
  console.log("결과 저장: artifacts/production-audit/duplicate-formulas.json");
  console.log("\n고치지 않는다 — 어느 쪽이 맞는지는 출처를 보고 사람이 판단한다.");
}

main().catch((e) => {
  console.error("[audit-duplicate-formulas] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
