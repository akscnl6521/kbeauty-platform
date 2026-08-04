/**
 * «구매하기» 가 왜 안 나오는지 원인을 특정한다. 읽기 전용.
 *
 * 2026-08-04 배포 뒤에도 구매 링크가 안 뜬다는 보고. 배포 전 검증에서는
 * «국내 구매 가능 13건» 으로 나왔는데, 그 검증이 **실제 자격 규칙보다 느슨했다.**
 * 거기서는 `retailer_country` · `verification_status` · `stock_status` 세 가지만 봤다.
 *
 * 진짜 관문은 `isOfferPurchasableForCta` 이고, 이건 여덟 가지를 본다:
 *
 *   active !== false · price > 0 · currency · **통화가 배송국과 맞는가**
 *   https URL · **ships_to_countries 에 배송국 포함** · **retailer_country = 배송국**
 *   verified · verified_at · (KR) in_stock
 *
 * 어느 조건에서 떨어지는지 **하나씩 세어** 원인을 특정한다. 추측하지 않는다.
 *
 * 실행: npm run check:purchase-cta
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

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
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
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

  const { normalizeProductOffer, isOfferPurchasableForCta } = await import("@/lib/recommend");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const rawOffers = await fetchAll<Record<string, unknown>>(
    client,
    "product_offers",
    "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency," +
      "stock_status,verification_status,is_official,verified_at,last_checked_at,rating,review_count,source,active"
  );
  const products = await fetchAll<{ id: number; brand: string | null; name: string | null; active: boolean | null; verified_at: string | null }>(
    client,
    "products",
    "id,brand,name,active,verified_at"
  );
  const pool = new Set(products.filter((p) => p.active === true && p.verified_at != null).map((p) => String(p.id)));

  console.log(`오퍼 ${rawOffers.length}행 · 추천 풀 제품 ${pool.size}건\n`);

  // 조건별로 어디서 떨어지는지 센다. 순서는 `passesOfferIdentityAndCommerceBase` 와 같다.
  const expectedCurrency: Record<string, string> = { KR: "KRW", US: "USD", JP: "JPY" };

  for (const country of ["KR", "US"] as const) {
    const reasons = new Map<string, number>();
    const bump = (k: string) => reasons.set(k, (reasons.get(k) ?? 0) + 1);
    const passed: Array<{ pid: string; retailer: string; price: unknown; currency: unknown }> = [];

    for (const raw of rawOffers) {
      const pid = String(raw.product_id);
      if (!pool.has(pid)) continue; // 추천 풀 제품의 오퍼만 본다

      const o = normalizeProductOffer(raw);
      if (!o) {
        bump("정규화 실패 (필수 필드 누락)");
        continue;
      }
      if (o.active === false) { bump("active = false"); continue; }
      if (o.price == null || !Number.isFinite(o.price) || o.price <= 0) { bump("가격 없음/0 이하"); continue; }
      if (!o.currency) { bump("통화 없음"); continue; }
      if (o.currency !== expectedCurrency[country]) { bump(`통화 불일치 (${o.currency} ≠ ${expectedCurrency[country]})`); continue; }
      if (!o.purchaseUrl || !/^https:\/\//i.test(o.purchaseUrl)) { bump("구매 URL 없음/https 아님"); continue; }
      if (!o.shipsToCountries.includes(country)) {
        bump(`ships_to_countries 에 ${country} 없음 (${JSON.stringify(o.shipsToCountries)})`);
        continue;
      }
      if (o.retailerCountry !== country) { bump(`retailer_country ≠ ${country} (${o.retailerCountry})`); continue; }
      if (o.verificationStatus !== "verified") { bump(`verification_status = ${o.verificationStatus}`); continue; }
      if (!o.verifiedAt || !o.verifiedAt.trim()) { bump("verified_at 비어 있음"); continue; }
      if (country === "KR" && o.stockStatus !== "in_stock") { bump(`재고 = ${o.stockStatus} (KR 은 in_stock 만)`); continue; }

      if (isOfferPurchasableForCta(o, country)) {
        passed.push({ pid, retailer: String(o.retailerName ?? "-"), price: o.price, currency: o.currency });
      } else {
        bump("isOfferPurchasableForCta 최종 탈락 (위 조건 밖)");
      }
    }

    const productsWithCta = new Set(passed.map((p) => p.pid));
    console.log(`═══ ${country} — 구매 CTA 통과 오퍼 ${passed.length}건 / 제품 ${productsWithCta.size}건 ═══`);
    if (reasons.size > 0) {
      console.log("  탈락 사유:");
      for (const [why, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1]))
        console.log(`    ${String(n).padStart(4)}건  ${why}`);
    }
    if (passed.length > 0) {
      console.log("  통과 표본:");
      for (const p of passed.slice(0, 5))
        console.log(`    제품 ${p.pid.padStart(4)}  ${String(p.retailer).padEnd(14)} ${p.price} ${p.currency}`);
    }
    console.log("");
  }

  mkdirSync("artifacts/production-audit", { recursive: true });
  const path = "artifacts/production-audit/purchase-cta-diagnosis.json";
  writeFileSync(
    path,
    JSON.stringify({ checkedAt: new Date().toISOString(), offers: rawOffers.length, poolProducts: pool.size }, null, 2),
    "utf8"
  );
  console.log(`결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[diagnose-purchase-cta] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
