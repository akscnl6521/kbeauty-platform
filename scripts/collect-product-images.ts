/**
 * 추천에 나오는 제품의 **공식 이미지 URL** 을 브랜드 스토어에서 수집한다.
 *
 * 2026-08-04 — 사용자 지적 «이미지가 안 보인다». 확인해 보니 이미지는 **처음부터
 * 뜬 적이 없었다.** `catalog_product_media` 테이블이 Production 에 없고, 있어도
 * 추천 화면까지 오는 배선이 없다.
 *
 * 이 스크립트는 그중 **데이터** 를 맡는다. 브랜드 Shopify 스토어의 `/products.json`
 * 이 `images[].src` 로 공식 제품 사진을 공개하므로, 제품명 대조로 짝지어 모은다.
 *
 * ## 지어내지 않는다
 *
 * 제품명 대조가 `NAME_MATCH_MIN` 미만이면 **붙이지 않는다.** 엉뚱한 제품 사진을
 * 보여주는 것은 사진이 없는 것보다 나쁘다 — 사용자가 다른 제품을 사게 된다.
 * 이미지 URL 이 실제로 열리는지(HTTP 200 · content-type 이미지)도 확인한다.
 *
 * `--apply` 없이는 아무것도 쓰지 않는다. `catalog_product_media` 가 아직 없으면
 * 수집 결과만 artifact 로 남기고 «테이블이 필요하다» 고 알린다.
 *
 * 실행: npm run collect:product-images -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dropSiteWideImages } from "../src/lib/catalog/mallProductData";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import {
  findBrandStore,
  nameSimilarity,
  nameTokens,
  NAME_MATCH_MIN,
} from "../src/lib/catalog/brandGlobalStores";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";

type Product = {
  id: number;
  brand: string | null;
  name: string | null;
  active: boolean | null;
  verified_at: string | null;
};
type ShopifyProduct = {
  title: string;
  handle: string;
  images?: Array<{ src?: string; width?: number; height?: number }>;
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
    await new Promise((r) => setTimeout(r, 600));
  }
  return out;
}

/** 이미지가 실제로 열리는지 — 죽은 링크를 저장하면 화면이 깨진 채로 남는다. */
async function imageIsLive(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    if (!r.ok) return false;
    return (r.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: Production ref 가 아니다.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<Product>(client, "products", "id,brand,name,active,verified_at");

  // 추천에 실제로 나오는 제품을 먼저 채운다 — 사용자가 보는 화면이 거기다.
  const pool = products.filter((p) => p.active === true && p.verified_at != null);
  const rest = products.filter((p) => !(p.active === true && p.verified_at != null));
  const targets = [...pool, ...rest].filter((p) => findBrandStore(p.brand) != null);

  console.log(`대상 ${targets.length}건 (추천 풀 ${pool.filter((p) => findBrandStore(p.brand)).length}건 우선)\n`);

  const catalogs = new Map<string, ShopifyProduct[]>();
  const found: Array<{
    productId: number;
    brand: string;
    name: string;
    imageUrl: string;
    sourcePage: string;
    similarity: number;
    inPool: boolean;
  }> = [];
  const missed: Array<{ productId: number; brand: string; name: string; why: string }> = [];

  for (const p of targets) {
    const domain = findBrandStore(p.brand)!;
    if (!catalogs.has(domain)) {
      catalogs.set(domain, await fetchCatalog(domain));
      console.log(`  ${domain} 카탈로그 ${catalogs.get(domain)!.length}건`);
    }
    const catalog = catalogs.get(domain)!;
    const brand = String(p.brand ?? "");
    const want = nameTokens(String(p.name ?? ""), brand);

    let best: { sp: ShopifyProduct; sim: number } | null = null;
    for (const sp of catalog) {
      const sim = nameSimilarity(want, nameTokens(sp.title, brand));
      if (!best || sim > best.sim) best = { sp, sim };
    }
    if (!best || best.sim < NAME_MATCH_MIN) {
      missed.push({ productId: p.id, brand, name: String(p.name), why: `제품명 대조 미달 (${best ? best.sim.toFixed(2) : "0"})` });
      continue;
    }
    const src = best.sp.images?.find((i) => i.src)?.src;
    if (!src) {
      missed.push({ productId: p.id, brand, name: String(p.name), why: "스토어에 이미지가 없음" });
      continue;
    }
    const live = await imageIsLive(src);
    if (!live) {
      missed.push({ productId: p.id, brand, name: String(p.name), why: "이미지 URL 이 열리지 않음" });
      continue;
    }
    found.push({
      productId: p.id,
      brand,
      name: String(p.name),
      imageUrl: src,
      sourcePage: `https://${domain}/products/${best.sp.handle}`,
      similarity: Number(best.sim.toFixed(2)),
      inPool: p.active === true && p.verified_at != null,
    });
  }

  // **서로 다른 제품이 같은 사진을 달면 안 된다.**
  //
  // 이 수집기는 스토어 제품명을 «유사도» 로 대조하므로, 이름이 겹치는 두 제품이
  // 같은 스토어 항목에 붙을 수 있다. 2026-08-08 Production 실측에서 실제로 그랬다:
  //
  //   Advanced Snail 92 All in One Cream  ↔  Black Snail All In One Cream
  //   Peach 70 Niacin Serum               ↔  Peach 70 Niacin Serum Glow
  //
  // 사진이 없는 것보다 **다른 제품 사진이 붙는 쪽이 훨씬 나쁘다** — 그걸 보고
  // 엉뚱한 제품을 산다. 겹치면 양쪽 다 버리고, 제품 페이지에서 직접 받는
  // `collect:images-from-offer` 로 넘긴다.
  {
    const { kept, dropped } = dropSiteWideImages(found);
    for (const d of dropped)
      console.log(`  !! 제품 ${d.count}건이 같은 사진을 가리킨다 — 양쪽 다 버린다: ${d.imageUrl.slice(0, 70)}`);
    found.length = 0;
    found.push(...kept);
  }

  const poolFound = found.filter((f) => f.inPool).length;
  console.log(`\n확보 ${found.length}건 (추천 풀 ${poolFound}건) · 못 찾음 ${missed.length}건\n`);
  for (const f of found.filter((x) => x.inPool))
    console.log(`  풀 ${String(f.productId).padStart(4)} ${f.brand.padEnd(17)} ${f.name.slice(0, 32).padEnd(34)} 대조 ${f.similarity}`);

  mkdirSync("artifacts/product-images", { recursive: true });
  const path = "artifacts/product-images/collected.json";
  writeFileSync(
    path,
    JSON.stringify({ checkedAt: new Date().toISOString(), found, missed }, null, 2),
    "utf8"
  );
  console.log(`\n결과 저장: ${path}`);

  // 저장할 곳이 있는지 확인 — 없으면 여기서 멈추고 무엇이 필요한지 알린다.
  const { error: probe } = await client.from("catalog_product_media").select("id").limit(1);
  if (probe) {
    console.log(`\n!! catalog_product_media 테이블이 없다 (${probe.message.slice(0, 60)})`);
    console.log("   Production 에 마이그레이션을 적용해야 저장할 수 있다.");
    console.log("   수집 결과는 위 artifact 에 남겼으니, 테이블이 생기면 --apply 로 바로 넣는다.");
    return;
  }

  if (!apply) {
    console.log("\ndry-run. --apply 로 catalog_product_media 에 적재한다.");
    return;
  }

  let inserted = 0;
  const nowIso = new Date().toISOString();
  for (const f of found) {
    const { data: exists } = await client
      .from("catalog_product_media")
      .select("id")
      .eq("product_id", f.productId)
      .eq("is_primary", true)
      .limit(1);
    if ((exists ?? []).length > 0) continue;

    const { error } = await client.from("catalog_product_media").insert({
      product_id: f.productId,
      media_type: "product_front",
      image_url: f.imageUrl,
      canonical_image_url: f.imageUrl,
      source_page_url: f.sourcePage,
      source_domain: new URL(f.sourcePage).hostname,
      source_type: "official_brand",
      source_tier: 1,
      is_official_source: true,
      usage_rights_status: "licensed_copy_allowed",
      is_accessible: true,
      is_primary: true,
      display_order: 0,
      validation_status: "verified",
      validation_errors: [],
      verified_at: nowIso,
    });
    if (error) {
      console.log(`  ${f.productId} 실패: ${error.code} ${error.message.slice(0, 60)}`);
      continue;
    }
    inserted += 1;
  }
  console.log(`\n적재 ${inserted}건`);
}

main().catch((e) => {
  console.error("[collect-product-images] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
