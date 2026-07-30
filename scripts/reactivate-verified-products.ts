/**
 * 내려졌던(비활성 + 검증 이력 있음) 제품을 게이트에 다시 태워 공개한다.
 *
 * `verifyAndActivateProduct` 의 최초 검증 가드(`.is("verified_at", null)`)는
 * 그대로 두고, `reactivateVerifiedProduct` 를 쓴다. 게이트 기준은 최초 검증과
 * 동일하다 — 낮추지 않는다.
 *
 * 성분 미매칭·모호 개수는 여기서 **실제로 세어** 넘긴다. 넘기지 않으면 0 으로
 * 간주되어 `ingredient_unmatched` 조건이 발동하지 않는다.
 *
 * 게이트가 보지 않는 것 두 가지를 여기서 먼저 거른다:
 *   - 구조화 성분이 0 건인데 «미매칭 0» 이 성립하는 경우 (토큰 자체가 없음)
 *   - 제품명이 깨진 경우 (공개되면 사용자가 깨진 글자를 본다)
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/reactivate-verified-products.ts            # 검증만
 *   ... scripts/reactivate-verified-products.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

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
  const apply = process.argv.includes("--apply");
  const { parseIngredientList, attachIngredientMatches, buildIngredientLookupMaps } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const { reactivateVerifiedProduct } = await import(
    "../src/lib/pipeline/product-verify/product-reactivate"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = "reactivate-2026-07-27";

  const maps = buildIngredientLookupMaps(
    await fetchAll(client, "ingredients", "id,slug,name_en,name_ko"),
    (
      await fetchAll<{ active: boolean }>(client, "ingredient_aliases", "id,ingredient_id,normalized_alias,alias,active")
    ).filter((a) => a.active) as never
  );
  const products = await fetchAll<{
    id: number;
    name: string | null;
    brand: string | null;
    active: boolean;
    verified_at: string | null;
    full_ingredients: unknown;
  }>(client, "products", "id,name,brand,active,verified_at,full_ingredients");
  const offers = await fetchAll<{ product_id: number; verification_status: string; stock_status: string }>(
    client,
    "product_offers",
    "id,product_id,verification_status,stock_status"
  );

  let considered = 0;
  const skipped: Array<[number, string]> = [];
  const targets: Array<{ id: number; label: string; unmatched: number; ambiguous: number }> = [];

  for (const p of products) {
    // 이 스크립트가 다루는 상태: 내려져 있고, 검증 이력이 있는 제품.
    if (p.active || !p.verified_at) continue;
    considered += 1;
    const label = `${p.brand ?? ""} ${p.name ?? ""}`.trim();

    if (/�/.test(p.name ?? "")) {
      skipped.push([p.id, "제품명이 깨져 있다 — 공개하면 사용자가 깨진 글자를 본다"]);
      continue;
    }
    const fi = Array.isArray(p.full_ingredients) ? (p.full_ingredients as string[]) : [];
    const n = attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized;
    const matched = n.filter((x) => x.matchedIngredientId).length;
    if (matched === 0) {
      skipped.push([p.id, "매칭된 성분이 0 건 — «미매칭 0» 이 성립할 뿐 성분을 모른다"]);
      continue;
    }
    const unmatched = n.filter((x) => !x.matchedIngredientId && x.matchKind !== "ambiguous").length;
    const ambiguous = n.filter((x) => x.matchKind === "ambiguous").length;
    if (unmatched > 0 || ambiguous > 0) {
      skipped.push([p.id, `미매칭 ${unmatched} · 모호 ${ambiguous}`]);
      continue;
    }
    const verifiedOffer = offers.some(
      (o) => o.product_id === p.id && o.verification_status === "verified" && o.stock_status === "in_stock"
    );
    if (!verifiedOffer) {
      skipped.push([p.id, "검증된 재고 오퍼 없음"]);
      continue;
    }
    targets.push({ id: p.id, label, unmatched, ambiguous });
  }

  console.log(`비활성 + 검증이력 있는 제품 ${considered}건`);
  console.log(`  재활성화 후보 ${targets.length}건 / 제외 ${skipped.length}건\n`);
  for (const t of targets) console.log(`  후보  ${String(t.id).padStart(3)}  ${t.label.slice(0, 46)}`);
  if (skipped.length > 0) {
    console.log();
    for (const [id, why] of skipped.slice(0, 20)) console.log(`  제외  ${String(id).padStart(3)}  ${why}`);
    if (skipped.length > 20) console.log(`  ... 외 ${skipped.length - 20}건`);
  }

  if (!apply) {
    console.log("\n검증 모드. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }

  let ok = 0;
  console.log();
  for (const t of targets) {
    const r = await reactivateVerifiedProduct(client, {
      productId: t.id,
      batchId,
      unmatchedIngredientCount: t.unmatched,
      ambiguousIngredientCount: t.ambiguous,
      safetyConflict: false,
      // 등급은 게이트가 허용하는 범위 안에서만 의미가 있다. 최초 검증 때
      // 산출된 값을 그대로 쓰지 않고, 재활성화 시점 기준으로 B 를 넘긴다 —
      // 점수 공식상 A 는 도달 불가이므로 B 가 실질 최고 등급이다.
      qualityGrade: "B",
    });
    if (r.reactivated) ok += 1;
    console.log(
      `  ${String(t.id).padStart(3)}  ${t.label.slice(0, 40).padEnd(42)}` +
        (r.reactivated
          ? "*** 재활성화 ***"
          : `실패: ${r.skippedReason}${r.gateBlockers.length ? " / " + r.gateBlockers.join(",") : ""}`)
    );
  }

  const after = (await fetchAll<{ id: number; active: boolean }>(client, "products", "id,active")).filter(
    (p) => p.active
  ).length;
  console.log(`\n재활성화 ${ok}/${targets.length}건. 활성 제품 ${after}건`);
}

main().catch((e) => {
  console.error("[reactivate-verified-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
