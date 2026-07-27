/**
 * 알레르겐 필터를 전성분까지 확장했을 때의 영향 dry-run.
 *
 * **읽기 전용.** 코드 변경 전에 현재 동작(key_ingredients 만)과 확장 동작
 * (key_ingredients + key_ingredients_ja + full_ingredients)을 같은 데이터에
 * 나란히 돌려 차이를 센다. 안전 필터 변경은 되돌리기 어려우므로 숫자를 먼저 본다.
 *
 * 답해야 하는 것:
 *   A. 지금 «안전» 으로 통과 중인 제품 가운데, 확장하면 걸러지는 게 몇 건인가
 *      (= 알레르기를 신고한 사용자에게 지금 노출되고 있는 제품)
 *   B. 반대로 확장 때문에 «없는 알레르겐» 으로 잘못 걸리는 게 생기는가
 *   C. 기존에 정상으로 걸리던 건이 그대로 걸리는가 (회귀)
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/dryrun-allergen-full-ingredients.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 사용자가 실제로 입력할 법한 알레르기·회피 성분.
 * §29 문진과 `ingredientAliases.ts` 의 동의어 그룹에서 가져왔다.
 */
const ALLERGY_INPUTS: ReadonlyArray<{ label: string; input: string[] }> = [
  { label: "향료 (Fragrance)", input: ["Fragrance"] },
  { label: "향료 — 한글 입력 (향료)", input: ["향료"] },
  { label: "변성알코올 (Alcohol Denat)", input: ["Alcohol Denat"] },
  { label: "리모넨 (Limonene)", input: ["Limonene"] },
  { label: "리날룰 (Linalool)", input: ["Linalool"] },
  { label: "에센셜 오일 (Essential Oil)", input: ["Essential Oil"] },
  { label: "나이아신아마이드 (Niacinamide)", input: ["Niacinamide"] },
  { label: "센텔라 (Centella Asiatica)", input: ["Centella Asiatica"] },
  { label: "복합: 향료 + 변성알코올", input: ["Fragrance", "Alcohol Denat"] },
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

function pad(value: string, width: number): string {
  let w = 0;
  for (const ch of value) w += /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(1, width - w));
}

