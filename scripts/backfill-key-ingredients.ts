/**
 * `key_ingredients` 가 비어 있는 활성 제품을, **그 제품이 스스로 표시한 전성분**에서
 * 채운다.
 *
 * 왜 필요한가 — 추천 파이프라인(`rankProducts`, `filterCandidatesBySafety`)은
 * `key_ingredients` / `key_ingredients_ja` 만 읽는다. `full_ingredients` 는 보지
 * 않는다. 자율 수집기는 `full_ingredients` 와 `product_ingredients` 링크만 채우고
 * `key_ingredients` 는 건드리지 않아서, 수집된 제품은 활성화돼도 추천에서
 * `incomplete_info` 로 통째로 제외되고 있었다.
 *
 * 지어내지 않는다 — `extractKeyIngredientsFromFullList` 는 사전에 있으면서 **동시에
 * 그 제품의 전성분 목록에 실제로 등장하는** 토큰만 고른다. 전성분에 없는 이름은
 * 절대 만들어 내지 않는다. 저장하는 값도 사전 표시명이 아니라 **제품 전성분에 적힌
 * 원문 토큰**이라, 나중에 원문과 대조할 수 있다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/backfill-key-ingredients.ts            # dry-run
 *   ... scripts/backfill-key-ingredients.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

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
  const apply = process.argv.includes("--apply");
  const { deriveKeyIngredientsFromFullList } = await import(
    "../src/lib/catalog/keyIngredients"
  );
  const { tryInsertWriteAudit } = await import("../src/lib/admin/audit-log");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const rows = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    active: boolean | null;
    verified_at: string | null;
    key_ingredients: unknown;
    full_ingredients: unknown;
  }>(client, "products", "id,brand,name,active,verified_at,key_ingredients,full_ingredients");

  const active = rows.filter((r) => r.active === true && r.verified_at != null);
  const missing = active.filter(
    (r) => !Array.isArray(r.key_ingredients) || r.key_ingredients.length === 0
  );

  type Plan = {
    id: number;
    brand: string;
    name: string;
    derived: string[];
    fullCount: number;
    /** null 이었는지 빈 배열이었는지 — 갱신 조건이 달라진다 */
    wasNull: boolean;
  };
  const plans: Plan[] = [];
  const noFullList: Plan[] = [];
  const noHit: Plan[] = [];

  for (const r of missing) {
    const full = Array.isArray(r.full_ingredients)
      ? (r.full_ingredients as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim() !== ""
        )
      : [];
    const plan: Plan = {
      id: r.id,
      brand: r.brand ?? "-",
      name: (r.name ?? "-").slice(0, 40),
      derived: [],
      fullCount: full.length,
      wasNull: r.key_ingredients == null,
    };
    if (full.length === 0) {
      noFullList.push(plan);
      continue;
    }
    plan.derived = deriveKeyIngredientsFromFullList(full);
    if (plan.derived.length === 0) noHit.push(plan);
    else plans.push(plan);
  }

  console.log(`활성 제품 ${active.length}건 중 key_ingredients 없는 것 ${missing.length}건`);
  console.log(`  → 전성분에서 채울 수 있음 ${plans.length}건`);
  console.log(`  → 전성분 자체가 없음 ${noFullList.length}건 (손대지 않음)`);
  console.log(`  → 전성분은 있으나 사전 매칭 0건 ${noHit.length}건 (손대지 않음)\n`);

  const byBrand = new Map<string, number>();
  for (const p of plans) byBrand.set(p.brand, (byBrand.get(p.brand) ?? 0) + 1);
  console.log("채워지는 브랜드:");
  for (const [b, n] of [...byBrand.entries()].sort((a, b2) => b2[1] - a[1]))
    console.log(`  ${b.padEnd(20)} ${n}건`);

  console.log("\n샘플 10건 (원문 토큰 그대로 저장):");
  for (const p of plans.slice(0, 10))
    console.log(
      `  ${String(p.id).padStart(4)} ${p.brand.slice(0, 14).padEnd(15)}${p.name.slice(0, 30).padEnd(32)}` +
        `전성분 ${String(p.fullCount).padStart(3)} → key ${p.derived.length}: ${p.derived.slice(0, 6).join(", ")}`
    );

  if (noHit.length > 0) {
    console.log("\n사전 매칭 0건 (그대로 둠):");
    for (const p of noHit.slice(0, 10))
      console.log(`  ${String(p.id).padStart(4)} ${p.brand.slice(0, 14).padEnd(15)}${p.name} (전성분 ${p.fullCount})`);
  }
  if (noFullList.length > 0) {
    console.log("\n전성분 없음 (그대로 둠):");
    for (const p of noFullList.slice(0, 10))
      console.log(`  ${String(p.id).padStart(4)} ${p.brand.slice(0, 14).padEnd(15)}${p.name}`);
  }

  if (!apply) {
    console.log("\ndry-run. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }
  if (plans.length === 0) return;

  // 되돌릴 수 있게, 건드릴 행의 현재 값을 먼저 파일로 남긴다.
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = `data/backups/${stamp}`;
  mkdirSync(dir, { recursive: true });
  const backupPath = `${dir}/key-ingredients-before-backfill.json`;
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: "backfill-key-ingredients 실행 직전 값 — 되돌릴 때 이 값으로 UPDATE",
        rows: plans.map((p) => ({
          id: p.id,
          brand: p.brand,
          name: p.name,
          key_ingredients: p.wasNull ? null : [],
          willSet: p.derived,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\n되돌리기용 백업: ${backupPath}`);

  let updated = 0;
  for (const p of plans) {
    // key_ingredients 가 여전히 비어 있을 때만 쓴다 — 사람이 채운 값은 덮지 않는다.
    let q = client.from("products").update({ key_ingredients: p.derived }).eq("id", p.id);
    if (p.wasNull) q = q.is("key_ingredients", null);
    const { data: touched, error } = await q.select("id");
    if (error) throw new Error(`${p.id} 갱신 실패: ${error.code} ${error.message}`);
    if ((touched ?? []).length === 0) {
      console.log(`  ${p.id} 건너뜀 — 그 사이 값이 채워졌다`);
      continue;
    }
    updated += 1;

    await tryInsertWriteAudit(client, {
      action: "product_key_ingredients_backfilled",
      productId: p.id,
      actorRole: "admin",
      metadata: {
        via: "backfill-key-ingredients",
        derived: p.derived,
        fullIngredientCount: p.fullCount,
        evidence: "dictionary_and_present_in_full_list",
      },
      oldValue: { key_ingredients: null },
    });
  }

  const after = await fetchAll<{ id: number; active: boolean | null; verified_at: string | null; key_ingredients: unknown }>(
    client,
    "products",
    "id,active,verified_at,key_ingredients"
  );
  const stillMissing = after.filter(
    (r) =>
      r.active === true &&
      r.verified_at != null &&
      (!Array.isArray(r.key_ingredients) || r.key_ingredients.length === 0)
  ).length;
  console.log(`\n${updated}건 갱신. 활성 제품 중 아직 key_ingredients 없는 것 ${stillMissing}건.`);
}

main().catch((e) => {
  console.error("[backfill-key-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
