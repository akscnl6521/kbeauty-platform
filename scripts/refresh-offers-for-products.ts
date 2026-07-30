/**
 * 지정한 제품의 오퍼를 브랜드 공식 페이지에서 다시 수집한다.
 *
 * 재고를 JSON-LD 로 내보내지 않는 쇼핑몰(Cafe24 등)의 신호를 읽을 수 있게 된
 * 뒤, 기존에 `stock_status=unknown` 으로 막혀 있던 오퍼를 다시 판정하려고
 * 쓴다. 가격·재고를 만들어내지 않고 페이지가 노출한 것만 저장한다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/refresh-offers-for-products.ts 74 75 76 77            # 검증만
 *   ... scripts/refresh-offers-for-products.ts 74 75 --apply        # 실제 저장
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

async function main() {
  const apply = process.argv.includes("--apply");
  const ids = process.argv
    .slice(2)
    .filter((a) => /^\d+$/.test(a))
    .map(Number);
  if (ids.length === 0) throw new Error("제품 id 를 하나 이상 넘겨야 한다");

  const { extractOffersFromHtml, summarizeExtractedOffer } = await import(
    "../src/lib/pipeline/offers/offer-extract"
  );
  const { isSameProductPage } = await import(
    '../src/lib/pipeline/offers/offer-source-class'
  );
  const { discoverAndPersistOffers } = await import(
    "../src/lib/pipeline/offers/offer-persist"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = "offer-refresh-cafe24-stock-2026-07-27";

  const { data: products, error } = await client
    .from("products")
    .select("id, name, brand, active")
    .in("id", ids);
  if (error) throw error;

  const { data: offers } = await client
    .from("product_offers")
    .select("product_id, purchase_url")
    .in("product_id", ids);

  for (const p of products ?? []) {
    const src = (offers ?? []).find(
      (o: { product_id: number }) => o.product_id === p.id
    ) as { purchase_url: string } | undefined;
    if (!src?.purchase_url) {
      console.log(`  ${p.id} 건너뜀: 기존 오퍼 URL 없음`);
      continue;
    }

    let pageHtml = "";
    try {
      const res = await fetch(src.purchase_url, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (compatible; kbm-sourcing)" },
      });
      pageHtml = res.ok ? await res.text() : "";
      if (!pageHtml) {
        console.log(`  ${p.id} 건너뜀: 페이지 HTTP ${res.status}`);
        continue;
      }
    } catch (e) {
      console.log(`  ${p.id} 건너뜀: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const host = new URL(src.purchase_url).hostname.replace(/^www\./, "");
    const signals = extractOffersFromHtml(pageHtml, src.purchase_url);
    const summary = signals.map((s) =>
      summarizeExtractedOffer(s, isSameProductPage(s.purchaseUrl, src.purchase_url) ? pageHtml : null)
    );

    console.log(`\n### ${p.id} ${p.brand ?? ""} ${p.name ?? ""}`.slice(0, 90));
    for (const s of summary) {
      console.log(
        `   신호 ${s.signal.method.padEnd(22)} 가격 ${String(s.price.price ?? "-").padStart(8)} ${s.price.currency ?? "-"}` +
          `  재고 ${s.stock.stockStatus.padEnd(13)} conf ${s.stock.confidence}  ${s.stock.reasons.join(",")}`
      );
    }

    if (!apply) continue;

    const out = await discoverAndPersistOffers(client, {
      productId: p.id,
      productName: p.name ?? "",
      brandName: p.brand ?? "",
      productActive: Boolean(p.active),
      pageHtml,
      pageUrl: src.purchase_url,
      officialHost: host,
      batchId,
    });
    console.log(
      `   저장: 신규 ${out.inserted} / 갱신 ${out.updated} / 검증 ${out.verified} / 건너뜀 ${out.skipped}` +
        (out.reasons?.length ? `  사유 ${out.reasons.join(", ")}` : "")
    );
  }
}

main().catch((e) => {
  console.error("[refresh-offers-for-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
