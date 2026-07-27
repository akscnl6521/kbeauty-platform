/**
 * Cafe24 자사몰에서 신규 브랜드 제품을 **후보로만** 등록한다.
 *
 * 여기서는 발견까지다. 크롤·성분 매칭·오퍼 수집·품질 게이트는 기존
 * `collect-scalp-hair-tier1.ts` / `collect-offers-from-brand-pages.ts` 가
 * 그대로 처리한다 — 새 수집 로직을 만들지 않는다.
 *
 * 대상 도메인은 `survey-cafe24-brand-stores.ts` 로 **가격·재고가 실제로
 * 읽히는지 확인한 곳만** 넘긴다. 통하지 않는 곳을 긁으면 비활성 제품만
 * 쌓인다(§30-29).
 *
 * Cafe24 상품 주소는 두 형태다. 둘 다 받되, «예쁜 주소» 는 목록이 붙여 주는
 * `/category/<n>/display/<n>/` 꼬리를 떼고 정규 형태로 저장한다 — 그 꼬리가
 * 있으면 파이프라인이 목록 페이지로 보고 거부한다(§30-17).
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/discover-cafe24-brand-candidates.ts abib.co.kr sioris.co.kr
 *   ... scripts/discover-cafe24-brand-candidates.ts <호스트...> --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** 한 브랜드에서 한 번에 살펴볼 카테고리·상품 수 상한. 조용히 자르지 않고 보고한다. */
const MAX_CATEGORIES = 8;
const MAX_PRODUCTS_PER_BRAND = 40;

type Found = { url: string; name: string; productNo: string };

async function get(url: string, timeoutMs = 20_000): Promise<string> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: c.signal, redirect: "follow" });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function robotsBlocksProducts(txt: string): boolean {
  let relevant = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim().toLowerCase();
    if (line.startsWith("user-agent:")) relevant = line.includes("*");
    if (!relevant || !line.startsWith("disallow:")) continue;
    const p = line.slice(9).trim();
    if (p === "/" || p === "/product" || p === "/product/") return true;
  }
  return false;
}

function collectProducts(html: string, origin: string, into: Map<string, Found>): void {
  for (const m of html.matchAll(/href="(\/product\/([^"/]+)\/(\d+)\/)[^"]*"/g)) {
    const [, canonical, slug, no] = m;
    if (into.has(no!)) continue;
    into.set(no!, {
      url: origin + canonical,
      name: decodeURIComponent(slug!).replace(/-/g, " ").trim(),
      productNo: no!,
    });
  }
  for (const m of html.matchAll(/href="(\/product\/detail\.html\?[^"]*product_no=(\d+)[^"]*)"/g)) {
    const [, href, no] = m;
    if (into.has(no!)) continue;
    into.set(no!, { url: origin + href.replace(/&amp;/g, "&"), name: "", productNo: no! });
  }
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
  const apply = process.argv.includes("--apply");
  const hosts = process.argv.slice(2).filter((a) => !a.startsWith("--") && /\./.test(a));
  if (hosts.length === 0) throw new Error("호스트를 하나 이상 넘겨야 한다");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const existing = await fetchAll<{ discovered_url: string | null }>(
    client,
    "product_discovery_candidates",
    "id,discovered_url"
  );
  const known = new Set(
    existing.map((c) => decodeURIComponent(String(c.discovered_url ?? "")).replace(/\/+$/, ""))
  );

  const rows: Array<Record<string, unknown>> = [];

  for (const host of hosts) {
    const origin = `https://${host}`;
    const robots = await get(`${origin}/robots.txt`, 12_000);
    if (robots && robotsBlocksProducts(robots)) {
      console.log(`### ${host} — robots.txt 가 상품 경로를 막는다. 건너뛴다.`);
      continue;
    }

    const home = await get(origin);
    if (!home) {
      console.log(`### ${host} — 홈을 가져오지 못했다.`);
      continue;
    }

    const found = new Map<string, Found>();
    collectProducts(home, origin, found);

    const cats = [...new Set([...home.matchAll(/href="(\/product\/list\.html\?[^"]*cate_no=\d+[^"]*)"/g)].map((m) => m[1]!))];
    for (const cat of cats.slice(0, MAX_CATEGORIES)) {
      if (found.size >= MAX_PRODUCTS_PER_BRAND) break;
      collectProducts(await get(origin + cat.replace(/&amp;/g, "&")), origin, found);
    }

    const all = [...found.values()];
    const fresh = all.filter((f) => !known.has(decodeURIComponent(f.url).replace(/\/+$/, "")));
    const truncated = all.length >= MAX_PRODUCTS_PER_BRAND || cats.length > MAX_CATEGORIES;

    console.log(
      `### ${host} — 카테고리 ${cats.length}개(살펴본 ${Math.min(cats.length, MAX_CATEGORIES)}) · ` +
        `상품 ${all.length}개 · 신규 ${fresh.length}개` +
        (truncated ? "  [상한 도달 — 전부는 아니다]" : "")
    );
    for (const f of fresh.slice(0, 6)) console.log(`    ${(f.name || f.url).slice(0, 62)}`);
    if (fresh.length > 6) console.log(`    ... 외 ${fresh.length - 6}개`);

    for (const f of fresh) {
      rows.push({
        discovered_name: f.name || `product_no=${f.productNo}`,
        discovered_brand: host.replace(/\.(co\.kr|com|shop|kr)$/, ""),
        discovered_url: f.url,
        discovered_country: "KR",
        source_type: "official_brand_page",
        workflow_status: "discovered",
        notes: `[cafe24-brand-discovery-2026-07-27] ${host}`,
      });
    }
  }

  console.log(`\n등록 대상 합계 ${rows.length}건`);
  if (!apply) {
    console.log("검증 모드. 등록하려면 --apply 를 붙인다.");
    return;
  }
  if (rows.length === 0) return;

  const { data, error } = await client.from("product_discovery_candidates").insert(rows).select("id");
  if (error) {
    console.error(`\n[중단] 후보 등록 실패: ${error.code} ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`후보 ${data?.length ?? 0}건 등록.`);
}

main().catch((e) => {
  console.error("[discover-cafe24-brand-candidates] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
