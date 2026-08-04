/**
 * 전성분이 **없거나 오염된** 제품을 브랜드 글로벌 스토어에서 다시 채운다.
 *
 * ## 왜 이 스크립트가 따로 필요한가
 *
 * 수집기(`collect-tier1-shopify`)는 `verified_at IS NULL` 인 제품만 대상으로 삼는다.
 * 그런데 추천 풀 조건은 `active = true AND verified_at IS NOT NULL` 이다.
 * **수집기가 정확히 «라이브인 제품» 을 건너뛴다** — 활성 제품의 데이터 구멍은
 * 구조적으로 메워지지 않는다.
 *
 * 2026-07-30 실측: 추천 풀 17건 중 2건(COSRX Snail Mucin 96% Essence ·
 * Advanced Snail 92 All in One Cream)이 `full_ingredients` 가 비어 있었다. 그 상태면
 * 알레르겐 검사가 `key_ingredients` 2개(`Snail Secretion Filtrate` ·
 * `Sodium Hyaluronate`)만 보므로, 향료 알레르기를 입력해도 «알레르겐 없음» 이 된다.
 *
 * 그래서 대상 선정을 **`verified_at` 이 아니라 «데이터가 비었는가»** 로 한다.
 *
 * 또 하나 — `repair-contaminated-full-ingredients` 는 `product_offers` 의 URL 에서
 * 재수집하는데, 그게 국내몰(`cosrx.co.kr`)이나 올리브영이면 전성분 구간이 없다.
 * 이 스크립트는 **브랜드 글로벌 스토어**에서 가져온다.
 *
 * ## 안전장치
 *
 *   · `--apply` 없이는 아무것도 쓰지 않는다.
 *   · 쓰기 전 현재 값을 `backups/` 에 복원용 SQL 로 남긴다.
 *   · 제품명 대조가 `NAME_MATCH_MIN` 미만이면 연결하지 않는다 — 엉뚱한 제품의
 *     성분을 붙이는 것이 빈 상태보다 나쁘다.
 *   · 새 값이 `sanitizeIngredientList` 를 통과할 때만 쓴다. 통과 못 하면 **기존 값을
 *     그대로 둔다** — 비우면 안전 필터가 `key_ingredients` 만 보게 되어 더 위험하다.
 *   · 추천 풀에 있는 제품을 먼저 처리한다. 첫 건 실패 시 중단한다.
 *
 * 실행: npm run refill:full-ingredients -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import {
  sanitizeIngredientList,
  validateIngredientList,
} from "../src/lib/catalog/validateIngredientList";
import {
  findBrandStore,
  nameSimilarity,
  nameTokens,
  NAME_MATCH_MIN,
} from "../src/lib/catalog/brandGlobalStores";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";

type Row = {
  id: number;
  name: string | null;
  brand: string | null;
  active: boolean | null;
  verified_at: string | null;
  full_ingredients: string[] | string | null;
};

type ShopifyProduct = { id: number; title: string; handle: string };

function isInRecommendationPool(r: Row): boolean {
  return r.active === true && r.verified_at != null;
}

function asText(v: Row["full_ingredients"]): string {
  if (Array.isArray(v)) return v.join(", ");
  return String(v ?? "");
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** PostgREST 는 1000행에서 자른다. 페이지로 넘긴다. */
async function fetchAll(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,name,brand,active,verified_at,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`products: ${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function getText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

/** 브랜드 스토어 전체 카탈로그. 브랜드당 한 번만 받아서 재사용한다. */
async function fetchCatalog(domain: string): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page += 1) {
    try {
      const r = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
        headers: { "User-Agent": UA },
      });
      if (!r.ok) break;
      const j = (await r.json()) as { products?: ShopifyProduct[] };
      const batch = j.products ?? [];
      out.push(...batch);
      if (batch.length < 250) break;
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 700));
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

  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const client = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAll(client);

  // 대상: 전성분이 **없거나 검증을 통과하지 못하는** 것. `verified_at` 은 보지 않는다.
  const needsWork = rows.filter((r) => {
    const t = asText(r.full_ingredients).trim();
    return t.length === 0 || !validateIngredientList(t).ok;
  });
  // 브랜드 스토어를 아는 것만 처리할 수 있다.
  const targets = needsWork
    .filter((r) => findBrandStore(r.brand) != null)
    .sort((a, b) => {
      // 추천 풀에 있는 것이 먼저 — 지금 라이브인 빈틈을 먼저 닫는다.
      const pa = isInRecommendationPool(a) ? 0 : 1;
      const pb = isInRecommendationPool(b) ? 0 : 1;
      return pa - pb || a.id - b.id;
    });

  console.log(`전성분이 없거나 오염된 제품 ${needsWork.length}행`);
  console.log(`  그중 브랜드 스토어를 아는 것 ${targets.length}행`);
  console.log(`  그중 추천 풀에 있는 것 ${targets.filter(isInRecommendationPool).length}행\n`);

  const catalogCache = new Map<string, ShopifyProduct[]>();
  const planned: Array<{ row: Row; before: string[]; after: string[]; url: string; sim: number }> = [];
  const skipped: Array<{ row: Row; why: string }> = [];

  for (const r of targets) {
    const domain = findBrandStore(r.brand)!;
    if (!catalogCache.has(domain)) {
      catalogCache.set(domain, await fetchCatalog(domain));
      console.log(`  ${domain} 카탈로그 ${catalogCache.get(domain)!.length}건`);
    }
    const catalog = catalogCache.get(domain)!;
    if (catalog.length === 0) {
      skipped.push({ row: r, why: `${domain} 카탈로그를 받지 못함` });
      continue;
    }

    const mine = nameTokens(String(r.name ?? ""), String(r.brand ?? ""));
    let best: { p: ShopifyProduct; sim: number } | null = null;
    for (const p of catalog) {
      const sim = nameSimilarity(mine, nameTokens(p.title, String(r.brand ?? "")));
      if (!best || sim > best.sim) best = { p, sim };
    }
    if (!best || best.sim < NAME_MATCH_MIN) {
      skipped.push({ row: r, why: `제품명 대조 미달 (최고 ${best ? best.sim.toFixed(2) : "0"})` });
      continue;
    }

    const pageUrl = `https://${domain}/products/${best.p.handle}`;
    const raw = extractLabeledIngredientsRaw(await getText(pageUrl));
    if (!raw) {
      skipped.push({ row: r, why: "페이지에서 전성분 구간을 못 찾음" });
      continue;
    }
    const v = sanitizeIngredientList(raw.raw);
    if (!v.ok) {
      skipped.push({ row: r, why: `정제 후에도 반려 — ${v.reason}` });
      continue;
    }
    const before = Array.isArray(r.full_ingredients)
      ? r.full_ingredients.map(String)
      : asText(r.full_ingredients)
        ? [asText(r.full_ingredients)]
        : [];
    planned.push({ row: r, before, after: v.tokens, url: pageUrl, sim: best.sim });
  }

  console.log(`\n채울 수 있는 것 ${planned.length}행 · 못 하는 것 ${skipped.length}행\n`);
  console.log("── 채울 수 있는 것 ──");
  for (const p of planned)
    console.log(
      `  ${isInRecommendationPool(p.row) ? "풀" : "  "} ${String(p.row.id).padStart(4)} ` +
        `${String(p.row.brand).padEnd(16)} ${String(p.row.name).slice(0, 34).padEnd(36)} ` +
        `${p.before.length} → ${p.after.length}개 (대조 ${p.sim.toFixed(2)})`
    );
  console.log("\n── 못 하는 것 ──");
  for (const s of skipped.slice(0, 40))
    console.log(
      `  ${isInRecommendationPool(s.row) ? "풀" : "  "} ${String(s.row.id).padStart(4)} ` +
        `${String(s.row.brand).padEnd(16)} ${String(s.row.name).slice(0, 30).padEnd(32)} ${s.why}`
    );
  if (skipped.length > 40) console.log(`  … 외 ${skipped.length - 40}행`);

  if (!apply) {
    console.log("\ndry-run. --apply 를 붙이면 실제로 채운다.");
    return;
  }
  if (planned.length === 0) return;

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_full-ingredients-보강전.sql`;
  const arr = (xs: string[]) =>
    xs.length === 0
      ? "NULL"
      : `'{${xs.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}'`;
  writeFileSync(
    path,
    [
      `-- full_ingredients 보강 전 스냅샷 · ${planned.length}행`,
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...planned.map((p) => `UPDATE products SET full_ingredients = ${arr(p.before)} WHERE id = ${p.row.id};`),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let updated = 0;
  for (const [i, p] of planned.entries()) {
    const { data, error } = await client
      .from("products")
      .update({ full_ingredients: p.after })
      .eq("id", p.row.id)
      .select("id");
    if (error) {
      console.log(`  ${p.row.id} 실패: ${error.code} ${error.message}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    if ((data ?? []).length > 0) updated += 1;
  }
  console.log(`\n보강 ${updated}행`);
  console.log("검증: npm run check:production-full-ingredients");
}

main().catch((e) => {
  console.error("[refill-full-ingredients-from-brand-store] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
