/**
 * 전성분 파서 수정안 — **제안만 한다. 실제 파서를 바꾸지 않는다.**
 *
 * `src/lib/pipeline/ingredient-normalize.ts` 의 `parseIngredientList` 는 그대로
 * 두고, 수정안을 이 파일 안에 따로 구현해 현재 결과와 대조한다. 파서는 모든
 * 제품의 성분 매칭에 영향을 주므로, 무엇이 몇 건 바뀌는지 먼저 보고 판단한다.
 *
 * 다루는 손상은 §30-10 에서 확인된 네 가지다.
 *
 *   A. 슬래시 분해 — `PEG/PPG-17/6 Copolymer` 가 세 조각으로 쪼개진다.
 *      INCI 에서 `/` 는 구분자가 아니라 이름의 일부다.
 *   B. 괄호 안 쉼표 — `나이아신아마이드(50,000 ppm)` 이 두 토큰으로 갈린다.
 *   C. 페이지 잡텍스트 — 크롤이 «Open / Close», «더보기 숨기기», 주의사항
 *      문구까지 전성분에 담았다.
 *   D. 모지바케 — 인코딩이 깨진 토큰은 성분이 아니다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/propose-ingredient-parser-fix.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const OUT_DIR = path.join("artifacts", "ingredient-parser-proposal");

/* ------------------------------------------------------------------ *
 * 수정안 — 현재 파서와 다른 부분에만 주석을 단다.
 * ------------------------------------------------------------------ */

/** C. 전성분 뒤에 붙어 온 안내 문구를 잘라낸다. 이 뒤는 성분이 아니다. */
const TAIL_MARKERS = [
  /사용상의\s*주의사항/,
  /사용할\s*때의/,
  /「화장품법」/,
  /기능성\s*화장품\s*식품의약품안전처/,
  /제품\s*상세정보/,
  /product\s+relation/i,
  /상품후기/,
  /상품문의/,
];

/** C. 크롤이 함께 담아 온 UI 문구. 성분 목록 어디에나 끼어든다. */
const UI_NOISE =
  /(?:^|[\s,])(?:open\s*\/\s*close|open|close|더보기|숨기기|toggle\s+menu|explore\s+more|해당하는\s*데이터가\s*아직\s*없습니다\.?)(?=[\s,]|$)/gi;

/** C. «제1제 :» 같은 구획 라벨. */
const SECTION_LABEL = /제\s*\d\s*제\s*[:：]/g;

/**
 * B. 괄호 안 농도·함량 표기. 안에 쉼표가 있어 토큰을 쪼갠다.
 *
 * 단위(ppm/ppb/%)가 붙었거나 자릿수 쉼표가 있는 경우만 지운다. 괄호 안 숫자를
 * 무조건 지우면 `적색104호의(1)` 처럼 **번호가 이름의 일부인 색소**가 망가진다.
 */
const CONCENTRATION_PAREN =
  /\(\s*\d[\d.,\s]*\s*(?:ppm|ppb|%|퍼센트)\s*\)|\(\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*\)/gi;

function protectCompounds(raw: string): string {
  return raw
    .replace(/\bwater\s+and\s+/gi, "water+")
    .replace(/\baqua\s+and\s+/gi, "aqua+")
    .replace(/\band\s+/gi, ", ")
    .replace(/\s+및\s+/g, ", ")
    .replace(/\s+&\s+/g, ", ");
}

