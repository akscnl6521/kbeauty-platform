/**
 * 파서 «꼬리 문구» 규칙 수정안 — **제안만. 실제 파서를 바꾸지 않는다.**
 *
 * §35.7 을 구현한 뒤에도 세 가지가 남았다 (원문을 직접 확인한 것):
 *
 *   47·50·51  `…생강추출물 사용상의`
 *             전성분이 «사용상의» 에서 잘려 저장돼 있다. 현재 규칙은
 *             `사용상의 주의사항` 을 요구해서, 뒤가 없으면 안 잘린다.
 *   53        `더보기 숨기기 !---!다이아이소스테아릴말레이트`
 *             `!---!` 구분자가 첫 성분명에 붙어 버렸다.
 *   63        `(1번) 정제수 … (3번) 정제수 …`
 *             제품 두 종의 전성분이 한 행에 «(N번)» 라벨로 묶여 있다.
 *
 * 마지막 것은 라벨을 떼면 파싱은 되지만 **두 제품이 한 행에 섞여 있다는
 * 사실 자체는 남는다.** 라벨 제거는 파싱 문제만 푼다.
 *
 * 잃는 토큰은 반드시 원문과 대조해 진짜 회귀인지 본다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/propose-parser-tail-rules.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

/** 제안하는 «전처리» 규칙. 이것만 추가하고 나머지 파싱은 그대로 쓴다. */
function preprocess(raw: string): string {
  let s = raw;

  // 이미 파서에 들어간 규칙(사용상의 · !---! · (N번))은 여기서 다시 하지
  // 않는다. 아래는 **이번에 새로 제안하는 것**만이다.

  // 1. «전성분은 제조 시기에 따라 변경될 수 있습니다» — 목록 뒤 고지 문구.
  //    앞의 `*` 는 stripConcentration 이 공백으로 지워서, 마지막 성분과
  //    이 문구가 한 토큰으로 붙는다 (`카르노신 전성분은 …`).
  const i = s.search(/전성분은\s*제조/);
  if (i > -1) s = s.slice(0, i);

  // 2. 한 칸에 여러 변형 제품의 전성분이 라벨로 구분돼 들어온 경우.
  //      `원더밤: 정제수, …`  ·  `1. 어웨이크닝 - 정제수, …`
  //    라벨은 구획 경계이므로 쉼표로 끊는다. 콜론은 INCI 이름에 쓰이지 않고,
  //    «숫자.» 로 시작하는 번호 라벨도 성분명이 될 수 없다.
  s = s.replace(/(^|[\s,])\d+\.\s*[가-힣][가-힣\s]{1,12}?\s*[-–—]\s*/g, ", ");
  s = s.replace(/(^|[\s,])[가-힣][가-힣\s]{1,12}?\s*:\s*/g, ", ");

  return s;
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
  const lost = new Map<string, { n: number; sample: { id: number; raw: string } }>();
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
        const e = lost.get(k) ?? { n: 0, sample: { id: p.id, raw } };
        e.n += 1;
        lost.set(k, e);
      }
  }

  console.log("=== 꼬리 문구 규칙 diff (실제 파서 미변경) ===\n");
  console.log(`  토큰 수         ${curTok} -> ${newTok}  (${newTok - curTok >= 0 ? "+" : ""}${newTok - curTok})`);
  console.log(`  매칭 토큰       ${curMatch} -> ${newMatch}  (${newMatch - curMatch >= 0 ? "+" : ""}${newMatch - curMatch})`);
  console.log(`  미매칭 0건 제품 ${curClean} -> ${newClean}  (+${newClean - curClean})`);
  console.log(`  미매칭 수가 바뀌는 제품 ${changed.length}건\n`);

  console.log(`--- 새로 매칭되는 토큰 ${gained.size}종 ---`);
  for (const [k, v] of [...gained.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log(`  ${String(v).padStart(3)}개 제품  ${k.slice(0, 70)}`);

  console.log(`\n--- 매칭을 잃는 토큰 ${lost.size}종 — 원문 대조 ---`);
  if (lost.size === 0) console.log("  없음");
  for (const [k, v] of [...lost.entries()].sort((a, b) => b.n - a.n)) {
    console.log(`  ${String(v.n).padStart(3)}개 제품  «${k.slice(0, 60)}»`);
    const idx = v.sample.raw.indexOf(k.split(" ")[0] ?? k);
    console.log(
      `        제품 ${v.sample.id} 원문: ...${v.sample.raw.slice(Math.max(0, idx - 60), idx + 90).replace(/\s+/g, " ")}...`
    );
  }

  console.log(`\n--- 미매칭 수가 바뀌는 제품 ---`);
  for (const c of changed.sort((a, b) => a.after - b.after))
    console.log(
      `  ${String(c.id).padStart(3)} ${c.brand.slice(0, 12).padEnd(13)}${String(c.before).padStart(3)} -> ${String(c.after).padStart(3)}${c.after === 0 ? "  *** 해소 ***" : ""}  ${c.name.slice(0, 34)}`
    );
}

main().catch((e) => {
  console.error("[propose-parser-tail-rules] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
