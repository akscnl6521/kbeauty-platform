/**
 * 식약처 «화장품 원료성분정보» 로 **한글 이명(異名) 사전**을 만든다.
 *
 * ## 왜 필요한가
 *
 * 성분이 없는 게 아니라 **한글 이름이 하나가 아니다.**
 *
 *   사전 26번   Salicylic Acid   name_ko = `살리실산`
 *   국내몰 표기                    `살리실릭애씨드`   ← 같은 성분, 다른 표기
 *
 *   사전  3번   Hyaluronic Acid  name_ko = `히알루론산`
 *   국내몰 표기                    `하이알루로닉애씨드`
 *
 * `backfill-ingredient-korean-names` 는 `name_ko` 가 **비어 있을 때만** 채운다.
 * 이미 다른 표기가 들어 있으면 손대지 않는다 — 덮으면 기존 화면 문구가 바뀌므로
 * 그 판단은 옳다. 그래서 이명은 **덮는 대신 따로 쌓아야** 한다.
 *
 * `ingredients` 에는 이명 컬럼이 없다. 새 행을 넣으면 같은 성분이 둘이 되어
 * 추천·알레르겐 대조가 갈라진다. 그래서 **코드 쪽 생성 파일**로 둔다.
 *
 * ## 지어내지 않는다
 *
 *   · 식약처가 준 (한글명, 영문명) 쌍만 쓴다. 우리가 만든 표기는 없다.
 *   · **영문명이 정확히 일치**할 때만 우리 사전 행에 붙인다. 비슷한 이름에 갖다
 *     붙이면 엉뚱한 성분이 매칭되고, 그때부터 알레르겐 판정이 전부 틀어진다.
 *   · 이미 `name_ko` 와 같은 표기는 넣지 않는다 — 중복일 뿐이다.
 *   · 하나의 영문명에 식약처 한글명이 여러 개면 전부 담는다. 이명은 원래 여럿이다.
 *
 * 결과는 `src/lib/pipeline/mfdsKoreanSynonyms.generated.ts` 에 쓴다. 사람이 손으로
 * 고치지 않는다 — 고칠 일이 있으면 이 스크립트를 고치고 다시 돌린다.
 *
 * 실행: npm run build:mfds-ko-synonyms
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const MFDS_ENDPOINT_ENV = "MFDS_COSMETIC_INGREDIENT_API_URL";
const OUT_PATH = "src/lib/pipeline/mfdsKoreanSynonyms.generated.ts";
const PAGE_SIZE = 500;

type MfdsRow = { INGR_KOR_NAME?: string; INGR_ENG_NAME?: string };
type IngredientRow = { id: number; name_en: string | null; name_ko: string | null };

/** 영문명 대조용 키 — 대소문자·공백·기호를 지운다. */
function engKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** 한글 표기 비교용 — 공백·가운뎃점만 지운다. 글자는 건드리지 않는다. */
function koKey(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/[\s·]/g, "");
}

function parseItems(body: string): MfdsRow[] {
  if (body.trimStart().startsWith("<")) {
    const rows: MfdsRow[] = [];
    for (const m of body.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const tag = (t: string) =>
        (m[1].match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1] ?? "")
          .replace(/<!\[CDATA\[|\]\]>/g, "")
          .trim();
      rows.push({ INGR_KOR_NAME: tag("INGR_KOR_NAME"), INGR_ENG_NAME: tag("INGR_ENG_NAME") });
    }
    return rows;
  }
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const b = (j.body ?? (j.response as Record<string, unknown> | undefined)?.body) as
      | Record<string, unknown>
      | undefined;
    const items = b?.items;
    const arr = Array.isArray(items) ? items : ((items as { item?: unknown } | undefined)?.item ?? []);
    return (Array.isArray(arr) ? arr : [arr]) as MfdsRow[];
  } catch {
    return [];
  }
}

async function fetchMfdsAll(endpoint: string, serviceKey: string): Promise<MfdsRow[]> {
  const out: MfdsRow[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    url.searchParams.set("_type", "json");
    const r = await fetch(url.toString(), { redirect: "follow" });
    if (!r.ok) throw new Error(`식약처 API HTTP ${r.status}`);
    const rows = parseItems(await r.text());
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    await new Promise((res) => setTimeout(res, 200));
  }
  return out;
}

