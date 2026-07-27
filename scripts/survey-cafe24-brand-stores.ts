/**
 * 이미 알고 있는 브랜드 도메인 중 **Cafe24 자사몰**을 찾아, 검증된 오퍼 경로가
 * 실제로 통하는지 확인한다. 읽기 전용 — DB 에 쓰지 않는다.
 *
 * 왜 Cafe24 인가: lador.co.kr 에서 «품절 배지의 displaynone» 으로 재고를 읽는
 * 경로를 세웠고(§30-12), 실가격까지 확인돼 오퍼가 verified 로 올라갔다.
 * 국내 브랜드 자사몰 상당수가 같은 플랫폼이라 그 경로가 그대로 통한다.
 *
 * 지금 병목은 사전이 아니라 **검증 오퍼**다(§30-29). 브랜드를 늘리기 전에
 * 오퍼를 얻을 수 있는 곳인지 먼저 본다 — 그러지 않으면 비활성 제품만 쌓인다.
 *
 * 각 도메인에서 확인하는 것:
 *   1. robots.txt 가 상품 경로를 막지 않는가
 *   2. Cafe24 인가 (`xans-` · `/exec/front/` 같은 플랫폼 표식)
 *   3. 상품 페이지에 JSON-LD Product · 가격 · 재고 신호가 있는가
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/survey-cafe24-brand-stores.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const OUT_DIR = path.join("artifacts", "cafe24-brand-survey");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type BrandProbe = {
  host: string;
  reachable: boolean;
  robotsAllowsProducts: boolean;
  platform: "cafe24" | "shopify" | "other" | "unknown";
  productUrl: string | null;
  hasJsonLdProduct: boolean;
  price: string | null;
  stockSignal: "in_stock" | "out_of_stock" | null;
  note: string;
};

async function get(url: string, timeoutMs = 15_000): Promise<{ ok: boolean; status: number; body: string }> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: c.signal, redirect: "follow" });
    return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : "" };
  } catch {
    return { ok: false, status: 0, body: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** `/product/` 를 막는지만 본다. 전체 차단(`Disallow: /`)도 여기서 걸린다. */
function robotsAllowsProducts(txt: string): boolean {
  let relevant = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim().toLowerCase();
    if (line.startsWith("user-agent:")) relevant = line.includes("*");
    if (!relevant || !line.startsWith("disallow:")) continue;
    const p = line.slice(9).trim();
    if (p === "/" || p === "/product" || p === "/product/") return false;
  }
  return true;
}

function detectPlatform(html: string): BrandProbe["platform"] {
  if (/xans-|\/exec\/front\/|EC-Front|ec-base-/i.test(html)) return "cafe24";
  if (/cdn\.shopify\.com|shopify-section|Shopify\.theme/i.test(html)) return "shopify";
  if (html.length > 0) return "other";
  return "unknown";
}

/** Cafe24 는 품절 배지를 항상 넣고 `displaynone` 으로 숨긴다 (§30-12). */
function cafe24Stock(html: string): BrandProbe["stockSignal"] {
  const els = [...html.matchAll(/<(?:span|div|button)[^>]*\bclass="([^"]*(?:sold-?out|sub_sold)[^"]*)"[^>]*>/gi)].map(
    (m) => m[1]!
  );
  if (els.length === 0) return null;
  return els.some((c) => !/\bdisplaynone\b/.test(c)) ? "out_of_stock" : "in_stock";
}

/**
 * Cafe24 상품 링크에서 **정규 형태**만 꺼낸다.
 *
 * 목록이 주는 href 는 `/product/<이름>/<id>/category/<n>/display/<n>/` 처럼
 * 뒤가 더 붙어 있다. 링크가 `/<id>/` 에서 끝난다고 보면 아무것도 못 찾는다.
 * 경로에 «category» 가 들어가면 파이프라인이 목록 페이지로 보고 거부하므로
 * (§30-17) 여기서도 정규 형태로 잘라 쓴다.
 */
