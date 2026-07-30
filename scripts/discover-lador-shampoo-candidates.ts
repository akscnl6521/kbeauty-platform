/**
 * lador.co.kr SHAMPOO/RINSE 카테고리를 후보로 등록한다.
 *
 * 여기서는 **발견만 한다.** 크롤·성분 매칭·오퍼 수집·품질 게이트는 기존
 * `scripts/collect-scalp-hair-tier1.ts` 가 그대로 처리한다 — 새 수집 로직을
 * 만들지 않는다.
 *
 * robots.txt 는 `/product/` 를 허용한다(금지는 /exec/front/, /api, /member/ 등).
 * 목록 페이지에서 상품 링크와 이름만 읽고, 나머지 판단은 파이프라인에 맡긴다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/discover-lador-shampoo-candidates.ts            # 검증만
 *   ... scripts/discover-lador-shampoo-candidates.ts --apply  # 후보 등록
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

const ORIGIN = "https://lador.co.kr";
/** SHAMPOO/RINSE. 브랜드가 스스로 분류한 카테고리를 그대로 쓴다. */
const CATEGORY_URL = `${ORIGIN}/product/list.html?cate_no=24`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const listing = await (await fetch(CATEGORY_URL, { headers: { "user-agent": UA } })).text();

  // 목록의 상품 링크. 이름은 링크 경로에 들어 있는 것을 그대로 쓴다 —
  // 지어내지 않고, 정확한 제품명은 상세 페이지 추출이 다시 확인한다.
  //
  // Cafe24 는 같은 상품을 `/product/<이름>/<id>/category/<n>/display/<n>/` 과
  // `/product/<이름>/<id>/` 두 경로로 낸다. 앞의 형태는 경로에 «category» 가
  // 들어 있어서 파이프라인의 상품 URL 판정(`looksLikeProductUrl`)이 목록
  // 페이지로 보고 거부한다. 그 판정은 옳으므로 건드리지 않고, **정규 형태**로
  // 등록한다.
  const found = new Map<string, { url: string; name: string }>();
  for (const m of listing.matchAll(/href="(\/product\/([^/"]+)\/(\d+)\/)(?:category\/\d+\/display\/\d+\/)?"/g)) {
    const [, canonical, slugName, pid] = m;
    if (found.has(pid!)) continue;
    found.set(pid!, {
      url: ORIGIN + canonical,
      name: decodeURIComponent(slugName!).replace(/-/g, " ").trim(),
    });
  }
  console.log(`목록에서 상품 ${found.size}개 발견`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingCand } = await client
    .from("product_discovery_candidates")
    .select("id,discovered_url,workflow_status")
    .ilike("discovered_url", "%lador.co.kr%")
    .limit(500);

  /** URL 에서 Cafe24 상품 번호를 뽑는다. 같은 상품인지 판단하는 기준. */
  const pidOf = (u: string): string | null =>
    decodeURIComponent(u).match(/\/product\/[^/]+\/(\d+)\//)?.[1] ?? null;

  const byPid = new Map<string, { id: string; discovered_url: string }>();
  for (const c of existingCand ?? []) {
    const pid = pidOf(String(c.discovered_url));
    if (pid && !byPid.has(pid)) byPid.set(pid, { id: String(c.id), discovered_url: String(c.discovered_url) });
  }
  const knownCandUrls = new Set((existingCand ?? []).map((c) => String(c.discovered_url)));

  const { data: existingOffers } = await client
    .from("product_offers")
    .select("purchase_url")
    .ilike("purchase_url", "%lador.co.kr%")
    .limit(500);
  const knownProductUrls = new Set(
    (existingOffers ?? []).map((o) => decodeURIComponent(String(o.purchase_url ?? "")))
  );

  const rows: Array<Record<string, unknown>> = [];
  const urlFixes: Array<{ id: string; from: string; to: string }> = [];
  for (const [pid, info] of found) {
    const decoded = decodeURIComponent(info.url);
    const prior = byPid.get(pid);
    if (prior) {
      // 같은 상품이 이미 후보로 있다. URL 형태가 다르면 정규 형태로 고친다.
      if (prior.discovered_url !== info.url) {
        urlFixes.push({ id: prior.id, from: prior.discovered_url, to: info.url });
      } else {
        console.log(`  건너뜀 ${pid} 이미 후보로 있음`);
      }
      continue;
    }
    if (knownCandUrls.has(info.url) || knownCandUrls.has(decoded)) {
      console.log(`  건너뜀 ${pid} 이미 후보로 있음`);
      continue;
    }
    if (knownProductUrls.has(decoded)) {
      console.log(`  건너뜀 ${pid} 이미 제품 오퍼로 등록됨`);
      continue;
    }
    rows.push({
      discovered_name: info.name,
      discovered_brand: "라도르",
      discovered_url: info.url,
      discovered_country: "KR",
      source_type: "official_brand_page",
      workflow_status: "discovered",
      notes: "[lador-shampoo-2026-07-27] cate_no=24 SHAMPOO/RINSE",
    });
  }

  console.log(`\n신규 등록 ${rows.length}건 / URL 정규화 ${urlFixes.length}건`);
  for (const r of rows) console.log(`  신규  ${String(r.discovered_name).slice(0, 56)}`);
  for (const f of urlFixes) console.log(`  수정  ${decodeURIComponent(f.to).slice(0, 66)}`);

  if (!apply) {
    console.log("\n검증 모드. 등록하려면 --apply 를 붙인다.");
    return;
  }

  for (const f of urlFixes) {
    const { error } = await client
      .from("product_discovery_candidates")
      .update({ discovered_url: f.to })
      .eq("id", f.id);
    if (error) throw new Error(`URL 갱신 실패 ${f.id}: ${error.code} ${error.message}`);
  }
  if (urlFixes.length > 0) console.log(`URL ${urlFixes.length}건 정규화 완료`);

  if (rows.length === 0) {
    console.log("\n이어서 기존 수집기를 돌린다:");
    console.log("  node --import ./scripts/register-server-only.mjs --import tsx/esm scripts/collect-scalp-hair-tier1.ts");
    return;
  }

  const { data, error } = await client.from("product_discovery_candidates").insert(rows).select("id");
  if (error) {
    console.error(`\n[중단] 후보 등록 실패: ${error.code} ${error.message}`);
    if (error.code === "42501")
      console.error("필요한 GRANT:\n  GRANT INSERT ON TABLE public.product_discovery_candidates TO service_role;");
    process.exitCode = 1;
    return;
  }
  console.log(`\n후보 ${data?.length ?? 0}건 등록. 이어서 기존 수집기를 돌린다:`);
  console.log("  node --import ./scripts/register-server-only.mjs --import tsx/esm scripts/collect-scalp-hair-tier1.ts");
}

main().catch((e) => {
  console.error("[discover-lador-shampoo-candidates] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