async function fetchDictionary(client: SupabaseClient): Promise<IngredientRow[]> {
  const out: IngredientRow[] = [];
  // PostgREST 는 1000행에서 자른다 — 페이지로 넘긴다.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("ingredients")
      .select("id,name_en,name_ko")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`ingredients: ${error.code} ${error.message}`);
    const page = (data ?? []) as IngredientRow[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const serviceKey = (process.env.MFDS_DATA_GO_KR_SERVICE_KEY ?? process.env.DATA_GO_KR_SERVICE_KEY ?? "").trim();
  const endpoint = (process.env[MFDS_ENDPOINT_ENV] ?? "").trim();
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if (!serviceKey || !endpoint) {
    console.log(`식약처 인증키 또는 ${MFDS_ENDPOINT_ENV} 없음 — 중단.`);
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  console.log("식약처 원료성분정보를 받는다…");
  const mfds = await fetchMfdsAll(endpoint, serviceKey);
  console.log(`  ${mfds.length}행`);

  // 영문명 → 한글명들. 같은 영문명에 여러 한글 표기가 오는 게 이 작업의 요점이다.
  const koByEng = new Map<string, string[]>();
  for (const r of mfds) {
    const en = engKey(r.INGR_ENG_NAME);
    const ko = String(r.INGR_KOR_NAME ?? "").trim();
    if (!en || !ko) continue;
    const bucket = koByEng.get(en) ?? [];
    if (!bucket.some((x) => koKey(x) === koKey(ko))) bucket.push(ko);
    koByEng.set(en, bucket);
  }
  console.log(`  영문명 ${koByEng.size}종`);

  // --coverage: 지금 활성화가 막혀 있는 «미매칭 토큰» 을 식약처가 얼마나 덮는지 본다.
  // 파서를 새로 짜지 않고 **이미 동작이 확인된 이 스크립트 안에서** 재어야
  // 답을 믿을 수 있다 — 따로 짠 XML 파서가 조용히 0행을 돌려줘 두 번 헛짚었다.
  if (process.argv.includes("--coverage")) {
    const koToEn = new Map<string, string>();
    for (const r of mfds) {
      const ko = String(r.INGR_KOR_NAME ?? "").replace(/[\s·]/g, "");
      const en = String(r.INGR_ENG_NAME ?? "").trim();
      if (ko && en && !koToEn.has(ko)) koToEn.set(ko, en);
    }
    console.log(`
식약처 한글명 ${koToEn.size}종`);

    const { normalizeTextKey, ingredientNameVariants, isIngredientTokenKnown } = await import(
      "@/lib/pipeline/ingredient-normalize"
    );
    const dictRows = await fetchDictionary(client);
    const known = new Set<string>();
    for (const r of dictRows)
      for (const n of [r.name_en, r.name_ko])
        for (const v of ingredientNameVariants(n)) {
          const k = normalizeTextKey(v);
          if (k) known.add(k);
        }
    const { data: ps } = await client
      .from("products")
      .select("id,full_ingredients")
      .is("verified_at", null)
      .not("full_ingredients", "is", null);
    const missing = new Set<string>();
    for (const p of ps ?? [])
      for (const t of (Array.isArray(p.full_ingredients) ? p.full_ingredients : []).map(String))
        if (!isIngredientTokenKnown(t, known)) missing.add(t);

    let covered = 0;
    const examples: string[] = [];
    for (const m of missing) {
      const en = koToEn.get(m.replace(/[\s·]/g, ""));
      if (!en) continue;
      covered += 1;
      if (examples.length < 8) examples.push(`${m} → ${en}`);
    }
    console.log(`미검증 제품의 미매칭 토큰 ${missing.size}종 중 식약처가 덮는 것 ${covered}종`);
    for (const e of examples) console.log(`    ${e}`);
    return;
  }

  const dict = await fetchDictionary(client);
  console.log(`\n우리 사전 ${dict.length}행`);

  const synonyms = new Map<string, string[]>();
  let rowsWithNew = 0;
  for (const row of dict) {
    const en = engKey(row.name_en);
    if (!en) continue;
    const mfdsNames = koByEng.get(en);
    if (!mfdsNames) continue;
    // 이미 들고 있는 표기는 이명이 아니다.
    const have = koKey(row.name_ko);
    const fresh = mfdsNames.filter((n) => koKey(n) !== have);
    if (fresh.length === 0) continue;
    rowsWithNew += 1;
    const bucket = synonyms.get(en) ?? [];
    for (const n of fresh) if (!bucket.includes(n)) bucket.push(n);
    synonyms.set(en, bucket);
  }

  const total = [...synonyms.values()].reduce((a, b) => a + b.length, 0);
  console.log(`한글 이명을 찾은 성분 ${rowsWithNew}행 · 이명 ${total}개\n`);
  for (const row of dict.slice(0, 0)) void row;
  let shown = 0;
  for (const [en, names] of synonyms) {
    if (shown >= 12) break;
    const row = dict.find((d) => engKey(d.name_en) === en);
    console.log(`  ${String(row?.name_en).slice(0, 38).padEnd(40)} ${row?.name_ko ?? "(없음)"} + ${names.join(", ")}`);
    shown += 1;
  }
  if (synonyms.size > shown) console.log(`  … 외 ${synonyms.size - shown}종`);

  const sorted = [...synonyms.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const body = sorted
    .map(([en, names]) => `  ${JSON.stringify(en)}: [${names.map((n) => JSON.stringify(n)).join(", ")}],`)
    .join("\n");

  mkdirSync("src/lib/pipeline", { recursive: true });
  writeFileSync(
    OUT_PATH,
    `/**
 * **자동 생성 파일 — 손으로 고치지 않는다.**
 *
 * 만든 것: \`scripts/build-mfds-korean-synonyms.ts\`
 * 출처: 식약처 «화장품 원료성분정보» 공개 API
 *
 * 우리 성분 사전의 **영문명**(기호·대소문자를 지운 키)에 대해, 식약처가 쓰는
 * 한글 표기 중 우리 \`name_ko\` 와 다른 것들을 모았다. 국내몰 전성분은 이 표기로
 * 적혀 오는 일이 많아서, 이게 없으면 «성분이 사전에 없다» 로 잘못 판정된다.
 *
 * 다시 만들려면: npm run build:mfds-ko-synonyms
 */
export const MFDS_KOREAN_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
${body}
};
`,
    "utf8"
  );
  console.log(`\n${OUT_PATH} 에 ${synonyms.size}종 / ${total}개 기록`);
}

main().catch((e) => {
  console.error("[build-mfds-korean-synonyms] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
