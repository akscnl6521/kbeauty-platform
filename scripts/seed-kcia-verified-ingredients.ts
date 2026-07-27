/**
 * 대한화장품협회 성분사전(kcia.or.kr/cid)에서 **공식 영문명을 확인한** 성분만
 * 사전에 넣는다.
 *
 * 식약처 «화장품 원료성분정보» 는 한글명만 있고 영문명이 빈 행이 있다.
 * `ingredients.name_en` 은 NOT NULL 이므로 그런 성분은 넣을 수 없는데,
 * 영문명을 지어내는 것은 §17 위반이고 `name_en` 에 한글을 넣는 것은
 * 2026-07 에 정리한 `ko-batch` 오염의 반복이다.
 *
 * 그래서 협회 표준 명칭을 **사람이 조회해 확인한 것만** 여기에 적는다.
 * 각 항목에 성분코드를 남겨 나중에 대조할 수 있게 한다 —
 * `https://kcia.or.kr/cid/search/ingd_list.php?skind=INGD_NM&sword=<한글명>`
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/seed-kcia-verified-ingredients.ts            # 검증만
 *   ... scripts/seed-kcia-verified-ingredients.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 협회 사전에서 확인한 항목. `kciaCode` 는 조회 근거다.
 *
 * `nameEn` 은 협회가 고시한 표준 영문명 그대로 적는다. 우리가 «더 정확해
 * 보이는» 이름으로 바꾸지 않는다 — 표준 명칭이 기준이다.
 */
const KCIA_VERIFIED: ReadonlyArray<{
  nameKo: string;
  nameEn: string;
  kciaCode: string;
  note?: string;
}> = [
  {
    nameKo: "빙하수",
    nameEn: "Water",
    kciaCode: "6393",
    // 협회 표준 영문명이 «Water» 다. 빙하에서 왔다는 사실은 표준 명칭에
    // 반영되지 않는다. 우리가 «Glacier Water» 로 바꾸면 표준을 벗어난다.
    note: "협회 표준 영문명이 Water — 별칭으로 기존 Water 행에 붙인다",
  },
  {
    nameKo: "광엽발계뿌리추출물",
    nameEn: "Smilax Glabra Root Extract",
    kciaCode: "6463",
    note: "구명칭 중국토복령추출물",
  },
];

function slugify(en: string): string {
  return en
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
  const apply = process.argv.includes("--apply");
  const { normalizeTextKey } = await import("../src/lib/pipeline/ingredient-normalize");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const ingredients = await fetchAll<{
    id: number;
    slug: string | null;
    name_en: string | null;
    name_ko: string | null;
  }>(client, "ingredients", "id,slug,name_en,name_ko");
  const aliases = await fetchAll<{ normalized_alias: string | null; alias: string | null }>(
    client,
    "ingredient_aliases",
    "id,normalized_alias,alias"
  );

  const byNameEn = new Map<string, number>();
  const taken = new Map<string, number>();
  for (const r of ingredients) {
    const ke = normalizeTextKey(r.name_en);
    if (ke) {
      byNameEn.set(ke, r.id);
      taken.set(ke, r.id);
    }
    for (const v of [r.slug, r.name_ko]) {
      const k = normalizeTextKey(v);
      if (k && !taken.has(k)) taken.set(k, r.id);
    }
  }
  const aliasKeys = new Set(
    aliases.map((a) => normalizeTextKey(a.normalized_alias || a.alias)).filter(Boolean)
  );

  const newIngredients: Array<{ slug: string; name_en: string; name_ko: string }> = [];
  const newAliases: Array<{ ingredient_id: number; alias: string; normalized_alias: string }> = [];
  const skipped: Array<[string, string]> = [];

  for (const entry of KCIA_VERIFIED) {
    const koKey = normalizeTextKey(entry.nameKo);
    if (aliasKeys.has(koKey)) {
      skipped.push([entry.nameKo, "이미 별칭으로 있음"]);
      continue;
    }
    const holder = taken.get(koKey);
    if (holder != null) {
      skipped.push([entry.nameKo, `이미 성분 ${holder} 가 이 키를 쓴다`]);
      continue;
    }

    const existing = byNameEn.get(normalizeTextKey(entry.nameEn));
    if (existing != null) {
      // 영문명이 이미 사전에 있다 -> 행을 만들지 않고 한글 별칭만 붙인다.
      newAliases.push({ ingredient_id: existing, alias: entry.nameKo, normalized_alias: koKey });
      console.log(`  별칭  ${entry.nameKo} -> 기존 성분 ${existing} (${entry.nameEn})`);
      continue;
    }
    const slug = slugify(entry.nameEn);
    if (!slug || taken.has(normalizeTextKey(slug))) {
      skipped.push([entry.nameKo, `슬러그 «${slug}» 를 쓸 수 없다`]);
      continue;
    }
    newIngredients.push({ slug, name_en: entry.nameEn, name_ko: entry.nameKo });
    console.log(`  신규  ${entry.nameKo} = ${entry.nameEn} (KCIA ${entry.kciaCode})`);
  }

  for (const [ko, why] of skipped) console.log(`  건너뜀 ${ko}: ${why}`);
  console.log(`\n신규 성분 ${newIngredients.length}건 / 별칭 ${newAliases.length}건 / 건너뜀 ${skipped.length}건`);

  if (!apply) {
    console.log("검증 모드. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }

  if (newIngredients.length > 0) {
    const { error } = await client.from("ingredients").insert(newIngredients);
    if (error) throw new Error(`ingredients INSERT 실패: ${error.code} ${error.message}`);
    console.log(`ingredients ${newIngredients.length}행 추가`);
  }
  if (newAliases.length > 0) {
    const { error } = await client.from("ingredient_aliases").insert(
      newAliases.map((a) => ({
        ...a,
        alias_type: "ko",
        language_code: "ko",
        review_status: "pending",
        active: true,
      }))
    );
    if (error) throw new Error(`ingredient_aliases INSERT 실패: ${error.code} ${error.message}`);
    console.log(`ingredient_aliases ${newAliases.length}행 추가`);
  }
}

main().catch((e) => {
  console.error("[seed-kcia-verified-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
