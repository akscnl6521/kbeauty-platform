/**
 * 출시 전 **실제 상태**를 재는 관문 (WQ-G).
 *
 * ## 왜 따로 만드나
 *
 * `check:production` 은 파일 세 개가 있는지와 npm 스크립트가 정의됐는지를 본다
 * (25줄). CI 에서 네트워크 없이 도는 **구조 검사**라 그 자체로는 옳지만,
 * 「출시해도 되는가」 에는 답하지 못한다. 그런데 이름 때문에 답하는 것처럼 보인다.
 *
 * 여기서는 **사용자가 보는 것**을 잰다 — DB 행 수가 아니라 라이브 API 응답,
 * 저장된 값이 아니라 화면에 뜨는 값. 2026-08-09 에 「이미지 84/84」 라고 보고했지만
 * 화면에는 한 장도 안 뜬 적이 있다. DB 를 세면 그런 걸 못 잡는다.
 *
 * ## 차단(FAIL)과 보고(INFO)를 나눈다
 *
 * **차단**은 «이대로 나가면 사용자가 잘못된 것을 본다» 인 것만이다.
 * 나머지는 숫자로 보고만 한다 — 출시 기준을 스크립트가 정하지 않는다.
 * 무엇을 차단으로 볼지는 운영자가 정할 일이고, 여기서는 근거만 준다.
 *
 * Production 을 **읽기만** 한다.
 *
 * 실행: npm run gate:prelaunch
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const SITE = "https://www.kbeautymatch.com";
const SCREENS = ["/", "/quiz", "/analyze", "/results", "/routine", "/face-explorer"];

type Check = { name: string; blocking: boolean; ok: boolean; detail: string };

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

async function main() {
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
  console.log(`대상 DB: Production (${ref}) · 사이트: ${SITE}\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const checks: Check[] = [];

  // ── 1. 주요 화면이 열리는가 ──────────────────────────────────
  const screenFails: string[] = [];
  for (const p of SCREENS) {
    try {
      const r = await fetch(`${SITE}${p}`, { redirect: "follow", signal: AbortSignal.timeout(25_000) });
      if (!r.ok) screenFails.push(`${p} → HTTP ${r.status}`);
    } catch {
      screenFails.push(`${p} → 못 받음`);
    }
  }
  checks.push({
    name: "주요 화면이 열린다",
    blocking: true,
    ok: screenFails.length === 0,
    detail: screenFails.length ? screenFails.join(" · ") : `${SCREENS.length}종 모두 200`,
  });

  // ── 2. 추천 풀이 비어 있지 않은가 ────────────────────────────
  const products = await fetchAll<{ id: number; brand: string | null; active: boolean | null; verified_at: string | null }>(
    client,
    "products",
    "id,brand,active,verified_at"
  );
  const pool = products.filter((p) => p.active === true && p.verified_at != null);
  const brands = new Set(pool.map((p) => String(p.brand ?? "").trim().toLowerCase()).filter(Boolean));
  checks.push({
    name: "추천 풀에 제품이 있다",
    blocking: true,
    ok: pool.length > 0,
    detail: `제품 ${pool.length}건 · 브랜드 ${brands.size}개`,
  });

  // ── 3. 화면에 이미지가 실제로 뜨는가 ─────────────────────────
  //
  // **DB 행 수가 아니라 라이브 API 로 잰다.** 저장돼 있어도 `validation_status`
  // 나 `http://` 때문에 화면에는 안 뜬 적이 있다(2026-08-09).
  let imageDetail = "확인 못 함";
  let imageOk = false;
  try {
    const r = await fetch(`${SITE}/api/catalog/product-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: pool.map((p) => String(p.id)) }),
      signal: AbortSignal.timeout(60_000),
    });
    const urls = ((await r.json()) as { urls?: Record<string, string> }).urls ?? {};
    const values = Object.values(urls).map(String);
    const insecure = values.filter((v) => /^http:\/\//i.test(v)).length;
    const shared = values.length - new Set(values).size;
    imageOk = Object.keys(urls).length === pool.length && insecure === 0 && shared === 0;
    imageDetail =
      `${Object.keys(urls).length}/${pool.length}건 · http:// ${insecure}건 · ` +
      `서로 다른 제품이 공유하는 사진 ${shared}건`;
  } catch (e) {
    imageDetail = `이미지 API 호출 실패: ${e instanceof Error ? e.message : e}`;
  }
  checks.push({ name: "화면에 제품 사진이 뜬다", blocking: true, ok: imageOk, detail: imageDetail });

  // ── 4. 서로 다른 제품이 같은 전성분을 들고 있지 않은가 ────────
  //
  // 한쪽이 «남의 전성분» 이면 알레르기 판정이 엉뚱한 제형을 본다.
  // 용량만 다른 같은 제형은 정상이므로, **출처가 다른데 성분이 같은 것**만 센다.
  const full = await fetchAll<{ id: number; brand: string | null; full_ingredients: unknown }>(
    client,
    "products",
    "id,brand,full_ingredients"
  );
  const links = await fetchAll<{ product_id: string; source_url: string | null }>(
    client,
    "product_ingredients",
    "id,product_id,source_url"
  );
  const sourceOf = new Map<string, string>();
  for (const l of links) {
    const pid = String(l.product_id);
    if (l.source_url && !sourceOf.has(pid)) sourceOf.set(pid, l.source_url);
  }
  const poolIds = new Set(pool.map((p) => String(p.id)));
  const byFormula = new Map<string, string[]>();
  for (const p of full) {
    if (!poolIds.has(String(p.id))) continue;
    const fi = Array.isArray(p.full_ingredients) ? (p.full_ingredients as unknown[]) : [];
    if (fi.length < 5) continue;
    const k = `${String(p.brand ?? "").toLowerCase()}||${fi.map((x) => String(x).replace(/\s+/g, "").toLowerCase()).join(",")}`;
    byFormula.set(k, [...(byFormula.get(k) ?? []), String(p.id)]);
  }
  const crossSource: string[] = [];
  for (const [, ids] of byFormula) {
    if (ids.length < 2) continue;
    const sources = new Set(ids.map((id) => sourceOf.get(id) ?? "").filter(Boolean));
    if (sources.size > 1) crossSource.push(ids.join("·"));
  }
  checks.push({
    name: "남의 전성분을 들고 있는 제품이 없다",
    blocking: false,
    ok: crossSource.length === 0,
    detail: crossSource.length
      ? `출처가 다른데 전성분이 같은 묶음 ${crossSource.length}개 (${crossSource.slice(0, 3).join(" / ")}) — 용량만 다른 같은 제형일 수도 있으니 사람이 본다`
      : "없음",
  });

  // ── 5. 국내에서 살 수 있는 제품이 몇 건인가 (보고) ───────────
  const offers = await fetchAll<Record<string, unknown>>(client, "product_offers", "*");
  const { normalizeProductOffer, isOfferPurchasableForCta } = await import("@/lib/recommend");
  const buyable = new Set<string>();
  for (const raw of offers) {
    try {
      const o = normalizeProductOffer(raw as never);
      if (isOfferPurchasableForCta(o, "KR")) buyable.add(String((raw as { product_id?: unknown }).product_id));
    } catch {
      /* 판정 불가한 오퍼는 그냥 뺀다 */
    }
  }
  const poolBuyable = pool.filter((p) => buyable.has(String(p.id))).length;
  checks.push({
    name: "국내에서 «구매하기» 가 뜨는 제품",
    blocking: false,
    ok: true,
    detail: `${poolBuyable} / ${pool.length}건`,
  });

  // ── 6. 오퍼를 마지막으로 확인한 게 언제인가 (보고) ──────────
  //
  // 구매 CTA 관문은 `verifiedAt` 이 **있는지**만 보고 **얼마나 오래됐는지는
  // 보지 않는다.** 그래서 오래된 값도 그대로 «구매하기» 로 나간다. 신선도를
  // 자격 조건으로 바꾸는 건 국내 오퍼 규칙을 바꾸는 일이라 사람이 정할 몫이고,
  // 여기서는 **숫자를 보이게** 한다. 다시 확인하려면 `check:kr-offer-freshness`.
  const nowMs = Date.now();
  const offerAges = offers
    .map((o) => {
      const t = (o as { last_checked_at?: unknown; verified_at?: unknown }).last_checked_at ??
        (o as { verified_at?: unknown }).verified_at;
      return typeof t === "string" ? Math.floor((nowMs - new Date(t).getTime()) / 86_400_000) : null;
    })
    .filter((d): d is number => d != null);
  const oldest = offerAges.length ? Math.max(...offerAges) : 0;
  const overMonth = offerAges.filter((d) => d > 30).length;
  checks.push({
    name: "오퍼를 마지막으로 확인한 시점",
    blocking: false,
    ok: overMonth === 0,
    detail: `가장 오래된 것 ${oldest}일 전 · 한 달 넘은 오퍼 ${overMonth}행 / ${offerAges.length}행`,
  });

  // ── 출력 ────────────────────────────────────────────────────
  console.log("── 차단 항목 (이대로 나가면 사용자가 잘못된 것을 본다) ──");
  for (const c of checks.filter((c) => c.blocking))
    console.log(`  ${c.ok ? "통과" : "**막힘**"}  ${c.name.padEnd(28)} ${c.detail}`);
  console.log("\n── 보고 항목 (출시 기준은 사람이 정한다) ──");
  for (const c of checks.filter((c) => !c.blocking))
    console.log(`  ${c.ok ? "  · " : "  ! "}  ${c.name.padEnd(28)} ${c.detail}`);

  mkdirSync("artifacts/production-audit", { recursive: true });
  writeFileSync(
    "artifacts/production-audit/prelaunch-readiness.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), site: SITE, checks }, null, 2),
    "utf8"
  );
  console.log("\n결과 저장: artifacts/production-audit/prelaunch-readiness.json");

  const blocked = checks.filter((c) => c.blocking && !c.ok);
  if (blocked.length) {
    console.error(`\n출시 관문 **미통과** — 막힌 항목 ${blocked.length}개`);
    process.exitCode = 1;
    return;
  }
  console.log("\n출시 관문 차단 항목 통과. 보고 항목은 위 숫자를 보고 판단한다.");
}

main().catch((e) => {
  console.error("[gate-prelaunch-readiness] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
