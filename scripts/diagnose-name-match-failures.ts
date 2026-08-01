/**
 * 브랜드 스토어 대조가 **왜** 실패하는지 원인을 가른다. 읽기 전용.
 *
 * 2026-07-30 실측에서 전성분이 없거나 오염된 79건 중 채운 것은 3건뿐이었다.
 * 나머지는 «제품명 대조 미달» 로 떨어졌는데, 이유가 셋 중 무엇인지 구분이 안 됐다:
 *
 *   (가) 스토어 카탈로그를 못 받았다 (봇 차단·도메인이 다른 사이트)
 *   (나) 스토어에 그 제품이 없다 (미국 미출시·단종)
 *   (다) 있는데 표기가 달라 토큰 대조가 실패한다 (고칠 수 있는 것)
 *
 * (다)만 코드로 해결된다. 셋을 뭉뚱그리면 «스토어를 더 찾자» 는 잘못된 결론이 나온다.
 * 그래서 후보 상위 3개를 **눈으로 볼 수 있게** 찍는다.
 *
 * **실측 결론**: (다)는 거의 없었다. 후보 33건을 눈으로 확인하니 대부분 같은 라인의
 * 다른 제품(세럼↔크림·크림↔토너)이었다. 접두 일치를 넣어 실제로 늘어난 것은 3건뿐이다.
 * 카탈로그가 안 늘어나는 이유는 대조 알고리즘이 아니라 **DB 에 있는 제품을 그 스토어가
 * 팔지 않기 때문**이다. 하한 0.8 을 낮추면 형제 제품의 전성분이 붙는다 — 하면 안 된다.
 *
 * 실행: npx tsx scripts/diagnose-name-match-failures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { validateIngredientList } from "../src/lib/catalog/validateIngredientList";
import {
  findBrandStore,
  nameSimilarity,
  nameTokens,
  NAME_MATCH_MIN,
} from "../src/lib/catalog/brandGlobalStores";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0)";

type Row = {
  id: number;
  name: string | null;
  brand: string | null;
  full_ingredients: string[] | string | null;
};
type ShopifyProduct = { id: number; title: string; handle: string };

function asText(v: Row["full_ingredients"]): string {
  return Array.isArray(v) ? v.join(", ") : String(v ?? "");
}

async function fetchAll(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,name,brand,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function fetchCatalog(domain: string): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page += 1) {
    try {
      const r = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
        headers: { "User-Agent": UA },
      });
      if (!r.ok) break;
      const j = (await r.json()) as { products?: ShopifyProduct[] };
      const batch = j.products ?? [];
      out.push(...batch);
      if (batch.length < 250) break;
    } catch {
      break;
    }
    await new Promise((res) => setTimeout(res, 600));
  }
  return out;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    console.log("자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAll(client);
  const targets = rows.filter((r) => {
    const t = asText(r.full_ingredients).trim();
    if (t.length > 0 && validateIngredientList(t).ok) return false;
    return findBrandStore(r.brand) != null;
  });

  console.log(`대조 진단 대상 ${targets.length}건\n`);

  const catalogs = new Map<string, ShopifyProduct[]>();
  const byDomain = new Map<string, Row[]>();
  for (const r of targets) {
    const d = findBrandStore(r.brand)!;
    byDomain.set(d, [...(byDomain.get(d) ?? []), r]);
  }

  const report: Array<{
    id: number;
    brand: string;
    name: string;
    domain: string;
    catalogSize: number;
    best: number;
    candidates: Array<{ title: string; sim: number }>;
    verdict: string;
  }> = [];

  for (const [domain, mine] of byDomain) {
    if (!catalogs.has(domain)) catalogs.set(domain, await fetchCatalog(domain));
    const catalog = catalogs.get(domain)!;
    console.log(`\n═══ ${domain} — 카탈로그 ${catalog.length}건 · 대상 ${mine.length}건 ═══`);

    for (const r of mine) {
      const brand = String(r.brand ?? "");
      const want = nameTokens(String(r.name ?? ""), brand);
      const scored = catalog
        .map((p) => ({ title: p.title, sim: nameSimilarity(want, nameTokens(p.title, brand)) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3);
      const best = scored[0]?.sim ?? 0;

      // 2026-07-30 33건을 눈으로 확인한 결과, 0.5~0.79 구간은 «표기 차이» 가 아니라
      // **같은 라인의 다른 제품**이 대부분이었다:
      //
      //   Rich Moist Soothing Serum   ↔ Rich Moist Soothing Cream
      //   Black Rice Hyaluronic Cream ↔ Black Rice Hyaluronic Toner
      //   Pure Fit Cica Serum         ↔ Pure Fit Cica Creamy Foam Cleanser
      //
      // 즉 «점수를 낮추면 더 붙는다» 가 아니라 **스토어에 그 제품이 없다** 는 뜻이다.
      // 처음에 이 구간을 «고칠 수 있는 것» 으로 이름 붙였는데 틀렸다. 하한 0.8 은
      // 제 역할을 하고 있다 — 낮추면 형제 제품의 전성분이 붙는다.
      const verdict =
        catalog.length === 0
          ? "(가) 카탈로그를 못 받음"
          : best >= NAME_MATCH_MIN
            ? "통과"
            : best >= 0.5
              ? "(나-1) 같은 라인의 다른 제품만 있음"
              : "(나-2) 스토어에 흔적 없음";

      report.push({
        id: r.id,
        brand,
        name: String(r.name ?? ""),
        domain,
        catalogSize: catalog.length,
        best: Number(best.toFixed(2)),
        candidates: scored.map((s) => ({ title: s.title, sim: Number(s.sim.toFixed(2)) })),
        verdict,
      });

      if (best >= NAME_MATCH_MIN) continue;
      console.log(`\n  ${String(r.id).padStart(4)} «${r.name}»  최고 ${best.toFixed(2)} — ${verdict}`);
      for (const s of scored) console.log(`         ${s.sim.toFixed(2)}  ${s.title}`);
    }
  }

  const count = (v: string) => report.filter((x) => x.verdict.startsWith(v)).length;
  console.log("\n\n════ 원인별 집계 ════");
  console.log(`  통과                              ${count("통과")}`);
  console.log(`  (가) 카탈로그를 못 받음            ${count("(가)")}`);
  console.log(`  (나-1) 같은 라인의 다른 제품만 있음  ${count("(나-1)")}`);
  console.log(`  (나-2) 스토어에 흔적 없음            ${count("(나-2)")}`);

  mkdirSync("artifacts/brand-discovery", { recursive: true });
  const path = "artifacts/brand-discovery/name-match-diagnosis.json";
  writeFileSync(path, JSON.stringify({ checkedAt: new Date().toISOString(), report }, null, 2), "utf8");
  console.log(`\n결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[diagnose-name-match-failures] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
