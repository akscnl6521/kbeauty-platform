/**
 * 추천 풀 제품 중 **이미지가 없는 것**을, 그 제품의 공식 구매 링크 페이지에서
 * 대표 이미지를 읽어 채운다.
 *
 * ## 기존 수집기로는 안 되는 이유
 *
 * `collect-product-images` 는 브랜드의 **글로벌 Shopify 스토어**를 훑어 제품명을
 * 대조한다. 달바처럼 글로벌 Shopify 가 없고 국내몰만 있는 브랜드는 대상이 아니다.
 * 그리고 그 국내몰의 JSON-LD 에는 `image` 가 없다.
 *
 * 여기서는 훨씬 직접적인 경로를 쓴다 — **그 제품의 오퍼 URL 이 곧 그 제품 페이지**다.
 * 제품명 대조가 필요 없으니 엉뚱한 제품 사진이 붙을 여지도 없다.
 *
 * ## 지어내지 않는다
 *
 *   · 이미지 URL 은 그 제품 페이지가 내세운 것만 쓴다. 만들지 않는다.
 *   · **여러 제품이 같은 이미지를 가리키면 전부 버린다** — 사이트 공통 로고다.
 *     서로 다른 제품이 같은 그림을 달고 나오는 건 사진이 없는 것보다 나쁘다.
 *   · 실제로 열리는지(HTTP 200 + image/*) 확인하고 담는다.
 *   · 이미 이미지가 있는 제품은 건드리지 않는다.
 *
 * 실행: npm run collect:images-from-offer            # dry-run
 *       npm run collect:images-from-offer -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";
import { extractProductImageUrl, dropSiteWideImages } from "../src/lib/catalog/mallProductData";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; KBeautyMatchCatalog/1.0)";
const TIMEOUT_MS = 15_000;

type ProductRow = { id: number; brand: string | null; name: string | null; active: boolean | null; verified_at: string | null };

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

async function imageIsLive(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    return /^image\//i.test(r.headers.get("content-type") ?? "");
  } catch {
    return false;
  }
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
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }
  console.log(`대상 DB: Production (${ref})\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const products = await fetchAll<ProductRow>(client, "products", "id,brand,name,active,verified_at");
  const pool = products.filter((p) => p.active === true && p.verified_at != null);

  const media = await fetchAll<{ product_id: string }>(client, "catalog_product_media", "id,product_id");
  const haveImage = new Set(media.map((m) => String(m.product_id)));

  const offers = await fetchAll<{ product_id: string; purchase_url: string | null; is_official: boolean | null }>(
    client,
    "product_offers",
    "id,product_id,purchase_url,is_official"
  );
  const pageByProduct = new Map<string, string>();
  for (const o of offers) {
    if (!o.purchase_url) continue;
    const pid = String(o.product_id);
    // 공식 오퍼를 우선한다 — 브랜드 자사몰 페이지가 대표 이미지를 제일 잘 준다.
    if (o.is_official === true || !pageByProduct.has(pid)) pageByProduct.set(pid, o.purchase_url);
  }

  const targets = pool.filter((p) => !haveImage.has(String(p.id)) && pageByProduct.has(String(p.id)));
  console.log(`추천 풀 ${pool.length}건 · 이미지 없음 ${pool.filter((p) => !haveImage.has(String(p.id))).length}건 · 페이지가 있는 것 ${targets.length}건\n`);

  const found: Array<{ productId: number; brand: string; name: string; imageUrl: string; sourcePage: string }> = [];
  const missed: Array<{ productId: number; name: string; why: string }> = [];

  for (const p of targets) {
    const page = pageByProduct.get(String(p.id))!;
    let html = "";
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const r = await fetch(page, { headers: { "user-agent": UA }, redirect: "follow", signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) {
        missed.push({ productId: p.id, name: String(p.name), why: `페이지 HTTP ${r.status}` });
        continue;
      }
      // 국내몰은 EUC-KR 로 주는 곳이 많다.
      html = await decodeHtmlBody(r);
    } catch {
      missed.push({ productId: p.id, name: String(p.name), why: "페이지를 못 받음" });
      continue;
    }

    const img = extractProductImageUrl(html);
    if (!img) {
      missed.push({ productId: p.id, name: String(p.name), why: "페이지에 대표 이미지가 없음" });
      continue;
    }
    found.push({ productId: p.id, brand: String(p.brand ?? ""), name: String(p.name), imageUrl: img, sourcePage: page });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 사이트 공통 로고 걸러내기 — 같은 URL 이 둘 이상이면 전부 버린다.
  const { kept, dropped } = dropSiteWideImages(found);
  for (const d of dropped)
    console.log(`  !! 제품 ${d.count}건이 같은 이미지를 가리킨다 — 공통 로고로 보고 버린다: ${d.imageUrl.slice(0, 70)}`);

  // 실제로 열리는 것만 담는다.
  const live: typeof kept = [];
  for (const k of kept) {
    if (await imageIsLive(k.imageUrl)) live.push(k);
    else missed.push({ productId: k.productId, name: k.name, why: "이미지 URL 이 열리지 않음" });
  }

  for (const f of live)
    console.log(`  + ${String(f.productId).padStart(4)} ${f.brand.padEnd(10)} ${f.name.slice(0, 30).padEnd(32)} ${f.imageUrl.slice(0, 56)}`);
  console.log(`\n담을 이미지 ${live.length}건 · 못 얻은 것 ${missed.length}건`);
  const byWhy = new Map<string, number>();
  for (const m of missed) byWhy.set(m.why, (byWhy.get(m.why) ?? 0) + 1);
  for (const [w, n] of [...byWhy.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}건  ${w}`);

  mkdirSync("artifacts/product-images", { recursive: true });
  writeFileSync(
    "artifacts/product-images/from-offer-page.json",
    JSON.stringify({ builtAt: new Date().toISOString(), found: live, missed, dropped }, null, 2),
    "utf8"
  );

  if (!apply) {
    console.log("\ndry-run. --apply 로 담는다.");
    return;
  }

  let saved = 0;
  for (const [i, f] of live.entries()) {
    // `media_type` 은 NOT NULL 이다. 기존 행이 쓰는 값과 같게 맞춘다 —
    // 새 값을 지어내면 화면 쪽에서 이 행들만 조용히 빠진다.
    const { error } = await client.from("catalog_product_media").insert({
      product_id: String(f.productId),
      media_type: "product_front",
      image_url: f.imageUrl,
      canonical_image_url: f.imageUrl,
      source_page_url: f.sourcePage,
      source_domain: new URL(f.sourcePage).hostname,
      source_type: "official_brand",
      is_official_source: true,
      is_primary: true,
      display_order: 0,
      http_status: 200,
      is_accessible: true,
      is_fixture: false,
      // **이걸 빼면 화면에 안 뜬다.** 공개 API(`resolveVerifiedProductImageUrls`)는
      // `validation_status = "verified"` 인 행만 내보낸다. 기본값은 `discovered`
      // 라서, 넣어 놓고도 «이미지가 안 나온다» 가 된다(2026-08-08 실측).
      //
      // 여기서 «verified» 라고 쓸 근거: 그 제품의 공식 페이지가 내세운 이미지이고,
      // 실제로 열리는지(HTTP 200 + image/*) 확인했고, 여러 제품이 공유하는
      // 이미지는 버렸다. 등록 경로(`register-kr-mall-products`)와 같은 기준이다.
      validation_status: "verified",
      verified_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    });
    if (error) {
      console.log(`  ${f.productId} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    saved += 1;
  }
  console.log(`\n이미지 ${saved}건 담음`);
}

main().catch((e) => {
  console.error("[collect-images-from-offer-page] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
