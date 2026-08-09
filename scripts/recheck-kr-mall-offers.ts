/**
 * 국내몰 오퍼의 **가격·재고를 출처에서 다시 확인한다.**
 *
 * ## 왜 필요한가
 *
 * 오퍼는 한 번 만들면 아무도 다시 안 본다. 구매 CTA 관문(`isOfferPurchasableForCta`)
 * 은 `verifiedAt` 이 **있는지**만 보고 **얼마나 오래됐는지는 보지 않는다**.
 * 그래서 2년 전에 확인한 값도 그대로 «구매하기» 로 나간다.
 *
 * 기존 `refresh:product-daily` 는 `mode: "fixture"` 로 도는 **뼈대**다 — 산출물
 * 형식만 만들고 실제 데이터를 다시 확인하지 않는다.
 *
 * 가격이 바뀌거나 품절되면 화면이 **조용히 틀려진다.** 사용자는 「10,710원」 을
 * 보고 눌렀다가 다른 값을 만나거나, 품절 페이지에 도착한다.
 *
 * ## 무엇을 하나
 *
 *   · 국내몰(`KR_MALLS`) 페이지에서 온 오퍼만 다시 받는다
 *   · JSON-LD 의 가격·재고를 저장된 값과 견준다
 *   · `--apply` 면 **바뀐 값을 반영하고 `last_checked_at` 을 새로 찍는다**
 *
 * ## 지어내지 않는다
 *
 *   · 페이지가 **재고를 명시하지 않으면 재고를 바꾸지 않는다.** 표기가 없는 것을
 *     «판매중» 으로도 «품절» 로도 읽지 않는다 — 이 저장소의 기존 결정과 같다.
 *   · 페이지를 못 받으면(일시 장애일 수 있다) 아무것도 바꾸지 않는다.
 *     **못 받았다고 오퍼를 내리지 않는다** — 멀쩡한 판매처를 지우게 된다.
 *   · 가격이 자리표시로 보이면(1,000원 미만) 반영하지 않는다.
 *
 * 실행: npm run check:kr-offer-freshness            # 다시 확인만 (쓰지 않음)
 *       npm run check:kr-offer-freshness -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";
import { parseMallProductJsonLd, MIN_PLAUSIBLE_KRW } from "../src/lib/catalog/mallProductData";
import { KR_MALLS } from "../src/lib/catalog/krMalls";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; KBeautyMatchCatalog/1.0)";
const TIMEOUT_MS = 20_000;
const PAUSE_MS = 500;

type OfferRow = {
  id: string;
  product_id: string | number | null;
  purchase_url: string | null;
  price: number | null;
  currency: string | null;
  stock_status: string | null;
  retailer_country: string | null;
  active: boolean | null;
  last_checked_at: string | null;
  verified_at: string | null;
};

type Outcome =
  | "그대로"
  | "가격 바뀜"
  | "품절로 바뀜"
  | "재입고됨"
  | "페이지를 못 받음"
  | "재고 표기 없음(재고는 안 바꿈)"
  | "가격이 자리표시로 보임";

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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
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
  const offers = await fetchAll<OfferRow>(
    client,
    "product_offers",
    "id,product_id,purchase_url,price,currency,stock_status,retailer_country,active,last_checked_at,verified_at"
  );

  // 국내몰에서 온 오퍼만 본다 — 올리브영·쿠팡 같은 곳은 여기서 다루지 않는다.
  const mallHosts = new Set(KR_MALLS.map((m) => m.domain.toLowerCase().replace(/^www\./, "")));
  const targets = offers.filter((o) => {
    if (o.active === false) return false;
    const h = hostOf(String(o.purchase_url ?? "")).replace(/^www\./, "");
    return h !== "" && mallHosts.has(h);
  });

  const now = Date.now();
  const ageDays = (o: OfferRow) => {
    const t = o.last_checked_at ?? o.verified_at;
    return t ? Math.floor((now - new Date(t).getTime()) / 86_400_000) : Infinity;
  };
  console.log(
    `오퍼 ${offers.length}행 · 국내몰 오퍼 ${targets.length}행 ` +
      `(가장 오래된 확인 ${targets.length ? Math.max(...targets.map(ageDays)) : 0}일 전)\n`
  );

  const results: Array<{ offerId: string; productId: string; outcome: Outcome; detail: string }> = [];
  const counts = new Map<Outcome, number>();
  const note = (o: Outcome) => counts.set(o, (counts.get(o) ?? 0) + 1);

  for (const o of targets) {
    const page = String(o.purchase_url);
    let html = "";
    try {
      const r = await fetch(page, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!r.ok) {
        note("페이지를 못 받음");
        results.push({ offerId: o.id, productId: String(o.product_id), outcome: "페이지를 못 받음", detail: `HTTP ${r.status}` });
        continue;
      }
      // 국내몰은 EUC-KR 로 주는 곳이 많다.
      html = await decodeHtmlBody(r);
    } catch {
      note("페이지를 못 받음");
      results.push({ offerId: o.id, productId: String(o.product_id), outcome: "페이지를 못 받음", detail: "받기 실패" });
      continue;
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));

    const parsed = parseMallProductJsonLd(html);
    if (!parsed?.price) {
      note("페이지를 못 받음");
      results.push({ offerId: o.id, productId: String(o.product_id), outcome: "페이지를 못 받음", detail: "JSON-LD 가격 없음" });
      continue;
    }
    if (parsed.price < MIN_PLAUSIBLE_KRW) {
      note("가격이 자리표시로 보임");
      results.push({ offerId: o.id, productId: String(o.product_id), outcome: "가격이 자리표시로 보임", detail: `${parsed.price}` });
      continue;
    }

    const patch: Record<string, unknown> = {};
    let outcome: Outcome = "그대로";
    let detail = "";

    if (Number(o.price) !== parsed.price) {
      patch.price = parsed.price;
      outcome = "가격 바뀜";
      detail = `${o.price} → ${parsed.price}`;
    }

    // **재고는 페이지가 명시할 때만 손댄다.** 표기가 없으면 그대로 둔다 —
    // 없는 것을 «판매중» 으로도 «품절» 로도 읽지 않는다.
    const wasInStock = String(o.stock_status ?? "") === "in_stock";
    if (parsed.inStock === true && !wasInStock) {
      patch.stock_status = "in_stock";
      outcome = "재입고됨";
      detail = detail || "품절 → 판매중";
    } else if (parsed.inStock === false && wasInStock) {
      patch.stock_status = "out_of_stock";
      outcome = "품절로 바뀜";
      detail = detail || "판매중 → 품절";
    } else if (parsed.inStock == null && outcome === "그대로") {
      outcome = "재고 표기 없음(재고는 안 바꿈)";
    }

    note(outcome);
    results.push({ offerId: o.id, productId: String(o.product_id), outcome, detail });

    if (apply) {
      patch.last_checked_at = new Date().toISOString();
      const { error } = await client.from("product_offers").update(patch).eq("id", o.id);
      if (error) console.log(`  ${o.id} 반영 실패: ${error.code} ${error.message.slice(0, 60)}`);
    }
  }

  console.log("── 결과 ──");
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  const changed = results.filter((r) => r.outcome === "가격 바뀜" || r.outcome === "품절로 바뀜" || r.outcome === "재입고됨");
  if (changed.length) {
    console.log("\n바뀐 것:");
    for (const r of changed.slice(0, 20)) console.log(`  제품 ${r.productId.padStart(4)}  ${r.outcome}  ${r.detail}`);
    if (changed.length > 20) console.log(`  … 외 ${changed.length - 20}건`);
  }

  mkdirSync("artifacts/production-audit", { recursive: true });
  writeFileSync(
    "artifacts/production-audit/kr-offer-recheck.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), applied: apply, results }, null, 2),
    "utf8"
  );
  console.log("\n결과 저장: artifacts/production-audit/kr-offer-recheck.json");
  if (!apply) console.log("다시 확인만 했다. --apply 로 반영한다.");
}

main().catch((e) => {
  console.error("[recheck-kr-mall-offers] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
