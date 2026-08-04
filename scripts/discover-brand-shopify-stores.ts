/**
 * 미검증 제품을 가진 브랜드의 **글로벌 Shopify 스토어**를 찾는다.
 *
 * 검증된 경로다 — Shopify 는 `/products.json` 을 공개하므로 가격·재고가 구조화돼
 * 있고, 영문 상품명이라 DB 명과 매칭된다. 국내 Cafe24 몰은 상품명이 한국어라
 * 매칭이 안 되고, 그 문제는 별도로(네이버 쇼핑) 해결했다.
 *
 * 도메인은 **추측해서 시도하고 실제 응답으로만 판정한다.** 이름이 비슷하다고
 * 브랜드 것이라고 단정하지 않는다 — `/products.json` 이 열리고 제품이 있어야 통과.
 *
 * 읽기 전용. 결과를 artifacts 에 남긴다.
 *
 * 실행: npm run check:brand-shopify-discovery
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0)";

/** 브랜드명에서 만들어 볼 도메인 후보. 흔한 글로벌 스토어 관행을 따른다. */
function domainCandidates(brand: string): string[] {
  const flat = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dashed = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const set = new Set<string>();
  for (const base of [flat, dashed]) {
    if (base.length < 3) continue;
    set.add(`${base}.com`);
    set.add(`us.${base}.com`);
    set.add(`${base}.us`);
    set.add(`${base}global.com`);
    set.add(`${base}.co.kr`);
  }
  return [...set];
}

async function shopifyProductCount(domain: string): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(`https://${domain}/products.json?limit=5`, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { products?: unknown[] };
    if (!Array.isArray(j.products)) return null;
    return j.products.length;
  } catch {
    return null;
  }
}

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

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<{ id: number; brand: string | null; verified_at: string | null }>(
    client,
    "products",
    "id,brand,verified_at"
  );

  // 미검증 제품이 있는 브랜드를 건수 많은 순으로
  const counts = new Map<string, number>();
  for (const p of products) {
    if (p.verified_at != null) continue;
    const b = String(p.brand ?? "").trim();
    if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`미검증 제품이 있는 브랜드 ${brands.length}개\n`);

  const found: Array<{ brand: string; count: number; domain: string }> = [];
  const missing: Array<{ brand: string; count: number; tried: number }> = [];

  for (const [brand, n] of brands) {
    const cands = domainCandidates(brand);
    let hit: string | null = null;
    for (const d of cands) {
      const c = await shopifyProductCount(d);
      if (c != null && c > 0) {
        hit = d;
        break;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    if (hit) {
      found.push({ brand, count: n, domain: hit });
      console.log(`  ✔ ${brand.padEnd(20)}${String(n).padStart(3)}건  ${hit}`);
    } else {
      missing.push({ brand, count: n, tried: cands.length });
    }
  }

  console.log(`\n확보 ${found.length}개 브랜드 · ${found.reduce((s, f) => s + f.count, 0)}건`);
  console.log(`미확보 ${missing.length}개 브랜드 · ${missing.reduce((s, m) => s + m.count, 0)}건`);
  console.log("\n미확보 (건수 상위 15):");
  for (const m of missing.slice(0, 15)) console.log(`  ✗ ${m.brand.padEnd(20)}${String(m.count).padStart(3)}건`);

  mkdirSync("artifacts/brand-discovery", { recursive: true });
  const path = "artifacts/brand-discovery/shopify-stores.json";
  writeFileSync(path, JSON.stringify({ checkedAt: new Date().toISOString(), found, missing }, null, 2), "utf8");
  console.log(`\n결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[discover-brand-shopify-stores] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
