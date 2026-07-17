#!/usr/bin/env node
/**
 * Staging-only: attach sale-checked KR official KRW offers for diversity SKUs.
 * Real Cafe24 product_price only — no invented KRW. Abort on Production.
 * Banila deferred (official KR PDP not reliably parseable).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const BATCH = [
  {
    productId: 15,
    slug: "round-lab-dokdo-toner",
    retailer: "ROUND LAB Official KR",
    url: "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%86%A0%EB%84%88-200ml/22/",
    expectName: /독도\s*토너/i,
  },
  {
    productId: 13,
    slug: "anua-heartleaf-77-soothing-toner",
    retailer: "Anua Official KR",
    url: "https://anua.kr/product/new%EB%A6%AC%EB%89%B4%EC%96%BC-%EC%96%B4%EC%84%B1%EC%B4%88-77-%ED%9E%88%EC%95%8C%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%88%98%EB%B6%84-%EC%A7%84%EC%A0%95-%ED%86%A0%EB%84%88-250ml/496/",
    expectName: /어성초\s*77/i,
  },
  {
    productId: 16,
    slug: "isntree-hyaluronic-acid-watery-sun-gel",
    retailer: "Isntree Official KR",
    url: "https://isntree.com/product/%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%9B%8C%ED%84%B0%EB%A6%AC-%EC%84%A0-%EC%A0%A4-50ml/145/",
    expectName: /워터리\s*선\s*젤/i,
  },
  {
    productId: 14,
    slug: "beauty-of-joseon-glow-serum-propolis-niacinamide",
    retailer: "Beauty of Joseon Official KR",
    url: "https://beautyofjoseon.co.kr/product/%EA%B4%91%EC%B1%84%ED%94%84%EB%A1%9C%ED%8F%B4%EB%A6%AC%EC%8A%A4%EC%84%B8%EB%9F%BC-%ED%94%84%EB%A1%9C%ED%8F%B4%EB%A6%AC%EC%8A%A4-%EB%82%98%EC%9D%B4%EC%95%84%EC%8B%A0%EC%95%84%EB%A7%88%EC%9D%B4%EB%93%9C/11/",
    expectName: /광채프로폴리스|프로폴리스\s*\+\s*나이아신/i,
  },
];

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function sqlLiteral(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function dbQuery(sql) {
  if (linkedRef() === PROD) throw new Error("ABORT Production");
  const tmp = path.join(tmpdir(), `kb-krw-${process.pid}-${Date.now()}.sql`);
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

async function saleCheck(item) {
  const res = await fetch(item.url, {
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
    html.match(/item_name\s*=\s*'([^']+)'/i)?.[1] ||
    html.match(/og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    "";
  const price = Number(html.match(/product_price\s*=\s*'?(\d+)'?/i)?.[1] || 0);
  const soldOut = /is_soldout\s*=\s*'T'/i.test(html);
  const buyCta = /구매하기|장바구니/i.test(html);
  const nameOk = item.expectName.test(name);
  return {
    http: res.status,
    finalUrl: res.url,
    name: name.slice(0, 120),
    nameOk,
    price,
    soldOut,
    buyCta,
    ok: res.status === 200 && nameOk && price >= 1000 && !soldOut && buyCta,
  };
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging", ref }));
  process.exit(2);
}
if (ref === PROD) {
  console.log(JSON.stringify({ phase: "abort", reason: "production" }));
  process.exit(2);
}

const results = [];
for (const item of BATCH) {
  const row = { productId: item.productId, slug: item.slug, retailer: item.retailer };
  try {
    const check = await saleCheck(item);
    row.saleCheck = check;
    if (!check.ok) {
      row.status = "sale_check_failed";
      results.push(row);
      continue;
    }

    // Remove prior unverified stubs for this product; keep existing verified USD offers.
    dbQuery(`
      delete from product_offers
      where product_id = ${item.productId}
        and verification_status = 'unverified';
    `);
    // Replace previous KR official verified offer for this retailer if re-running.
    dbQuery(`
      delete from product_offers
      where product_id = ${item.productId}
        and retailer_country = 'KR'
        and is_official = true
        and currency = 'KRW'
        and retailer_name = ${sqlLiteral(item.retailer)};
    `);
    dbQuery(`
      insert into product_offers (
        product_id, retailer_name, retailer_country, ships_to_countries,
        purchase_url, price, currency, stock_status, verification_status,
        is_official, verified_at, active, last_checked_at
      ) values (
        ${item.productId}::bigint,
        ${sqlLiteral(item.retailer)},
        'KR',
        array['KR']::text[],
        ${sqlLiteral(check.finalUrl || item.url)},
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

    row.status = "ok";
    row.priceKrw = check.price;
    row.purchaseUrl = check.finalUrl || item.url;
    results.push(row);
  } catch (e) {
    row.status = "error";
    row.message = String(e?.message || e).slice(0, 300);
    results.push(row);
  }
}

console.log(
  JSON.stringify(
    {
      phase: "staging_krw_diversity_offers",
      productionTouched: false,
      inventedPrices: false,
      oliveYoung: "still_403_skipped",
      banila: "deferred_no_reliable_pdp",
      ok: results.filter((r) => r.status === "ok").length,
      results,
    },
    null,
    2
  )
);
