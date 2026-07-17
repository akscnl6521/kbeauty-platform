#!/usr/bin/env node
/**
 * Staging-only: banila Clean It Zero Original (id 12) KR official KRW offer.
 * Sale-checked from banila.com product_no=669 — product_sale_price, stock_number.
 * No invented KRW. Abort on Production.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const ITEM = {
  productId: 12,
  slug: "banila-co-clean-it-zero-original",
  retailer: "banila co. Official KR",
  url: "https://banila.com/product/detail.html?product_no=669",
  expectName: /클린\s*잇\s*제로\s*오리지널|Clean\s*It\s*Zero\s*Original/i,
};

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function sqlLiteral(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function dbQuery(sql) {
  if (linkedRef() === PROD) throw new Error("ABORT Production");
  const tmp = path.join(tmpdir(), `kb-banila-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, sql.replace(/\s+/g, " ").trim(), "utf8");
  try {
    return execFileSync(
      npx,
      ["supabase", "db", "query", "--linked", "--file", tmp],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function saleCheck() {
  const res = await fetch(ITEM.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    redirect: "follow",
  });
  const html = await res.text();
  const name =
    html.match(/og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    "";
  const salePrice = Number(
    html.match(/product_sale_price\s*=\s*'?(\d+)'?/i)?.[1] ||
      html.match(/sale_price\s*=\s*'?(\d+)'?/i)?.[1] ||
      0
  );
  const listPrice = Number(html.match(/product_price\s*=\s*'?(\d+)'?/i)?.[1] || 0);
  const isSoldout = /is_soldout\s*=\s*'T'/i.test(html);
  const stockRaw = html.match(/option_stock_data\s*=\s*'([^']+)'/i)?.[1];
  let stockNumber = null;
  if (stockRaw) {
    try {
      const parsed = JSON.parse(stockRaw.replace(/\\"/g, '"'));
      stockNumber = Number(parsed.stock_number);
    } catch {
      const m = stockRaw.match(/stock_number\\?":\s*(\d+)/);
      stockNumber = m ? Number(m[1]) : null;
    }
  }
  const inStock = !isSoldout && stockNumber != null && stockNumber > 0;
  const price = salePrice >= 1000 ? salePrice : listPrice;
  const nameOk = ITEM.expectName.test(name) || /오리지널.*100ml|100ml.*오리지널/i.test(html);
  return {
    http: res.status,
    finalUrl: res.url,
    name: name.slice(0, 120),
    nameOk,
    salePrice,
    listPrice,
    price,
    isSoldout,
    stockNumber,
    inStock,
    ok: res.status === 200 && nameOk && price >= 1000 && inStock,
  };
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging", ref }));
  process.exit(2);
}

const out = {
  phase: "staging_banila_krw_offer",
  productId: ITEM.productId,
  slug: ITEM.slug,
  productionTouched: false,
  inventedPrices: false,
};

try {
  const check = await saleCheck();
  out.saleCheck = check;
  if (!check.ok) {
    out.status = "sale_check_failed";
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  dbQuery(`
    delete from product_offers
    where product_id = ${ITEM.productId}
      and verification_status = 'unverified';
  `);
  dbQuery(`
    delete from product_offers
    where product_id = ${ITEM.productId}
      and retailer_country = 'KR'
      and is_official = true
      and currency = 'KRW'
      and retailer_name = ${sqlLiteral(ITEM.retailer)};
  `);
  dbQuery(`
    insert into product_offers (
      product_id, retailer_name, retailer_country, ships_to_countries,
      purchase_url, price, currency, stock_status, verification_status,
      is_official, verified_at, active, last_checked_at
    ) values (
      ${ITEM.productId}::bigint,
      ${sqlLiteral(ITEM.retailer)},
      'KR',
      array['KR']::text[],
      ${sqlLiteral(check.finalUrl || ITEM.url)},
      ${check.price},
      'KRW',
      'in_stock',
      'verified',
      true,
      now(),
      true,
      now()
    );
  `);

  out.status = "ok";
  out.priceKrw = check.price;
  out.purchaseUrl = check.finalUrl || ITEM.url;
} catch (e) {
  out.status = "error";
  out.message = String(e?.message || e).slice(0, 300);
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(out, null, 2));
