/**
 * `data/production-audit/2026-07-27-allergen-exposure-READONLY.sql` 의 **로직**을
 * TypeScript 로 그대로 옮겨 Staging 에 돌리고, 운영 코드 경로로 잰 값과 대조한다.
 *
 * 왜 필요한가 — 그 SQL 은 사람이 Production Dashboard 에서 직접 실행한다. 이
 * 세션에는 DB 에 SQL 을 실행할 경로가 없어(Supabase CLI 토큰 없음) SQL 자체를
 * 시험 실행할 수 없다. 그래서 **규칙이 맞는지만이라도** 같은 데이터에서 확인한다.
 *
 * 여기서 재현하는 것은 SQL 의 판정 규칙이다:
 *   · 정규화 = 소문자 → 숫자 제거 → [a-z가-힣] 만 남김
 *   · 전성분 토큰은 쉼표·세미콜론·슬래시·파이프·가운뎃점으로 한 번 더 분리
 *   · 옛 필터 = key_ingredients 만, 부분 문자열 포함
 *   · 새 필터 = 전성분 포함, 접두 관계
 *   · key_ingredients 가 비면 검사 대상에서 제외 (옛 필터에서도 안 나갔다)
 *
 * 검증하지 못하는 것: SQL 문법 자체. 그건 사람이 실행할 때 드러난다.
 *
 * 실행: npm run check:allergen-audit-sql-validate
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const PROD_REF = "rhfrmvkjsummaylpzmns";

/** SQL 의 `allergen` CTE 와 **같은 값**이어야 한다. */
const ALLERGEN: ReadonlyArray<{ display: string; forms: string[] }> = [
  { display: "Fragrance", forms: ["fragrance", "parfum", "perfume", "향료"] },
  { display: "Alcohol Denat", forms: ["alcohol", "alcoholdenat", "ethanol", "변성알코올", "에탄올"] },
  { display: "Essential Oil", forms: ["essentialoil", "에센셜오일"] },
  { display: "Limonene", forms: ["limonene", "리모넨"] },
  { display: "Linalool", forms: ["linalool", "리날룰"] },
  { display: "Citronellol", forms: ["citronellol", "시트로넬올"] },
  { display: "Geraniol", forms: ["geraniol", "제라니올"] },
  { display: "Citral", forms: ["citral", "시트랄"] },
  { display: "Eugenol", forms: ["eugenol", "유제놀"] },
  { display: "Coumarin", forms: ["coumarin", "쿠마린"] },
  { display: "Farnesol", forms: ["farnesol", "파네솔"] },
  { display: "Cinnamal", forms: ["cinnamal", "신남알"] },
  { display: "Hexyl Cinnamal", forms: ["hexylcinnamal", "헥실신남알"] },
  { display: "Cinnamyl Alcohol", forms: ["cinnamylalcohol", "신나밀알코올"] },
  { display: "Benzyl Alcohol", forms: ["benzylalcohol", "벤질알코올"] },
  { display: "Benzyl Benzoate", forms: ["benzylbenzoate", "벤질벤조에이트"] },
  { display: "Benzyl Salicylate", forms: ["benzylsalicylate", "벤질살리실레이트"] },
  { display: "Hydroxycitronellal", forms: ["hydroxycitronellal", "하이드록시시트로넬알"] },
  {
    display: "Butylphenyl Methylpropional",
    forms: ["butylphenylmethylpropional", "부틸페닐메틸프로피오날"],
  },
  { display: "Alpha-Isomethyl Ionone", forms: ["alphaisomethylionone", "알파아이소메틸아이오논"] },
  { display: "Niacinamide", forms: ["niacinamide", "나이아신아마이드"] },
  { display: "Centella Asiatica", forms: ["centellaasiatica", "madecassoside", "마데카소사이드"] },
];

/** SQL 의 regexp_replace 두 단계와 같은 정규화 */
function sqlNorm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9]+(\.[0-9]+)?/g, "")
    .replace(/[^a-z가-힣]/g, "");
}

/** SQL 의 regexp_split_to_table(tok, '[,;/|·]') 와 같은 분리 */
function sqlSplit(value: string): string[] {
  return value.split(/[,;/|·]/);
}

// 길이 하한(4자)은 **접두·포함 분기에만** 건다. 정확히 같은 이름은 짧아도
// 매칭해야 한다 — «향료»(2자)·«리모넨»(3자)이 여기서 잘리면 안 된다.
function oldMatch(forms: string[], norms: string[]): boolean {
  return norms.some((n) =>
    forms.some(
      (f) =>
        n === f ||
        (f.length >= 4 && n.length >= 4 && (n.includes(f) || f.includes(n)))
    )
  );
}

