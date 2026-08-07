/**
 * 성분 사전의 **비어 있는 한글명을 식약처 자료로 채운다.**
 *
 * ## 왜 필요한가
 *
 * 사전은 영문 제품 위주로 만들어져 `name_ko` 가 빈 행이 많다. 그래서 국내몰에서
 * 등록한 제품(전성분이 한글)이 사전과 대조되지 않는다 — `부틸렌글라이콜` 이 22번,
 * `글리세린` 이 21번 미매칭으로 잡혔다. **성분이 없는 게 아니라 한글 이름이 없는 것**이다.
 *
 * 새 행을 넣으면 같은 성분이 둘이 된다. **기존 행의 `name_ko` 를 채우는 것**이 맞다.
 *
 * ## 지어내지 않는다
 *
 *   · 식약처 «화장품 원료성분정보» 가 준 한글명·영문명 쌍만 쓴다.
 *   · 우리 사전의 **영문명이 정확히 일치**할 때만 채운다. 비슷한 이름에 갖다 붙이면
 *     엉뚱한 성분에 한글명이 달리고, 그 뒤로 모든 대조가 틀어진다.
 *   · 이미 `name_ko` 가 있는 행은 건드리지 않는다 — 기존 값을 덮지 않는다.
 *
 * 실행: npm run backfill:ingredient-ko -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
/** 엔드포인트는 `.env.local` 이 단일 출처다 — 하드코딩하면 한쪽만 바뀌어 어긋난다. */
const MFDS_ENDPOINT_ENV = "MFDS_COSMETIC_INGREDIENT_API_URL";
const PAGE_SIZE = 500;

type MfdsRow = { INGR_KOR_NAME?: string; INGR_ENG_NAME?: string };
type IngredientRow = { id: number; name_en: string | null; name_ko: string | null };

/** 영문명 대조용 키 — 대소문자·공백·기호를 지운다. */
function engKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** 이 API 는 XML 로 올 때도 있고 JSON 으로 올 때도 있다. 둘 다 받는다. */
function parseItems(body: string): MfdsRow[] {
  if (body.trimStart().startsWith("<")) {
    const rows: MfdsRow[] = [];
    for (const m of body.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const tag = (t: string) =>
        (m[1].match(new RegExp(`<${t}>([\s\S]*?)</${t}>`))?.[1] ?? "")
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
    // `items` 가 배열일 때도, `{ item: [...] }` 로 감싸 올 때도 있다.
    const arr = Array.isArray(items)
      ? items
      : ((items as { item?: unknown } | undefined)?.item ?? []);
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

async function fetchAll(client: SupabaseClient): Promise<IngredientRow[]> {
  const out: IngredientRow[] = [];
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
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const serviceKey = (
    process.env.MFDS_DATA_GO_KR_SERVICE_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY ??
    ""
  ).trim();
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  const endpoint = (process.env[MFDS_ENDPOINT_ENV] ?? "").trim();
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

  // 영문명 → 한글명. 영문명이 비어 있는 행은 대조에 쓸 수 없다.
  const koByEng = new Map<string, string>();
  for (const r of mfds) {
    const en = engKey(r.INGR_ENG_NAME);
    const ko = String(r.INGR_KOR_NAME ?? "").trim();
    if (!en || !ko) continue;
    if (!koByEng.has(en)) koByEng.set(en, ko);
  }
  console.log(`  영문↔한글 쌍 ${koByEng.size}개`);

  const rows = await fetchAll(client);
  const missingKo = rows.filter((r) => !String(r.name_ko ?? "").trim() && String(r.name_en ?? "").trim());
  console.log(`\n사전 ${rows.length}행 · 한글명이 빈 행 ${missingKo.length}행`);

  const plan: Array<{ row: IngredientRow; ko: string }> = [];
  for (const r of missingKo) {
    const ko = koByEng.get(engKey(r.name_en));
    if (ko) plan.push({ row: r, ko });
  }
  console.log(`식약처에서 한글명을 찾은 것 ${plan.length}행\n`);
  for (const p of plan.slice(0, 20))
    console.log(`  ${String(p.row.id).padStart(5)} ${String(p.row.name_en).slice(0, 40).padEnd(42)} → ${p.ko}`);
  if (plan.length > 20) console.log(`  … 외 ${plan.length - 20}행`);

  mkdirSync("artifacts/ingredient-backfill", { recursive: true });
  writeFileSync(
    "artifacts/ingredient-backfill/korean-names.json",
    JSON.stringify(
      { builtAt: new Date().toISOString(), plan: plan.map((p) => ({ id: p.row.id, en: p.row.name_en, ko: p.ko })) },
      null,
      2
    ),
    "utf8"
  );

  if (!apply) {
    console.log("\ndry-run. --apply 로 채운다.");
    return;
  }
  if (plan.length === 0) return;

  let updated = 0;
  for (const [i, p] of plan.entries()) {
    // `name_ko` 가 비어 있을 때만 쓴다 — 경쟁 실행에서도 기존 값을 덮지 않는다.
    const { data, error } = await client
      .from("ingredients")
      .update({ name_ko: p.ko })
      .eq("id", p.row.id)
      .is("name_ko", null)
      .select("id");
    if (error) {
      console.log(`  ${p.row.id} 실패: ${error.code} ${error.message.slice(0, 60)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    if ((data ?? []).length > 0) updated += 1;
  }
  console.log(`\n한글명 ${updated}행 채움`);
}

main().catch((e) => {
  console.error("[backfill-ingredient-korean-names] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
