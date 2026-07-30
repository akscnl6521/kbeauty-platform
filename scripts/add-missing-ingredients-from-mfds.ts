/**
 * 미매칭으로 남은 성분을 **식약처 화장품 원료성분정보에서 확인해** Production
 * 사전에 넣는다.
 *
 * 지어내지 않는다 — 식약처 응답에 있는 한글명·영문명 그대로만 넣고, 없으면
 * 넣지 않고 목록으로 보고한다.
 *
 * 전량을 한 번 받아 메모리에서 대조한다. 이름별로 API 를 두드리면 20번 호출인데,
 * 이 API 는 이름 검색 파라미터가 확실하지 않아 전량 대조가 더 안전하다.
 *
 * 실행: npm run add:missing-ingredients -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const PAGE_SIZE = 500;

type MfdsRow = { korName: string; engName: string };

function parseXmlItems(xml: string): { rows: MfdsRow[]; resultCode: string } {
  const code = xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1]?.trim() ?? "";
  const rows: MfdsRow[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const t = (tag: string) =>
      (m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .trim();
    rows.push({ korName: t("INGR_KOR_NAME"), engName: t("INGR_ENG_NAME") });
  }
  return { rows, resultCode: code };
}

function parseJsonItems(body: string): { rows: MfdsRow[]; resultCode: string } {
  try {
    const j = JSON.parse(body);
    const items = j?.body?.items ?? j?.response?.body?.items ?? [];
    const arr = Array.isArray(items) ? items : (items?.item ?? []);
    const rows = (Array.isArray(arr) ? arr : [arr]).map((r: Record<string, string>) => ({
      korName: (r.INGR_KOR_NAME ?? "").trim(),
      engName: (r.INGR_ENG_NAME ?? "").trim(),
    }));
    const code = j?.header?.resultCode ?? j?.response?.header?.resultCode ?? "";
    return { rows, resultCode: String(code).trim() };
  } catch {
    return { rows: [], resultCode: "" };
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prodUrl = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const prodKey = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const apiUrl = (process.env.MFDS_COSMETIC_INGREDIENT_API_URL ?? "").trim();
  const apiKey = (process.env.MFDS_DATA_GO_KR_SERVICE_KEY ?? process.env.DATA_GO_KR_SERVICE_KEY ?? "").trim();

  if (!prodUrl || !prodKey) {
    console.log("Production 자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((prodUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }
  if (!apiUrl || !apiKey) {
    console.log(`식약처 API 설정 없음 — URL ${apiUrl ? "있음" : "없음"} · 키 ${apiKey ? "있음" : "없음"}`);
    process.exitCode = 2;
    return;
  }

  const { normalizeTextKey, ingredientNameVariants, ingredientTokenLookupCandidates } =
    await import("@/lib/pipeline/ingredient-normalize");
  const client = createClient(prodUrl, prodKey, { auth: { persistSession: false } });

  // 1. 현재 사전 키
  const { data: dict } = await client.from("ingredients").select("id,name_en,name_ko");
  const keys = new Set<string>();
  for (const r of (dict ?? []) as Array<{ name_en: string | null; name_ko: string | null }>) {
    for (const n of [r.name_en, r.name_ko]) {
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k) keys.add(k);
      }
    }
  }

  // 2. 아직 비활성인 제품의 미매칭 성분 모으기
  const { data: prods } = await client
    .from("products")
    .select("id,full_ingredients,active,verified_at")
    .not("full_ingredients", "is", null);
  const missing = new Map<string, number>();
  for (const p of (prods ?? []) as Array<{
    full_ingredients: string[];
    active: boolean | null;
    verified_at: string | null;
  }>) {
    if (p.active === true && p.verified_at != null) continue;
    for (const t of p.full_ingredients ?? []) {
      const cand = ingredientTokenLookupCandidates(String(t));
      const matched =
        keys.has(cand.whole) ||
        (cand.segments.length >= 2 && cand.segments.every((s) => keys.has(s)));
      if (!matched) missing.set(String(t), (missing.get(String(t)) ?? 0) + 1);
    }
  }
  console.log(`미매칭 성분 ${missing.size}종`);

  // 3. 식약처 전량 수신
  console.log("식약처 원료성분정보 수신 중…");
  const mfds: MfdsRow[] = [];
  for (let page = 1; page <= 60; page += 1) {
    const u = new URL(apiUrl);
    u.searchParams.set("serviceKey", apiKey);
    u.searchParams.set("pageNo", String(page));
    u.searchParams.set("numOfRows", String(PAGE_SIZE));
    u.searchParams.set("_type", "json");
    const r = await fetch(u.toString(), { redirect: "follow" });
    const body = await r.text();
    const parsed = body.trimStart().startsWith("<") ? parseXmlItems(body) : parseJsonItems(body);
    if (parsed.resultCode && parsed.resultCode !== "00") {
      console.log(`  page ${page}: resultCode ${parsed.resultCode} — 중단`);
      break;
    }
    if (parsed.rows.length === 0) break;
    mfds.push(...parsed.rows);
    if (parsed.rows.length < PAGE_SIZE) break;
  }
  console.log(`  ${mfds.length}행 수신`);

  // 4. 대조
  const mfdsByKey = new Map<string, MfdsRow>();
  for (const row of mfds) {
    for (const n of [row.engName, row.korName]) {
      for (const v of ingredientNameVariants(n)) {
        const k = normalizeTextKey(v);
        if (k && !mfdsByKey.has(k)) mfdsByKey.set(k, row);
      }
    }
  }

  const found: Array<{ token: string; row: MfdsRow }> = [];
  const notFound: string[] = [];
  for (const token of missing.keys()) {
    const cand = ingredientTokenLookupCandidates(token);
    const hit = mfdsByKey.get(cand.whole);
    if (hit) found.push({ token, row: hit });
    else notFound.push(token);
  }

  console.log(`\n식약처에서 확인됨 ${found.length}종 · 확인 안 됨 ${notFound.length}종`);
  for (const f of found.slice(0, 40))
    console.log(`  ✔ ${f.token.slice(0, 44).padEnd(46)} → ${f.row.engName} / ${f.row.korName}`);
  console.log("\n확인 안 된 것 (넣지 않는다):");
  for (const n of notFound.slice(0, 40)) console.log(`  ✗ ${n.slice(0, 60)}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 적재한다.");
    return;
  }
  if (found.length === 0) return;

  // 5. 적재 — slug 는 영문명에서 만든다.
  //
  // 두 가지를 막는다:
  //   · 여러 토큰이 같은 식약처 행에 걸리면 slug 가 겹친다 (대소문자만 다른 표기 등)
  //   · 이미 사전에 있는 slug 와도 겹칠 수 있다
  // `ingredients_slug_key` 가 unique 라 한 건만 겹쳐도 배치 전체가 실패한다.
  // 그래서 배치 대신 **한 건씩** 넣고, 겹치는 것은 건너뛴다.
  const { data: existingSlugs } = await client.from("ingredients").select("slug");
  const takenSlugs = new Set(
    ((existingSlugs ?? []) as Array<{ slug: string | null }>).map((r) => (r.slug ?? "").toLowerCase())
  );

  const rows: Array<{ slug: string; name_en: string | null; name_ko: string | null }> = [];
  for (const f of found) {
    const base = normalizeTextKey(f.row.engName || f.row.korName).replace(/\s+/g, "-").slice(0, 80);
    if (!base) continue;
    if (takenSlugs.has(base)) continue;
    takenSlugs.add(base);
    rows.push({
      slug: base,
      name_en: f.row.engName || null,
      name_ko: f.row.korName || null,
    });
  }
  console.log(`
slug 중복 제외 후 실제 적재 대상 ${rows.length}행`);

  let inserted = 0;
  for (const row of rows) {
    const { data, error } = await client.from("ingredients").insert(row).select("id");
    if (error) {
      console.log(`  ${row.name_en ?? row.name_ko}: ${error.code} ${error.message.slice(0, 60)}`);
      continue;
    }
    inserted += (data ?? []).length;
  }
  const { count } = await client.from("ingredients").select("*", { count: "exact", head: true });
  console.log(`\n적재 ${inserted}행 · 사전 총 ${count}행`);
}

main().catch((e) => {
  console.error("[add-missing-ingredients-from-mfds] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
