/**
 * 파서 규칙 수정안 — **제안만. 실제 파서를 바꾸지 않는다.**
 *
 * 전성분을 영문·한글 두 벌로 싣는 쇼핑몰이 있는데, 두 목록 사이에 구분자가
 * 없다. 2026-07-27 abib.co.kr 실물:
 *
 *   ..., Camellia Sinensis Leaf Extract, Glucose 정제수, 메틸프로판다이올, ...
 *                                       ^^^^^^^ ^^^^^^
 *                                       영문 마지막   한글 첫
 *
 * 그래서 `glucose 정제수` 가 한 토큰이 되어 둘 다 미매칭이 된다.
 *
 * 제안: **로마자 + 공백 + 한글** 을 목록 경계로 보고 끊는다.
 * INCI 성분명은 한 이름 안에서 로마자와 한글을 공백으로 잇지 않는다.
 * `C12-14Sec-파레스-7` 처럼 붙여 쓰는 혼합명은 공백이 없어 영향받지 않는다.
 *
 * 잃는 토큰은 반드시 원문과 대조해 진짜 회귀인지 본다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/propose-latin-hangul-boundary.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

/**
 * 로마자 **낱말**(3자 이상) 뒤에 공백 하나로 한글이 붙으면 목록이 바뀐 지점이다.
 *
 * 숫자·기호로 끝나는 경우는 제외한다. 그러지 않으면 띄어 쓴 하이픈이 든 한글
 * 성분명이 잘린다 — `피이지 -240/ 에이치디아이코폴리머비스` 는 한 성분이다.
 */
const LATIN_HANGUL_BOUNDARY = /([A-Za-z]{3,})\s+(?=[가-힣])/g;

/**
 * 쇼핑몰 푸터·추천 영역 문구. 지금은 긴 토큰 안에 숨어 «12낱말 초과» 필터에
 * 걸려 조용히 버려지는데, 경계 규칙이 토큰을 쪼개면 드러난다. 숨기지 말고
 * 잘라 낸다 — 어차피 성분이 아니다.
 */
const FOOTER_MARKERS = [
  /카테고리\s*인기/,
  /네비게이션\s*검색/,
  /고객상담실/,
  /쇼핑몰\s*기본정보/,
];

function preprocess(raw: string): string {
  let s = raw;
  for (const marker of FOOTER_MARKERS) {
    const m = s.match(marker);
    if (m?.index != null) s = s.slice(0, m.index);
  }
  return s.replace(LATIN_HANGUL_BOUNDARY, "$1, ");
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
  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const maps = buildIngredientLookupMaps(
    await fetchAll(client, "ingredients", "id,slug,name_en,name_ko"),
    (
      await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
    ).filter((a) => a.active) as never
  );
  const products = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    full_ingredients: unknown;
  }>(client, "products", "id,brand,name,full_ingredients");

  let curTok = 0, curMatch = 0, newTok = 0, newMatch = 0, curClean = 0, newClean = 0;
  const gained = new Map<string, number>();
  const lost = new Map<string, { n: number; productId: number; raw: string }>();
  const changed: Array<{ id: number; brand: string; name: string; before: number; after: number }> = [];

  for (const p of products) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    const raw = (fi as string[]).join(", ");

    const cur = attachIngredientMatches(parseIngredientList(raw), maps).normalized;
    const next = attachIngredientMatches(parseIngredientList(preprocess(raw)), maps).normalized;
    const curM = new Set(cur.filter((x) => x.matchedIngredientId).map((x) => x.normalizedName));
    const nextM = new Set(next.filter((x) => x.matchedIngredientId).map((x) => x.normalizedName));

    curTok += cur.length;
    newTok += next.length;
    curMatch += curM.size;
    newMatch += nextM.size;
    const beforeUn = cur.length - curM.size;
    const afterUn = next.length - nextM.size;
    if (beforeUn === 0) curClean += 1;
    if (afterUn === 0) newClean += 1;
    if (beforeUn !== afterUn)
      changed.push({ id: p.id, brand: String(p.brand ?? ""), name: String(p.name ?? ""), before: beforeUn, after: afterUn });

    for (const k of nextM) if (!curM.has(k)) gained.set(k, (gained.get(k) ?? 0) + 1);
    for (const k of curM)
      if (!nextM.has(k)) {
        const e = lost.get(k) ?? { n: 0, productId: p.id, raw };
        e.n += 1;
        lost.set(k, e);
      }
  }

  console.log("=== 로마자→한글 경계 규칙 diff (실제 파서 미변경) ===\n");
  console.log(`  토큰 수         ${curTok} -> ${newTok}  (${newTok - curTok >= 0 ? "+" : ""}${newTok - curTok})`);
  console.log(`  매칭 토큰       ${curMatch} -> ${newMatch}  (${newMatch - curMatch >= 0 ? "+" : ""}${newMatch - curMatch})`);
  console.log(`  미매칭 0건 제품 ${curClean} -> ${newClean}  (+${newClean - curClean})`);
  console.log(`  미매칭 수가 바뀌는 제품 ${changed.length}건\n`);

  console.log(`--- 새로 매칭되는 토큰 ${gained.size}종 (상위 15) ---`);
  for (const [k, v] of [...gained.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
    console.log(`  ${String(v).padStart(3)}개  ${k.slice(0, 60)}`);

  console.log(`\n--- 매칭을 잃는 토큰 ${lost.size}종 — 원문 대조 ---`);
  if (lost.size === 0) console.log("  없음");
  for (const [k, v] of [...lost.entries()].sort((a, b) => b.n - a.n).slice(0, 20)) {
    console.log(`  ${String(v.n).padStart(3)}개 제품  «${k.slice(0, 54)}»`);
    const needle = k.split(" ")[0] ?? k;
    const idx = v.raw.toLowerCase().indexOf(needle.toLowerCase());
    if (idx > -1)
      console.log(`        제품 ${v.productId}: ...${v.raw.slice(Math.max(0, idx - 55), idx + 80).replace(/\s+/g, " ")}...`);
  }

  console.log(`\n--- abib(117~126) 변화 ---`);
  for (const c of changed.filter((x) => x.id >= 117 && x.id <= 126).sort((a, b) => a.id - b.id))
    console.log(
      `  ${String(c.id).padStart(3)}  ${String(c.before).padStart(2)} -> ${String(c.after).padStart(2)}${c.after === 0 ? "  *** 해소 ***" : ""}  ${c.name.slice(0, 34)}`
    );

  console.log(`\n--- 그 밖에 바뀌는 제품 (상위 12) ---`);
  for (const c of changed.filter((x) => x.id < 117 || x.id > 126).sort((a, b) => a.after - b.after).slice(0, 12))
    console.log(
      `  ${String(c.id).padStart(3)} ${c.brand.slice(0, 12).padEnd(13)}${String(c.before).padStart(2)} -> ${String(c.after).padStart(2)}${c.after === 0 ? "  *** 해소 ***" : ""}  ${c.name.slice(0, 30)}`
    );
}

main().catch((e) => {
  console.error("[propose-latin-hangul-boundary] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
