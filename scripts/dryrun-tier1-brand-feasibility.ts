/**
 * C단계 — Tier 1 브랜드 수집 가능성 dry-run.
 *
 * **제품 데이터를 긁지 않는다.** 브랜드마다 다음 세 가지만 본다:
 *   1. robots.txt 가 제품 경로 크롤을 허용하는가
 *   2. 공식몰이 어떤 플랫폼인가 (Cafe24 면 검증된 커넥터가 그대로 동작)
 *   3. 접근이 되는가 (봇 차단·지역 차단 여부)
 *
 * 왜 여기까지만 하는가 — `brandRegistry.ts` 가 모든 브랜드를
 * `allowsAutomation: false` 로 두고 있다("Live crawl remains OFF until
 * terms/robots review"). 그 검토를 대신하는 것이 이 단계다. 본수집은 여기서
 * 허용으로 확인된 브랜드에 대해서만 별도로 진행한다.
 *
 * 읽기 전용. DB 에 쓰지 않고, 제품 페이지도 열지 않는다.
 *
 * 실행: npm run check:tier1-feasibility
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * Tier 1 = Staging 에서 이미 수집에 성공한 브랜드.
 * Production 표기 그대로 적는다 (표기 통일은 아직 안 했다).
 */
const TIER1_BRANDS = [
  "COSRX",
  "CosRX",
  "SKIN1004",
  "Round Lab",
  "Anua",
  "Beauty of Joseon",
  "Laneige",
  "Abib",
  "Torriden",
  "Isntree",
  "Sulwhasoo",
  "Numbuzin",
  "Banila Co",
] as const;

const UA =
  "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";

function pad(value: string, width: number): string {
  let w = 0;
  for (const ch of value) w += /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(1, width - w));
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function get(url: string, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    const body = res.ok ? await res.text() : "";
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * robots.txt 를 «우리 UA 기준» 으로 해석한다. 정밀 파서가 아니라, 제품 경로가
 * 명시적으로 막혀 있는지만 본다 — 애매하면 «확인 필요» 로 남기고 임의 판단하지 않는다.
 */
function judgeRobots(body: string, samplePath: string): string {
  if (!body.trim()) return "robots 없음(제한 없음으로 봄)";
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let applies = false;
  const disallow: string[] = [];
  for (const line of lines) {
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      applies = ua[1].trim() === "*";
      continue;
    }
    if (!applies) continue;
    const d = line.match(/^disallow:\s*(.*)$/i);
    if (d) disallow.push(d[1].trim());
  }
  if (disallow.includes("/")) return "**전체 차단**";
  const hit = disallow.filter((p) => p && samplePath.startsWith(p));
  if (hit.length > 0) return `제품경로 차단 (${hit.join(", ")})`;
  return `허용 (Disallow ${disallow.length}건, 제품경로 아님)`;
}

