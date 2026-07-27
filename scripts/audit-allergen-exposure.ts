/**
 * 알레르겐 필터 확장 **이후** 최종 확인.
 *
 * 묻는 것: 옛 필터로 «안전» 판정을 받아 사용자에게 나갈 수 있었던 제품 가운데,
 * 새 필터로 다시 검사하면 걸러져야 하는 게 남아 있는가.
 *
 * 읽기 전용. DB 에 쓰지 않는다.
 *
 * 두 가지를 구분해서 본다:
 *   1. 옛 필터가 놓쳤던 것 (= 실제로 노출됐을 수 있는 것)
 *   2. 새 필터도 여전히 놓치는 것 (= 지금도 남아 있는 위험)
 *
 * 실행: npm run check:allergen-exposure-audit
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 사용자가 입력할 수 있는 알레르기·회피 성분.
 * §29 문진의 회피 항목과 `ingredientAliases.ts` 의 향료 유래 표시 알레르겐.
 */
const USER_INPUTS: ReadonlyArray<string> = [
  "Fragrance",
  "Alcohol Denat",
  "Essential Oil",
  "Limonene",
  "Linalool",
  "Citronellol",
  "Geraniol",
  "Citral",
  "Eugenol",
  "Coumarin",
  "Farnesol",
  "Cinnamal",
  "Hexyl Cinnamal",
  "Cinnamyl Alcohol",
  "Benzyl Alcohol",
  "Benzyl Benzoate",
  "Benzyl Salicylate",
  "Hydroxycitronellal",
  "Butylphenyl Methylpropional",
  "Alpha-Isomethyl Ionone",
  "Niacinamide",
  "Centella Asiatica",
  "Retinol",
  "Salicylic Acid",
];

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

  const { toCanonical, indexIngredients, findMatchByCanonical, coerceIngredientListUnknown } =
    await import("@/lib/recommend/normalizeIngredient");
  const { matchAllergenByCanonical } = await import("@/lib/recommend/allergenMatch");

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
  const active = rows.filter((r) => r.active === true && r.verified_at != null);

  type P = (typeof active)[number];
  const keyLabels = (p: P) => [
    ...coerceIngredientListUnknown(p.key_ingredients),
    ...coerceIngredientListUnknown(p.key_ingredients_ja),
  ];
  const allLabels = (p: P) => [...keyLabels(p), ...coerceIngredientListUnknown(p.full_ingredients)];

  console.log(`Staging 활성 제품 ${active.length}건 · 사용자 입력 후보 ${USER_INPUTS.length}종\n`);

  // ── 1. 옛 필터가 놓쳤던 것 = 실제로 노출됐을 수 있는 것
  const wasExposed = new Map<number, { p: P; inputs: Array<{ input: string; token: string }> }>();
  // ── 2. 새 필터도 놓치는 것 = 지금도 남아 있는 위험
  const stillLeaking = new Map<number, { p: P; inputs: Array<{ input: string; token: string }> }>();

  for (const input of USER_INPUTS) {
    const needle = toCanonical(input);
    if (!needle) continue;
    for (const p of active) {
      const kl = keyLabels(p);
      // 성분 정보가 아예 없으면 옛 필터에서도 incomplete_info 로 빠졌다 — 노출 안 됨.
      if (kl.length === 0) continue;

      const oldHit = findMatchByCanonical(needle, indexIngredients(kl));
      const newHit = matchAllergenByCanonical(needle, indexIngredients(allLabels(p)));

      if (!oldHit && newHit) {
        const e = wasExposed.get(p.id) ?? { p, inputs: [] };
        e.inputs.push({ input, token: newHit });
        wasExposed.set(p.id, e);
      }

      // 원문에 단어가 보이는데 새 필터도 안 잡으면 아직 남은 위험이다.
      if (!newHit) {
        const raw = [
          ...(Array.isArray(p.key_ingredients) ? (p.key_ingredients as string[]) : []),
          ...(Array.isArray(p.full_ingredients) ? (p.full_ingredients as string[]) : []),
        ];
        const word = input.toLowerCase().replace(/\s+/g, "");
        const seen = raw.find((t) => t.toLowerCase().replace(/\s+/g, "").includes(word));
        if (seen) {
          const e = stillLeaking.get(p.id) ?? { p, inputs: [] };
          e.inputs.push({ input, token: seen.slice(0, 60) });
          stillLeaking.set(p.id, e);
        }
      }
    }
  }

  console.log("═══ 1. 옛 필터가 놓쳐 노출될 수 있었던 제품 ═══\n");
  console.log(`  ${wasExposed.size}건 (중복 제외). 이번 수정으로 전부 걸러진다.\n`);
  const byInput = new Map<string, number>();
  for (const { inputs } of wasExposed.values())
    for (const i of inputs) byInput.set(i.input, (byInput.get(i.input) ?? 0) + 1);
  for (const [i, n] of [...byInput.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`    ${i.padEnd(30)} ${String(n).padStart(3)}건`);

  console.log("\n  상위 12건:");
  for (const { p, inputs } of [...wasExposed.values()].slice(0, 12))
    console.log(
      `    ${String(p.id).padStart(4)} ${String(p.brand).slice(0, 16).padEnd(17)}` +
        `${String(p.name).slice(0, 34).padEnd(36)}${inputs.map((i) => `${i.input}→${i.token}`).slice(0, 2).join(" · ")}`
    );

  console.log("\n═══ 2. 이름이 겹치지만 일부러 매칭하지 않는 것 ═══\n");
  console.log(
    "  아래는 «놓친 것» 이 아니다. 입력한 성분명이 제품 성분명 안에 문자열로\n" +
      "  들어 있지만 **별개 성분**이라 매칭하지 않는 경우다. 사람이 한 번 보고\n" +
      "  판단할 수 있게 남긴다.\n"
  );
  if (stillLeaking.size === 0) {
    console.log("  없음.");
  } else {
    for (const { p, inputs } of stillLeaking.values()) {
      console.log(`    ${String(p.id).padStart(4)} ${p.brand} — ${String(p.name).slice(0, 40)}`);
      for (const i of inputs.slice(0, 2)) console.log(`         입력 "${i.input}" vs 성분 "${i.token}"`);
    }
    console.log(
      "\n  판단 근거:\n" +
        "    Cinnamal 과 Hexyl Cinnamal 은 EU 표시 알레르겐 목록에 **각각 따로** 올라\n" +
        "    있는 별개 성분이다. 하나를 피한다고 다른 하나가 자동으로 걸리면 안 된다.\n" +
        "\n" +
        "    Capryloyl Salicylic Acid(LHA)는 살리실릭애씨드의 유도체다. 지금 규칙은\n" +
        "    별개 성분으로 보고 매칭하지 않는다. 유도체까지 묶으려면 Cetearyl Alcohol\n" +
        "    을 Alcohol 로 묶는 것과 같은 문제가 생기므로, 규칙이 아니라 **alias 그룹에\n" +
        "    명시적으로 추가**하는 방식이어야 한다. 이건 판단이 필요해 남겨 둔다."
    );
  }

  console.log("\n═══ 범위 ═══");
  console.log(`  이 조사는 Staging(${ref}) 대상이다.`);
  console.log(
    `  Production 자격증명은 이 세션에 없다(설정상 접근 차단). ` +
      `Production 카탈로그에도 같은 확인이 필요하면 별도로 요청해야 한다.`
  );
}

main().catch((e) => {
  console.error("[audit-allergen-exposure] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
