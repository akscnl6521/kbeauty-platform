/**
 * 식약처 «화장품 원료성분정보» 전량 조사 — **읽기 전용**.
 *
 * 지금 사전(`ingredients` 602건)이 얕아서 제품이 게이트를 못 넘고 있다(§30-10).
 * 이 API 가 그 빈칸을 메워 줄 수 있는지 **먼저 재 보는** 스크립트다.
 * DB 에 아무것도 쓰지 않는다 — Staging 은 대조를 위해 읽기만 한다.
 *
 * 결과는 `artifacts/mfds-ingredient-survey/` 에 남긴다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/survey-mfds-ingredient-catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const OUT_DIR = path.join("artifacts", "mfds-ingredient-survey");
/** 이 API 의 상한. 넘기면 resultCode 11 «numOfRows maximum is =[500]» 이 온다. */
const PAGE_SIZE = 500;

type MfdsIngredient = {
  korName: string;
  engName: string;
  casNo: string;
  origin: string;
  synonym: string;
};

/**
 * 응답은 `content-type: application/json` 이라고 오는데 본문은 XML 이다.
 * 그래서 JSON.parse 를 믿으면 안 된다. `<item>` 이 중첩 없는 평평한 구조라
 * 여기서는 정규식으로 충분하다 — 다만 이 전제가 깨지면 조용히 틀리므로,
 * 실제 수집기에서는 §«파서 처리 방안» 대로 XML 파서를 쓴다.
 */
function parseItems(xml: string): MfdsIngredient[] {
  const out: MfdsIngredient[] = [];
  const field = (block: string, tag: string): string => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    if (!m) return ""; // <TAG/> 자기닫힘 = 빈 값
    return m[1]!
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  };
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]!;
    out.push({
      korName: field(b, "INGR_KOR_NAME"),
      engName: field(b, "INGR_ENG_NAME"),
      casNo: field(b, "CAS_NO"),
      origin: field(b, "ORIGIN_MAJOR_KOR_NAME"),
      synonym: field(b, "INGR_SYNONYM"),
    });
  }
  return out;
}

function totalCountOf(xml: string): number {
  const m = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  return m ? Number(m[1]) : 0;
}