/** 플랫폼 판별 — Cafe24 는 이번 세션에서 커넥터가 검증된 유일한 플랫폼이다. */
function detectPlatform(html: string): string {
  if (!html) return "-";
  const h = html.toLowerCase();
  if (/xans-|\/exec\/front\/|ec-base-/.test(h)) return "Cafe24 ✅";
  if (/cdn\.shopify\.com|shopify/.test(h)) return "Shopify";
  if (/wp-content|wordpress/.test(h)) return "WordPress";
  if (/imweb|사이트 제작/.test(h)) return "imweb";
  if (/godo|nhn commerce/.test(h)) return "godomall";
  return "기타/자체";
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_ANON_KEY ??
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (!url || !key) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const { KR_BRAND_SEED_REGISTRY } = await import("@/lib/catalog/bulkKr/brandRegistry");

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<{ id: number; brand: string | null; verified_at: string | null }>(
    client,
    "products",
    "id,brand,verified_at"
  );
  const stuck = products.filter((p) => p.verified_at == null);

  const counts = new Map<string, number>();
  for (const p of stuck) counts.set(String(p.brand ?? ""), (counts.get(String(p.brand ?? "")) ?? 0) + 1);

  console.log("C단계 — Tier 1 브랜드 수집 가능성 (제품 데이터 미수집)\n");
  console.log(
    `  ${pad("브랜드", 20)}${"건수".padStart(4)}  ${pad("공식 도메인", 24)}${pad("플랫폼", 14)}robots`
  );

  const results: Array<{ brand: string; n: number; domain: string; platform: string; robots: string; reachable: boolean }> = [];

  for (const brand of TIER1_BRANDS) {
    const n = counts.get(brand) ?? 0;
    if (n === 0) continue;

    // 레지스트리에서 공식 도메인을 찾는다. 이름이 비슷하다고 유추하지 않는다.
    const entry = KR_BRAND_SEED_REGISTRY.find(
      (e) =>
        e.canonicalBrand.toLowerCase().replace(/[\s.]/g, "") ===
        brand.toLowerCase().replace(/[\s.]/g, "")
    );
    if (!entry) {
      console.log(`  ${pad(brand, 20)}${String(n).padStart(4)}  ${pad("(레지스트리에 없음)", 24)}${pad("-", 14)}-`);
      results.push({ brand, n, domain: "", platform: "-", robots: "레지스트리 없음", reachable: false });
      continue;
    }

    // 등록된 도메인을 순서대로 시도해 **실제로 열리는 것**을 쓴다.
    // .co.kr 을 무조건 우선하면 안 된다 — LANEIGE 는 laneige.co.kr 이 죽어 있고
    // laneige.com 이 살아 있다. 우선순위만 보고 «접근 실패» 로 판정하면 오보다.
    let domain = entry.officialDomains[0];
    let home = { status: 0, body: "" } as Awaited<ReturnType<typeof get>>;
    for (const d of entry.officialDomains) {
      const candidate = await get(`https://${d.replace(/^www\./, "")}`);
      if (candidate.status === 200) {
        domain = d;
        home = candidate;
        break;
      }
      if (home.status === 0) home = candidate;
      await new Promise((r) => setTimeout(r, 400));
    }
    const base = `https://${domain.replace(/^www\./, "")}`;
    const robots = await get(`${base}/robots.txt`);
    const platform = detectPlatform(home.body);
    const robotsVerdict =
      robots.status === 200 ? judgeRobots(robots.body, "/product/") : `robots HTTP ${robots.status}`;
    const reachable = home.status === 200;

    console.log(
      `  ${pad(brand, 20)}${String(n).padStart(4)}  ${pad(domain, 24)}${pad(reachable ? platform : `HTTP ${home.status || "실패"}`, 14)}${robotsVerdict}`
    );
    results.push({ brand, n, domain, platform, robots: robotsVerdict, reachable });

    // 예의상 간격을 둔다 (레지스트리 rateLimitPerMinute 존중)
    await new Promise((r) => setTimeout(r, 1200));
  }

  // ── 요약
  const ok = results.filter(
    (r) => r.reachable && r.platform.includes("Cafe24") && !r.robots.includes("차단")
  );
  const blocked = results.filter((r) => !r.reachable || r.robots.includes("차단"));
  const other = results.filter((r) => !ok.includes(r) && !blocked.includes(r));

  console.log("\n── 판정 ──");
  console.log(`  즉시 수집 가능 (Cafe24 · robots 허용)   ${ok.length}개 브랜드 · ${ok.reduce((s, r) => s + r.n, 0)}건`);
  for (const r of ok) console.log(`      ${r.brand} (${r.n})`);
  console.log(`  커넥터 추가 필요 (다른 플랫폼)         ${other.length}개 브랜드 · ${other.reduce((s, r) => s + r.n, 0)}건`);
  for (const r of other) console.log(`      ${pad(r.brand, 20)}${r.platform}`);
  console.log(`  차단·미도달                            ${blocked.length}개 브랜드 · ${blocked.reduce((s, r) => s + r.n, 0)}건`);
  for (const r of blocked) console.log(`      ${pad(r.brand, 20)}${r.reachable ? r.robots : "접근 실패"}`);
}

main().catch((e) => {
  console.error("[dryrun-tier1-brand-feasibility] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