const CAFE24_PRODUCT_HREF = /href="(\/product\/[^"/]+\/\d+\/)/;

async function findProductUrl(origin: string, home: string): Promise<string | null> {
  const direct = home.match(CAFE24_PRODUCT_HREF);
  if (direct) return origin + direct[1];

  // 홈에 상품 링크가 없으면 카테고리 목록을 한 번 거친다.
  for (const m of [...home.matchAll(/href="(\/product\/list\.html\?[^"]*cate_no=\d+[^"]*)"/g)].slice(0, 3)) {
    const listing = await get(origin + m[1]!.replace(/&amp;/g, "&"));
    const hit = listing.body.match(CAFE24_PRODUCT_HREF);
    if (hit) return origin + hit[1];
  }
  return null;
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const hostOf = (u: string | null) => {
    try {
      return new URL(u ?? "").hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const hosts = new Set<string>();
  for (const o of await fetchAll<{ purchase_url: string | null }>(client, "product_offers", "id,purchase_url")) {
    const h = hostOf(o.purchase_url);
    if (h) hosts.add(h);
  }
  for (const c of await fetchAll<{ discovered_url: string | null }>(
    client,
    "product_discovery_candidates",
    "id,discovered_url"
  )) {
    const h = hostOf(c.discovered_url);
    if (h) hosts.add(h);
  }
  hosts.delete("example.invalid");

  const results: BrandProbe[] = [];
  for (const host of [...hosts].sort()) {
    const origin = `https://${host}`;
    const probe: BrandProbe = {
      host,
      reachable: false,
      robotsAllowsProducts: false,
      platform: "unknown",
      productUrl: null,
      hasJsonLdProduct: false,
      price: null,
      stockSignal: null,
      note: "",
    };

    const robots = await get(`${origin}/robots.txt`, 12_000);
    probe.robotsAllowsProducts = robots.ok ? robotsAllowsProducts(robots.body) : true;
    if (robots.status === 403) probe.note = "robots.txt 403 — 봇 차단";

    const home = await get(origin);
    probe.reachable = home.ok;
    if (!home.ok) {
      probe.note ||= `홈 HTTP ${home.status}`;
      results.push(probe);
      console.log(`  ${host.padEnd(26)} 접근 실패 (${home.status})`);
      continue;
    }
    probe.platform = detectPlatform(home.body);

    if (probe.platform === "cafe24" && probe.robotsAllowsProducts) {
      probe.productUrl = await findProductUrl(origin, home.body);
      if (probe.productUrl) {
        const page = await get(probe.productUrl, 20_000);
        probe.hasJsonLdProduct = /"@type"\s*:\s*"Product"/.test(page.body);
        probe.price = page.body.match(/product:price:amount[^>]*content="([^"]*)"/)?.[1] ?? null;
        probe.stockSignal = cafe24Stock(page.body);
      } else {
        probe.note ||= "상품 링크를 찾지 못함";
      }
    }

    results.push(probe);
    const verdict =
      probe.platform === "cafe24"
        ? probe.stockSignal && probe.price
          ? `*** 경로 통함 (가격 ${probe.price} · ${probe.stockSignal}) ***`
          : `Cafe24 이나 신호 부족 ${probe.note}`
        : probe.platform;
    console.log(`  ${host.padEnd(26)} ${verdict}`);
  }

  const usable = results.filter((r) => r.platform === "cafe24" && r.price && r.stockSignal);
  console.log(`\n조사 ${results.length}곳`);
  console.log(`  Cafe24: ${results.filter((r) => r.platform === "cafe24").length}곳`);
  console.log(`  검증 경로가 통하는 곳: ${usable.length}곳 — ${usable.map((r) => r.host).join(", ")}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "survey.json"), JSON.stringify(results, null, 2));
  console.log(`\n산출물 ${OUT_DIR}/survey.json — DB 에는 쓰지 않았다.`);
}

main().catch((e) => {
  console.error("[survey-cafe24-brand-stores] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
