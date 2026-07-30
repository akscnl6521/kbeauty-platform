/**
 * 2026-07-25 사고로 생긴 중복 성분 행을 원본으로 병합한다.
 *
 * 배경: alias INSERT 권한이 없자 «-nk» 접미사 그림자 행을 만들어 우회한 사고가
 * 있었다. 그 잔재 14행이 남아 정규화 키를 원본과 충돌시키고 있다. 충돌한 키는
 * 매칭에서 통째로 배제되므로(§30-8), 사전에 멀쩡히 있는 성분이 미매칭으로
 * 떨어진다.
 *
 * **삭제가 아니라 병합이다.** 이 행들은 `product_ingredients` 에서 참조되고
 * 있어서 그냥 지우면 FK 가 막거나 링크가 사라진다. (처음에 «참조 0건» 으로
 * 봤던 것은 PostgREST 가 응답을 1000행에서 자른 탓이었다 — 반드시 페이지네이션.)
 *
 * 순서:
 *   1. 중복을 가리키는 product_ingredients 를 원본 id 로 옮긴다
 *   2. 제품이 원본과 중복을 **둘 다** 갖고 있으면 옮길 수 없으니 중복 링크를 지운다
 *   3. 참조가 사라진 중복 ingredients 행을 지운다
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/merge-duplicate-ingredients.ts            # 검증만
 *   ... scripts/merge-duplicate-ingredients.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 중복 id -> 남길 원본 id.
 *
 * 각 짝은 정규화 키가 같아 실제로 충돌하고 있음을 확인한 것이다. 자동 추론이
 * 아니라 사람이 검토할 수 있게 명시한다. `ko-batch-*` 슬러그라도 원본이 없는
 * 30건은 정상 고유 성분이므로 여기에 없다 — 지우면 데이터가 사라진다.
 */
const MERGE: Record<number, number> = {
  989: 772, // sorbeth-30-tetraoleate-nk        -> Sorbeth-30 Tetraoleate
  994: 778, // polyglyceryl-2-triisostearate-nk2
  996: 782, // benzotriazolyl-dodecyl-p-cresol-nk
  1001: 790, // polyether-1-nk
  1003: 793, // anthemis-nobilis-flower-oil-nk
  1005: 35, // 1-2-hexanediol-nk2               -> 2-Hexanediol
  1072: 123, // polyglyceryl-3-methylglucose-distearate-nk
  1117: 541, // hydrogenated-polyc6-14-olefin-nk2
  1118: 113, // polyglyceryl-10-stearate-nk
  1119: 58, // 3-o-ethyl-ascorbic-acid-nk
  1120: 299, // 6-naphthalate-nk
  1121: 312, // poly-c10-30-alkyl-acrylate-nk
  489: 236, // ko-batch 폴리글리세릴-10라우레이트
  508: 96, // ko-batch 폴리아크릴레이트크로스폴리머-6
};

/** PostgREST 는 1000행에서 자른다. 전량이 필요하면 반드시 페이지네이션. */
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const pi = await fetchAll<{ id: string; product_id: number; ingredient_id: number }>(
    client,
    "product_ingredients",
    "id,product_id,ingredient_id"
  );
  const aliases = await fetchAll<{ id: string; ingredient_id: number }>(
    client,
    "ingredient_aliases",
    "id,ingredient_id"
  );
  const ingredients = await fetchAll<{ id: number; slug: string | null }>(
    client,
    "ingredients",
    "id,slug"
  );
  const present = new Set(ingredients.map((r) => r.id));

  const repoint: Array<{ linkId: string; from: number; to: number }> = [];
  const dropLink: string[] = [];
  const aliasRepoint: Array<{ aliasId: string; from: number; to: number }> = [];
  const deletable: number[] = [];
  const skipped: Array<[number, string]> = [];

  for (const [dupStr, keep] of Object.entries(MERGE)) {
    const dup = Number(dupStr);
    if (!present.has(dup)) {
      skipped.push([dup, "이미 없음"]);
      continue;
    }
    if (!present.has(keep)) {
      // 남길 원본이 없는데 중복만 지우면 성분이 통째로 사라진다.
      skipped.push([dup, `원본 ${keep} 이 없다 — 건드리지 않는다`]);
      continue;
    }
    const keepProducts = new Set(pi.filter((x) => x.ingredient_id === keep).map((x) => x.product_id));
    for (const row of pi.filter((x) => x.ingredient_id === dup)) {
      if (keepProducts.has(row.product_id)) dropLink.push(row.id);
      else repoint.push({ linkId: row.id, from: dup, to: keep });
    }
    for (const a of aliases.filter((x) => x.ingredient_id === dup)) {
      aliasRepoint.push({ aliasId: a.id, from: dup, to: keep });
    }
    deletable.push(dup);
  }

  console.log(`병합 대상 ${deletable.length}건 / 건너뜀 ${skipped.length}건`);
  for (const [id, why] of skipped) console.log(`  건너뜀 ${id}: ${why}`);
  console.log(`  product_ingredients 재지정 ${repoint.length}행`);
  console.log(`  중복 링크 삭제 ${dropLink.length}행 (제품이 원본과 중복을 둘 다 가진 경우)`);
  console.log(`  ingredient_aliases 재지정 ${aliasRepoint.length}행`);
  console.log(`  ingredients 삭제 ${deletable.length}행`);

  if (!apply) {
    console.log("\n검증 모드. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }

  for (const r of repoint) {
    const { error } = await client
      .from("product_ingredients")
      .update({ ingredient_id: r.to })
      .eq("id", r.linkId);
    if (error) throw new Error(`재지정 실패 link ${r.linkId}: ${error.code} ${error.message}`);
  }
  for (const a of aliasRepoint) {
    const { error } = await client
      .from("ingredient_aliases")
      .update({ ingredient_id: a.to })
      .eq("id", a.aliasId);
    if (error) throw new Error(`alias 재지정 실패 ${a.aliasId}: ${error.code} ${error.message}`);
  }
  for (const id of dropLink) {
    const { error } = await client.from("product_ingredients").delete().eq("id", id);
    if (error) throw new Error(`중복 링크 삭제 실패 ${id}: ${error.code} ${error.message}`);
  }

  const { error: delErr } = await client.from("ingredients").delete().in("id", deletable);
  if (delErr) {
    // 우회하지 않는다. 권한이면 필요한 GRANT 를 그대로 알린다.
    console.error(`\n[중단] ingredients 삭제 실패: ${delErr.code} ${delErr.message}`);
    if (delErr.code === "42501") {
      console.error("\n필요한 GRANT:\n  GRANT DELETE ON TABLE public.ingredients TO service_role;");
    }
    process.exitCode = 1;
    return;
  }

  const after = await fetchAll<{ id: number }>(client, "ingredients", "id");
  console.log(`\n반영 완료. ingredients ${ingredients.length} -> ${after.length}`);
}

main().catch((e) => {
  console.error("[merge-duplicate-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