function stripConcentration(token: string): string {
  return token
    .replace(/\b\d+([.,]\d+)?\s*%/g, " ")
    .replace(/\*{1,3}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-·•|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function proposedParse(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];

  let working = raw;

  // C. 안내 문구가 시작되는 지점에서 통째로 자른다.
  for (const marker of TAIL_MARKERS) {
    const m = working.match(marker);
    if (m?.index != null) working = working.slice(0, m.index);
  }
  working = working.replace(SECTION_LABEL, " ").replace(UI_NOISE, " ");

  // B. 괄호 안 농도 표기를 먼저 없앤다. 쉼표로 쪼개지기 전에 해야 한다.
  working = working.replace(CONCENTRATION_PAREN, " ");

  working = protectCompounds(working);
  working = working.replace(/\(([^)]{80,})\)/g, " ");
  working = working
    .replace(/\r\n|\r|\n/g, ",")
    .replace(/\[[^\]]*\]/g, " ")
    // A. `/` 를 구분자에서 뺀다. INCI 에서 슬래시는 이름의 일부다.
    //    (현재 파서는 `[;/|]` 를 전부 쉼표로 바꿔 이름을 쪼갠다)
    .replace(/[;|]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of working.split(",")) {
    const token = stripConcentration(t.trim().replace(/\+/g, " "));
    if (token.length <= 1 || token.length >= 120) continue;
    // D. 인코딩이 깨진 토큰은 성분이 아니다.
    if (/�/.test(token)) continue;
    const key = normalizeTextKey(token)
      .replace(/\bparfum\b/g, "fragrance")
      .replace(/\baqua\b/g, "water")
      .replace(/\bci\s*(\d{5})\b/g, "ci $1");
    if (!key || seen.has(key)) continue;
    if (/^(contains|with|free of|무첨가|포함)/i.test(key) || key.split(" ").length > 12) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/* ------------------------------------------------------------------ */

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
  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const ingredients = await fetchAll<Record<string, never>>(client, "ingredients", "id,slug,name_en,name_ko");
  const aliases = (
    await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
  ).filter((a) => a.active);
  const products = await fetchAll<{ id: number; brand: string | null; name: string | null; full_ingredients: unknown }>(
    client,
    "products",
    "id,brand,name,full_ingredients"
  );
  const maps = buildIngredientLookupMaps(ingredients as never, aliases as never);

  const lookup = (key: string): number | null => {
    const ids = [maps.bySlug.get(key), maps.byNameEn.get(key), maps.byNameKo.get(key), maps.byAlias.get(key)].filter(
      (x): x is number => x != null
    );
    return new Set(ids).size === 1 ? ids[0]! : null;
  };

  let curTok = 0, curMatch = 0, newTok = 0, newMatch = 0;
  let curClean = 0, newClean = 0;
  const gainedTokens = new Map<string, number>();
  const lostTokens = new Map<string, number>();
  const droppedTokens = new Map<string, number>();
  const perProduct: Array<{ id: number; brand: string; name: string; beforeUn: number; afterUn: number }> = [];

  for (const p of products) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    const raw = fi.join(", ");

    const cur = attachIngredientMatches(parseIngredientList(raw), maps).normalized;
    const curKeys = cur.map((x) => x.normalizedName);
    const curMatched = new Set(cur.filter((x) => x.matchedIngredientId).map((x) => x.normalizedName));

    const next = proposedParse(raw);
    const nextMatched = new Set(next.filter((k) => lookup(k) != null));

    curTok += cur.length;
    curMatch += curMatched.size;
    newTok += next.length;
    newMatch += nextMatched.size;

    const beforeUn = cur.length - curMatched.size;
    const afterUn = next.length - nextMatched.size;
    if (beforeUn === 0) curClean += 1;
    if (afterUn === 0) newClean += 1;
    if (beforeUn !== afterUn)
      perProduct.push({
        id: p.id,
        brand: String(p.brand ?? ""),
        name: String(p.name ?? ""),
        beforeUn,
        afterUn,
      });

    for (const k of nextMatched) if (!curMatched.has(k)) gainedTokens.set(k, (gainedTokens.get(k) ?? 0) + 1);
    for (const k of curMatched) if (!nextMatched.has(k)) lostTokens.set(k, (lostTokens.get(k) ?? 0) + 1);
    for (const k of curKeys) if (!next.includes(k)) droppedTokens.set(k, (droppedTokens.get(k) ?? 0) + 1);
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  console.log("=== 파서 수정안 diff (실제 파서 미변경) ===\n");
  console.log(`  토큰 수        ${curTok} -> ${newTok}  (${newTok - curTok >= 0 ? "+" : ""}${newTok - curTok})`);
  console.log(`  매칭 토큰      ${curMatch} -> ${newMatch}  (+${newMatch - curMatch})`);
  console.log(`  미매칭 0건 제품 ${curClean} -> ${newClean}  (+${newClean - curClean})`);
  console.log(`  미매칭 수가 바뀌는 제품: ${perProduct.length}건\n`);

  console.log(`--- 새로 매칭되는 토큰 ${gainedTokens.size}종 (상위 20) ---`);
  for (const [k, v] of top(gainedTokens, 20)) console.log(`  ${String(v).padStart(3)}개 제품  ${k.slice(0, 70)}`);

  console.log(`\n--- 매칭을 잃는 토큰 ${lostTokens.size}종 ${lostTokens.size ? "(반드시 검토)" : "(없음)"} ---`);
  for (const [k, v] of top(lostTokens, 20)) console.log(`  ${String(v).padStart(3)}개 제품  ${k.slice(0, 70)}`);

  console.log(`\n--- 사라지는 토큰 ${droppedTokens.size}종 (잡텍스트 제거 기대) 상위 25 ---`);
  for (const [k, v] of top(droppedTokens, 25)) console.log(`  ${String(v).padStart(3)}개 제품  ${k.slice(0, 70)}`);

  console.log(`\n--- 미매칭 수가 바뀌는 제품 (상위 25) ---`);
  for (const p of perProduct.sort((a, b) => a.afterUn - b.afterUn || b.beforeUn - a.beforeUn).slice(0, 25))
    console.log(
      `  ${String(p.id).padStart(3)} ${p.brand.slice(0, 12).padEnd(13)}${String(p.beforeUn).padStart(3)} -> ${String(p.afterUn).padStart(3)}${p.afterUn === 0 ? "  *** 해소 ***" : ""}  ${p.name.slice(0, 34)}`
    );

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, "diff-summary.json"),
    JSON.stringify(
      {
        proposedAt: "2026-07-27",
        applied: false,
        tokens: { before: curTok, after: newTok },
        matched: { before: curMatch, after: newMatch },
        cleanProducts: { before: curClean, after: newClean },
        gainedTokenTypes: gainedTokens.size,
        lostTokenTypes: lostTokens.size,
        droppedTokenTypes: droppedTokens.size,
        productsChanged: perProduct.length,
      },
      null,
      2
    )
  );
  writeFileSync(path.join(OUT_DIR, "token-gained.json"), JSON.stringify(top(gainedTokens, 500), null, 2));
  writeFileSync(path.join(OUT_DIR, "token-lost.json"), JSON.stringify(top(lostTokens, 500), null, 2));
  writeFileSync(path.join(OUT_DIR, "token-dropped.json"), JSON.stringify(top(droppedTokens, 500), null, 2));
  writeFileSync(path.join(OUT_DIR, "product-changes.json"), JSON.stringify(perProduct, null, 2));
  console.log(`\n산출물: ${OUT_DIR}/  — 파서는 바꾸지 않았고 DB 에도 쓰지 않았다.`);
}

main().catch((e) => {
  console.error("[propose-ingredient-parser-fix] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