async function fetchPage(
  baseUrl: string,
  key: string,
  pageNo: number,
  redact: (s: string) => string
): Promise<string> {
  const u = new URL(baseUrl);
  u.searchParams.set("serviceKey", key);
  u.searchParams.set("pageNo", String(pageNo));
  u.searchParams.set("numOfRows", String(PAGE_SIZE));
  u.searchParams.set("_type", "json");

  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
      const r = await fetch(u.toString(), { signal: c.signal, redirect: "follow" });
      const body = await r.text();
      if (r.ok && /<resultCode>00<\/resultCode>/.test(body)) return body;
      lastErr = redact(`HTTP ${r.status} ${body.slice(0, 160)}`);
    } catch (e) {
      lastErr = redact(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw new Error(`page ${pageNo} 실패: ${lastErr}`);
}

async function fetchAllRows(c: SupabaseClient, table: string, select: string) {
  const out: Record<string, unknown>[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await c.from(table).select(select).order("id").range(off, off + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

async function main() {
  const { redactSecrets } = await import("../src/lib/publicData/secrets");
  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps, normalizeTextKey } =
    await import("../src/lib/pipeline/ingredient-normalize");

  const key = (
    process.env.MFDS_DATA_GO_KR_SERVICE_KEY ||
    process.env.DATA_GO_KR_SERVICE_KEY ||
    ""
  ).trim();
  const baseUrl = (process.env.MFDS_COSMETIC_INGREDIENT_API_URL ?? "").trim();
  if (!key || !baseUrl) throw new Error("인증키 또는 원료성분정보 URL 이 없다");
  const redact = (s: string) => redactSecrets(s, [key]);

  // ---------- 1. 전량 수집 ----------
  const first = await fetchPage(baseUrl, key, 1, redact);
  const total = totalCountOf(first);
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`총 ${total.toLocaleString()}건 / ${PAGE_SIZE}건씩 ${pages}페이지\n`);

  const rows: MfdsIngredient[] = parseItems(first);
  for (let p = 2; p <= pages; p++) {
    rows.push(...parseItems(await fetchPage(baseUrl, key, p, redact)));
    if (p % 5 === 0 || p === pages) console.log(`  ${p}/${pages} 페이지 — 누적 ${rows.length}건`);
  }

  // ---------- 2. 필드 충실도 ----------
  const pct = (n: number) => ((n / rows.length) * 100).toFixed(1) + "%";
  const withEng = rows.filter((r) => r.engName).length;
  const withCas = rows.filter((r) => r.casNo).length;
  const withOrigin = rows.filter((r) => r.origin).length;
  const withSyn = rows.filter((r) => r.synonym).length;
  const bothNames = rows.filter((r) => r.korName && r.engName).length;

  console.log(`\n=== 필드 충실도 (수집 ${rows.length.toLocaleString()}건) ===`);
  console.log(`  한글명 있음        ${String(rows.filter((r) => r.korName).length).padStart(6)}  ${pct(rows.filter((r) => r.korName).length)}`);
  console.log(`  영문명 있음        ${String(withEng).padStart(6)}  ${pct(withEng)}`);
  console.log(`  한글+영문 둘 다    ${String(bothNames).padStart(6)}  ${pct(bothNames)}   <- 사전 보강에 바로 쓸 수 있는 것`);
  console.log(`  CAS 번호 있음      ${String(withCas).padStart(6)}  ${pct(withCas)}`);
  console.log(`  기원·정의 있음     ${String(withOrigin).padStart(6)}  ${pct(withOrigin)}`);
  console.log(`  이명(synonym) 있음 ${String(withSyn).padStart(6)}  ${pct(withSyn)}`);

  // ---------- 3. 현재 막힌 미매칭 성분과 대조 ----------
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const ing = await fetchAllRows(sb, "ingredients", "id,slug,name_en,name_ko");
  const al = (await fetchAllRows(sb, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")).filter(
    (a) => a.active
  );
  const prods = await fetchAllRows(sb, "products", "id,brand,name,full_ingredients");
  const maps = buildIngredientLookupMaps(ing as never, al as never);

  // 식약처 데이터를 «한글 정규화 키 -> 영문명» 으로 색인
  const mfdsByKo = new Map<string, MfdsIngredient>();
  for (const r of rows) {
    if (!r.korName) continue;
    const k = normalizeTextKey(r.korName);
    if (k && !mfdsByKo.has(k)) mfdsByKo.set(k, r);
    // 이명도 같은 성분을 가리키므로 함께 색인한다.
    for (const s of r.synonym.split(/[,;]/)) {
      const sk = normalizeTextKey(s);
      if (sk && !mfdsByKo.has(sk)) mfdsByKo.set(sk, r);
    }
  }
  const mfdsByEn = new Map<string, MfdsIngredient>();
  for (const r of rows) {
    if (!r.engName) continue;
    const k = normalizeTextKey(r.engName);
    if (k && !mfdsByEn.has(k)) mfdsByEn.set(k, r);
  }

  type Miss = { token: string; products: number[]; hit: MfdsIngredient | null; via: string };
  const misses = new Map<string, Miss>();
  const blocked: Array<{ id: number; brand: string; name: string; un: number }> = [];

  for (const p of prods) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    const n = attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized;
    const un = n.filter((x) => !x.matchedIngredientId);
    if (un.length > 0)
      blocked.push({ id: p.id as number, brand: String(p.brand ?? ""), name: String(p.name ?? ""), un: un.length });
    for (const t of un) {
      const k = t.normalizedName;
      const e = misses.get(k) ?? { token: k, products: [], hit: null, via: "" };
      if (!e.products.includes(p.id as number)) e.products.push(p.id as number);
      misses.set(k, e);
    }
  }
  for (const m of misses.values()) {
    const ko = mfdsByKo.get(m.token);
    if (ko) {
      m.hit = ko;
      m.via = ko.engName ? "한글명/이명 -> 영문명 확보" : "한글명은 있으나 영문명 비어 있음";
      continue;
    }
    const en = mfdsByEn.get(m.token);
    if (en) {
      m.hit = en;
      m.via = "영문명 일치";
    }
  }

  const all = [...misses.values()];
  const resolvable = all.filter((m) => m.hit && m.hit.engName);
  const koOnly = all.filter((m) => m.hit && !m.hit.engName);
  const nothing = all.filter((m) => !m.hit);

  console.log(`\n=== 현재 미매칭 토큰 ${all.length}종을 식약처 데이터와 대조 ===`);
  console.log(`  영문명까지 확보됨   ${String(resolvable.length).padStart(4)}종  ${((resolvable.length / all.length) * 100).toFixed(1)}%`);
  console.log(`  한글만 있고 영문 없음 ${String(koOnly.length).padStart(4)}종`);
  console.log(`  식약처에도 없음     ${String(nothing.length).padStart(4)}종`);

  // 미매칭이 몇 건 안 남는 제품이 몇 개나 «완전 해소» 되는지
  const resolvedSet = new Set(resolvable.map((m) => m.token));
  let fullyCleared = 0;
  const perProduct: Array<{ id: number; brand: string; name: string; before: number; after: number }> = [];
  for (const p of prods) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    const n = attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized;
    const un = n.filter((x) => !x.matchedIngredientId).map((x) => x.normalizedName);
    if (un.length === 0) continue;
    const after = un.filter((t) => !resolvedSet.has(t)).length;
    if (after === 0) fullyCleared += 1;
    perProduct.push({
      id: p.id as number,
      brand: String(p.brand ?? ""),
      name: String(p.name ?? ""),
      before: un.length,
      after,
    });
  }
  console.log(`\n=== 제품 영향 ===`);
  console.log(`  현재 미매칭이 남은 제품 ${perProduct.length}건`);
  console.log(`  식약처 데이터를 넣으면 미매칭 0 이 되는 제품: ${fullyCleared}건`);

  console.log(`\n--- 미매칭 1~3건이던 제품의 예상 변화 ---`);
  for (const p of perProduct.filter((x) => x.before <= 3).sort((a, b) => a.after - b.after))
    console.log(
      `  ${String(p.id).padStart(3)} ${p.brand.slice(0, 12).padEnd(13)}${String(p.before).padStart(2)} -> ${String(p.after).padStart(2)}${p.after === 0 ? "  *** 해소 ***" : ""}  ${p.name.slice(0, 34)}`
    );

  console.log(`\n--- 식약처에도 없는 토큰 (상위 30, 대부분 파싱 손상으로 예상) ---`);
  for (const m of nothing.sort((a, b) => b.products.length - a.products.length).slice(0, 30))
    console.log(`  ${String(m.products.length).padStart(3)}개 제품  ${m.token.slice(0, 80)}`);

  console.log(`\n--- 해소되는 토큰 예시 (상위 25) ---`);
  for (const m of resolvable.sort((a, b) => b.products.length - a.products.length).slice(0, 25))
    console.log(`  ${String(m.products.length).padStart(3)}개  ${m.token.slice(0, 34).padEnd(36)}-> ${m.hit!.engName.slice(0, 46)}`);

  // ---------- 산출물 ----------
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(
      {
        surveyedAt: "2026-07-27",
        source: "식약처 화장품 원료성분정보 (data.go.kr)",
        totalCountReported: total,
        rowsCollected: rows.length,
        fieldFill: {
          engName: withEng,
          casNo: withCas,
          origin: withOrigin,
          synonym: withSyn,
          korAndEng: bothNames,
        },
        localDictionary: { ingredients: ing.length, aliases: al.length },
        unmatchedTokens: {
          total: all.length,
          resolvableWithEnglish: resolvable.length,
          koreanOnlyInMfds: koOnly.length,
          absentFromMfds: nothing.length,
        },
        productImpact: { stillUnmatched: perProduct.length, wouldFullyClear: fullyCleared },
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(OUT_DIR, "unmatched-vs-mfds.json"),
    JSON.stringify(
      all.map((m) => ({
        token: m.token,
        products: m.products,
        via: m.via || "미발견",
        mfdsKor: m.hit?.korName ?? null,
        mfdsEng: m.hit?.engName ?? null,
        mfdsCas: m.hit?.casNo ?? null,
      })),
      null,
      2
    )
  );
  writeFileSync(path.join(OUT_DIR, "product-impact.json"), JSON.stringify(perProduct, null, 2));
  console.log(`\n산출물: ${OUT_DIR}/ (summary.json · unmatched-vs-mfds.json · product-impact.json)`);
  console.log("DB 에는 아무것도 쓰지 않았다.");
}

main().catch((e) => {
  console.error("[survey-mfds-ingredient-catalog] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
