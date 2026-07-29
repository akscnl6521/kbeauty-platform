/**
 * Staging `ingredients`(1,191행)를 Production(112행)에 **없는 것만** 추가한다.
 * 승인 받은 작업 (2026-07-29).
 *
 * 왜 필요한가 — Production 사전이 112행뿐이라 수집한 전성분 대부분이
 * `ingredient_unmatched` 로 게이트에 막힌다(DASHBOARD §32 문제 #8).
 *
 * 중복 판정
 *   `slug` · `name_en` · `name_ko` 를 각각 `normalizeTextKey` 로 정규화해 비교한다.
 *   하나라도 겹치면 «이미 있는 것» 으로 보고 건너뛴다. 기존 행은 **수정하지 않는다** —
 *   Production 쪽 값이 사람이 손본 것일 수 있다.
 *
 * `id` 는 옮기지 않는다. Production 에서 새로 부여받는다 — Staging 의 id 를 그대로
 * 넣으면 기존 행과 충돌하고, `product_ingredients.ingredient_id` 가 엉뚱한 성분을
 * 가리키게 된다.
 *
 * 출처: Staging 사전은 식약처 화장품 원료성분정보 API 적재분이 대부분이다(§30-9,
 * §35). 지어낸 이름이 아니라 공식 사전에서 온 값이라 그대로 옮긴다.
 *
 * 실행: npm run merge:ingredients-to-production -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const EXPECTED_STAGING_REF = "jfnjufmldiqlgvgyugfd";

type Ingredient = Record<string, unknown> & {
  id: number;
  slug: string | null;
  name_en: string | null;
  name_ko: string | null;
};

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function fetchAll(client: SupabaseClient): Promise<Ingredient[]> {
  const out: Ingredient[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("ingredients")
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`ingredients 조회 실패: ${error.code} ${error.message}`);
    const page = (data ?? []) as Ingredient[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { normalizeTextKey } = await import("@/lib/pipeline/ingredient-normalize");

  const prodUrl = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const prodKey = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const stgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const stgKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!prodUrl || !prodKey || !stgUrl || !stgKey) {
    console.log("자격증명 부족 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((prodUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: Production ref 불일치.");
    process.exitCode = 1;
    return;
  }
  if ((stgUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_STAGING_REF) {
    console.error("ABORT: Staging ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const staging = createClient(stgUrl, stgKey, { auth: { persistSession: false } });
  const prod = createClient(prodUrl, prodKey, { auth: { persistSession: false } });

  const stagingRows = await fetchAll(staging);
  const prodRows = await fetchAll(prod);
  console.log(`Staging ${stagingRows.length}행 · Production ${prodRows.length}행`);

  // 이미 있는 것의 키 집합
  const existing = new Set<string>();
  for (const r of prodRows) {
    for (const v of [r.slug, r.name_en, r.name_ko]) {
      const k = normalizeTextKey(v);
      if (k) existing.add(k);
    }
  }

  const toAdd: Ingredient[] = [];
  const skipped: string[] = [];
  const seenInBatch = new Set<string>();

  for (const r of stagingRows) {
    const keys = [r.slug, r.name_en, r.name_ko].map((v) => normalizeTextKey(v)).filter(Boolean);
    if (keys.length === 0) {
      skipped.push(`id ${r.id}: 이름·slug 가 모두 비어 있음`);
      continue;
    }
    if (keys.some((k) => existing.has(k))) {
      skipped.push(`id ${r.id}: 이미 있음 (${r.name_en ?? r.name_ko})`);
      continue;
    }
    // 같은 배치 안에서의 중복도 막는다
    if (keys.some((k) => seenInBatch.has(k))) {
      skipped.push(`id ${r.id}: 배치 내 중복 (${r.name_en ?? r.name_ko})`);
      continue;
    }
    for (const k of keys) seenInBatch.add(k);
    toAdd.push(r);
  }

  console.log(`\n추가 대상 ${toAdd.length}행 · 건너뜀 ${skipped.length}행`);
  console.log(`  이미 있음: ${skipped.filter((s) => s.includes("이미 있음")).length}`);
  console.log(`  배치 내 중복: ${skipped.filter((s) => s.includes("배치 내 중복")).length}`);
  console.log(`  이름 없음: ${skipped.filter((s) => s.includes("비어 있음")).length}`);
  console.log("\n추가될 것 예시:");
  for (const r of toAdd.slice(0, 8)) console.log(`  ${r.name_en ?? "-"} / ${r.name_ko ?? "-"}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 적재한다.");
    return;
  }
  if (toAdd.length === 0) return;

  // 적재 전 Production 사전 스냅샷
  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_ingredients-병합전.sql`;
  const cols = Object.keys(prodRows[0] ?? {});
  const lit = (v: unknown) =>
    v === null || v === undefined
      ? "NULL"
      : typeof v === "number"
        ? String(v)
        : typeof v === "boolean"
          ? v
            ? "TRUE"
            : "FALSE"
          : `'${String(v).replace(/'/g, "''")}'`;
  writeFileSync(
    path,
    [
      "-- Production ingredients 병합 전 스냅샷",
      `-- 생성: ${new Date().toISOString()} · ${prodRows.length}행`,
      "",
      ...prodRows.map(
        (r) => `INSERT INTO ingredients (${cols.join(", ")}) VALUES (${cols.map((c) => lit(r[c])).join(", ")});`
      ),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  // id 는 빼고 넣는다 — Production 에서 새로 부여받는다
  let inserted = 0;
  const failures: string[] = [];
  const CHUNK = 100;
  for (let i = 0; i < toAdd.length; i += CHUNK) {
    const chunk = toAdd.slice(i, i + CHUNK).map((r) => {
      const { id: _id, created_at: _c, ...rest } = r;
      return rest;
    });
    const { data, error } = await prod.from("ingredients").insert(chunk).select("id");
    if (error) {
      failures.push(`${i}~${i + chunk.length}: ${error.code} ${error.message}`);
      continue;
    }
    inserted += (data ?? []).length;
    console.log(`  ${i + chunk.length}/${toAdd.length} …`);
  }

  const after = await prod.from("ingredients").select("*", { count: "exact", head: true });
  console.log(`\n추가 ${inserted}행 · Production 사전 ${prodRows.length} → ${after.count}행`);
  if (failures.length > 0) {
    console.log("실패:");
    for (const f of failures) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error("[merge-staging-ingredients-to-production] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