function cut(value: string, width: number): string {
  let w = 0;
  let out = "";
  for (const ch of value) {
    const cw = /[가-힯　-ヿ＀-￯]/.test(ch) ? 2 : 1;
    if (w + cw > width) break;
    out += ch;
    w += cw;
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

  /** 현재 동작: key_ingredients + key_ingredients_ja 만 */
  const currentLabels = (p: P) => [
    ...coerceIngredientListUnknown(p.key_ingredients),
    ...coerceIngredientListUnknown(p.key_ingredients_ja),
  ];
  /** 확장 동작: 위 + full_ingredients */
  const extendedLabels = (p: P) => [
    ...currentLabels(p),
    ...coerceIngredientListUnknown(p.full_ingredients),
  ];

  /** 지금 운영 중인 매처 (부분 문자열 포함) */
  const hits = (labels: string[], banned: string[]): string | null => {
    const index = indexIngredients(labels);
    for (const b of banned) {
      const m = findMatchByCanonical(b, index);
      if (m) return m;
    }
    return null;
  };

  /** 제안 매처 (접두 관계만) */
  const hitsNew = (labels: string[], banned: string[]): string | null => {
    const index = indexIngredients(labels);
    for (const b of banned) {
      const m = matchAllergenByCanonical(b, index);
      if (m) return m;
    }
    return null;
  };

  console.log(`활성 제품 ${active.length}건 기준.`);
  console.log(
    "이 필터는 사용자가 알레르기·회피 성분을 **입력했을 때만** 동작한다.\n" +
      "따라서 아래 «새로 제외» 는 «그 성분을 신고한 사용자에게 지금 노출되고 있는 제품» 이다.\n"
  );

  const priorityFindings: Array<{ allergen: string; products: P[]; evidence: Map<number, string> }> =
    [];

  for (const c of ALLERGY_INPUTS) {
    const banned = c.input.map((x) => toCanonical(x)).filter(Boolean);

    const nowExcluded: P[] = [];
    const newExcluded: P[] = [];
    const evidence = new Map<number, string>();
    let incomplete = 0;

    for (const p of active) {
      const cur = currentLabels(p);
      if (cur.length === 0) {
        // 현재도 확장 후에도 incomplete_info 로 빠진다 — 비교 대상이 아니다.
        incomplete += 1;
        continue;
      }
      const curHit = hits(cur, banned);
      if (curHit) {
        nowExcluded.push(p);
        continue;
      }
      // 실제로 반영할 규칙(접두)으로 잰다.
      const extHit = hitsNew(extendedLabels(p), banned);
      if (extHit) {
        newExcluded.push(p);
        evidence.set(p.id, extHit);
      }
    }

    console.log(
      `── ${c.label}\n` +
        `   지금 제외 ${String(nowExcluded.length).padStart(3)}건 · ` +
        `확장 시 추가 제외 ${String(newExcluded.length).padStart(3)}건 · ` +
        `성분정보 없어 애초에 제외 ${incomplete}건`
    );
    if (newExcluded.length > 0) {
      priorityFindings.push({ allergen: c.label, products: newExcluded, evidence });
      for (const p of newExcluded.slice(0, 6))
        console.log(
          `      + ${String(p.id).padStart(3)} ${cut(p.brand ?? "-", 16).padEnd(17)}` +
            `${cut(p.name ?? "-", 34).padEnd(35)}근거: ${evidence.get(p.id)}`
        );
      if (newExcluded.length > 6) console.log(`      + … 외 ${newExcluded.length - 6}건`);
    }
    console.log();
  }

  // ── 세 방식 비교: 지금(key·포함) / 전성분·포함 / 전성분·접두
  console.log("═══ 매처 비교 — 전성분으로 넓힐 때 어느 규칙을 쓸 것인가 ═══");
  console.log(
    `  ${pad("입력", 30)}${"지금".padStart(6)}${"전성분+포함".padStart(14)}${"전성분+접두".padStart(14)}`
  );
  const disagreements: Array<{ allergen: string; label: string; brand: string; token: string }> = [];
  for (const c of ALLERGY_INPUTS) {
    const banned = c.input.map((x) => toCanonical(x)).filter(Boolean);
    let cur = 0;
    let extSub = 0;
    let extPre = 0;
    for (const p of active) {
      const curL = currentLabels(p);
      if (curL.length === 0) continue;
      const extL = extendedLabels(p);
      if (hits(curL, banned)) cur += 1;
      const sub = hits(extL, banned);
      const pre = hitsNew(extL, banned);
      if (sub) extSub += 1;
      if (pre) extPre += 1;
      // 포함은 걸고 접두는 안 거는 것 = 지방 알코올류 오탐 후보
      if (sub && !pre)
        disagreements.push({
          allergen: c.label,
          label: cut(p.name ?? "-", 30),
          brand: cut(p.brand ?? "-", 14),
          token: sub,
        });
    }
    console.log(
      `  ${pad(c.label, 30)}${String(cur).padStart(6)}${String(extSub).padStart(14)}${String(extPre).padStart(14)}`
    );
  }

  console.log("\n  두 규칙이 갈리는 건 (포함=걸림 / 접두=안 걸림):");
  const byToken = new Map<string, number>();
  for (const d of disagreements) byToken.set(d.token, (byToken.get(d.token) ?? 0) + 1);
  for (const [t, n] of [...byToken.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`    ${pad(t, 30)} ${n}회`);

  // ── B. 잘못 걸리는 것이 생기는가 — 근거 토큰이 전성분에 실제로 있는지 원문 대조
  console.log("\n═══ 오탐 검사: 새로 제외된 건의 근거가 전성분 원문에 실제로 있는가 ═══");
  let checked = 0;
  let bogus = 0;
  for (const f of priorityFindings) {
    for (const p of f.products) {
      const token = f.evidence.get(p.id)!;
      const full = coerceIngredientListUnknown(p.full_ingredients);
      const inSource = full.some((t) => t === token) || currentLabels(p).some((t) => t === token);
      checked += 1;
      if (!inSource) {
        bogus += 1;
        console.log(`  *** ${p.id} ${p.brand} — 근거 "${token}" 이 원문에 없다 ***`);
      }
    }
  }
  console.log(`  ${checked}건 대조, 원문에 없는 근거 ${bogus}건${bogus === 0 ? " (오탐 없음)" : ""}`);

  // ── C. 지금 걸리던 건이 확장 후에도 그대로 걸리는가 (제외는 단조 증가여야 한다)
  console.log("\n═══ 회귀 검사: 지금 걸리던 건이 확장 후에도 걸리는가 ═══");
  let regressions = 0;
  for (const c of ALLERGY_INPUTS) {
    const banned = c.input.map((x) => toCanonical(x)).filter(Boolean);
    for (const p of active) {
      const cur = currentLabels(p);
      if (cur.length === 0) continue;
      if (!hits(cur, banned)) continue;
      if (!hitsNew(extendedLabels(p), banned)) {
        regressions += 1;
        console.log(`  *** ${c.label}: ${p.id} ${p.brand} 이 확장 후 통과해 버린다 ***`);
      }
    }
  }
  console.log(
    `  ${regressions === 0 ? "회귀 0건 — 제외 집합은 단조 증가한다 (더 안전해지기만 한다)" : `회귀 ${regressions}건`}`
  );

  // ── 최우선 답: 지금 노출 중인 위험
  console.log("\n═══ 지금 노출 중인 것 (최우선) ═══");
  if (priorityFindings.length === 0) {
    console.log("  없음.");
  } else {
    const union = new Set<number>();
    for (const f of priorityFindings) for (const p of f.products) union.add(p.id);
    console.log(
      `  알레르기를 신고한 사용자에게 잘못 노출될 수 있는 제품: 중복 제외 ${union.size}건`
    );
    for (const f of priorityFindings)
      console.log(`    ${f.allergen.padEnd(30)} ${f.products.length}건`);
    console.log(
      "\n  주의: 이 제품들이 그 자체로 위험한 게 아니다. 해당 성분을 **신고한 사용자** 에게만\n" +
        "  걸러졌어야 하는데 안 걸러진 것이다. 아무 것도 입력하지 않은 사용자에게는 영향 없다."
    );
  }
}

main().catch((e) => {
  console.error("[dryrun-allergen-full-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