function newMatch(forms: string[], norms: string[]): boolean {
  return norms.some((n) =>
    forms.some(
      (f) =>
        n === f ||
        (f.length >= 4 &&
          n.length >= 4 &&
          (n.startsWith(f) || f.startsWith(n)))
    )
  );
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");

  const client = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    active: boolean | null;
    verified_at: string | null;
    key_ingredients: unknown;
    key_ingredients_ja: unknown;
    full_ingredients: unknown;
  }>(
    client,
    "products",
    "id,brand,name,active,verified_at,key_ingredients,key_ingredients_ja,full_ingredients"
  );
  const target = rows.filter((r) => r.active === true && r.verified_at != null);

  const arr = (v: unknown) =>
    Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];

  const perProduct = target.map((r) => {
    const keyNorms = [...arr(r.key_ingredients), ...arr(r.key_ingredients_ja)]
      .map(sqlNorm)
      .filter((s) => s !== "");
    const fullNorms = arr(r.full_ingredients)
      .flatMap(sqlSplit)
      .map(sqlNorm)
      .filter((s) => s !== "");
    return { row: r, keyNorms, allNorms: [...keyNorms, ...fullNorms] };
  });

  const hasKey = perProduct.filter((p) => p.keyNorms.length > 0);
  console.log(`Staging 활성 제품 ${target.length}건 · 검사 대상(key_ingredients 있음) ${hasKey.length}건\n`);

  console.log("SQL 쿼리 1 이 낼 결과 (같은 규칙을 TS 로 재현):");
  console.log(`  ${"알레르겐".padEnd(30)}옛 필터   새 필터   노출됐던`);
  const exposedIds = new Set<number>();
  let anyRow = false;
  for (const a of ALLERGEN) {
    let oldN = 0;
    let newN = 0;
    for (const p of hasKey) {
      const o = oldMatch(a.forms, p.keyNorms);
      const n = newMatch(a.forms, p.allNorms);
      if (o) oldN += 1;
      if (n) newN += 1;
      if (!o && n) exposedIds.add(p.row.id);
    }
    if (newN - oldN <= 0) continue;
    anyRow = true;
    console.log(
      `  ${a.display.padEnd(30)}${String(oldN).padStart(6)}${String(newN).padStart(10)}${String(newN - oldN).padStart(10)}`
    );
  }
  if (!anyRow) console.log("  (빈 표 — 노출 0건)");

  console.log(`\nSQL 쿼리 2 가 낼 제품 수: ${exposedIds.size}건`);

  // ── 운영 코드 경로로 잰 값과 대조
  const { toCanonical, indexIngredients, findMatchByCanonical, coerceIngredientListUnknown } =
    await import("@/lib/recommend/normalizeIngredient");
  const { matchAllergenByCanonical } = await import("@/lib/recommend/allergenMatch");

  const codeExposed = new Set<number>();
  for (const a of ALLERGEN) {
    const needle = toCanonical(a.display);
    if (!needle) continue;
    for (const r of target) {
      const keyLabels = [
        ...coerceIngredientListUnknown(r.key_ingredients),
        ...coerceIngredientListUnknown(r.key_ingredients_ja),
      ];
      if (keyLabels.length === 0) continue;
      const o = findMatchByCanonical(needle, indexIngredients(keyLabels));
      const n = matchAllergenByCanonical(
        needle,
        indexIngredients([...keyLabels, ...coerceIngredientListUnknown(r.full_ingredients)])
      );
      if (!o && n) codeExposed.add(r.id);
    }
  }

  console.log(`운영 코드 경로로 잰 값:        ${codeExposed.size}건`);

  const onlySql = [...exposedIds].filter((id) => !codeExposed.has(id));
  const onlyCode = [...codeExposed].filter((id) => !exposedIds.has(id));
  console.log(`\n두 방식이 갈리는 제품: SQL 만 ${onlySql.length}건 · 코드만 ${onlyCode.length}건`);
  for (const id of [...onlySql, ...onlyCode].slice(0, 10)) {
    const r = target.find((x) => x.id === id)!;
    const side = onlySql.includes(id) ? "SQL만" : "코드만";
    console.log(`  ${side} ${id} ${r.brand} — ${String(r.name).slice(0, 40)}`);
  }
  if (onlySql.length === 0 && onlyCode.length === 0) {
    console.log("  없음 — SQL 규칙이 운영 코드와 같은 결과를 낸다.");
  }
}

main().catch((e) => {
  console.error("[validate-allergen-audit-sql] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
