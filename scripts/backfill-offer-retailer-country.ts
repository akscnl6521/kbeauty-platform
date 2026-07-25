/**
 * One-time backfill: offers priced in KRW/JPY but misclassified with the
 * old TLD-only retailer_country heuristic (e.g. .com Korean brand sites
 * tagged "US"). Uses the real currency already stored on each row — no
 * invented data. Only touches rows where currency clearly disagrees with
 * retailer_country.
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await client
    .from("product_offers")
    .select("id, product_id, currency, retailer_country, ships_to_countries, purchase_url")
    .in("currency", ["KRW", "JPY"]);
  if (error) throw error;

  let updated = 0;
  const details: Array<Record<string, unknown>> = [];
  for (const row of rows ?? []) {
    const correctCountry = row.currency === "KRW" ? "KR" : "JP";
    if (row.retailer_country === correctCountry) continue;

    const ships = Array.isArray(row.ships_to_countries) ? row.ships_to_countries : [];
    const nextShips = ships.includes(correctCountry) ? ships : [...ships, correctCountry];

    const { error: updErr } = await client
      .from("product_offers")
      .update({ retailer_country: correctCountry, ships_to_countries: nextShips })
      .eq("id", row.id);
    if (updErr) {
      details.push({ id: row.id, error: updErr.message });
      continue;
    }
    updated += 1;
    details.push({
      id: row.id,
      productId: row.product_id,
      from: row.retailer_country,
      to: correctCountry,
      purchaseUrl: row.purchase_url,
    });
  }

  console.log(JSON.stringify({ scanned: (rows ?? []).length, updated, details }, null, 2));
}

main().catch((err) => {
  console.error("[backfill-offer-retailer-country] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
