/**
 * 한글 성분명 ↔ 영문 INCI 사전 매핑 — 정식 경로(ingredient_aliases)로만 적재.
 *
 * 배경: `ingredients` 602건 중 271건이 영문명만 있고 한글명이 없다. 그래서
 * 한국 브랜드 페이지에서 뽑은 «부틸렌글라이콜» 같은 표준 한글 성분명이
 * 사전에 이미 있는 «Butylene Glycol» 을 못 찾고 미매칭으로 떨어진다.
 *
 * 이 스크립트는 **행을 새로 만들지 않는다.** 이미 존재하는 성분에 한글
 * 별칭만 붙인다. 2026-07-25 사고(alias INSERT 권한이 없자 «-nk» 접미사
 * 그림자 행 296건을 만들어 우회) 를 반복하지 않기 위한 규칙:
 *
 *   - ingredient_aliases INSERT 가 막히면 즉시 중단하고 필요한 GRANT 를 보고한다.
 *   - ingredients 에 INSERT/UPDATE 하지 않는다. 사전에 없는 성분은 그대로 둔다.
 *   - 대응 영문명이 사전에 없으면 매핑을 건너뛴다 (needs_review 로 남는다).
 *
 * 매칭 계약(중요): `ingredient-link.loadIngredientMaps` 는 alias 키를
 * `(normalized_alias || alias).toLowerCase().trim()` 으로 만드는데, 조회 키는
 * `ingredient-normalize.parseIngredientList` 가 만든 정규화 문자열이다.
 * 따라서 `normalized_alias` 는 **같은 정규화를 미리 적용한 형태**로 저장한다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/seed-ko-ingredient-aliases.ts          # 검증만 (기본)
 *   ... scripts/seed-ko-ingredient-aliases.ts --apply # 실제 INSERT
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 한글 표기 → 사전에 있어야 하는 영문 INCI 명.
 *
 * 각 항목은 «이 한글명은 이 INCI 를 가리킨다» 는 명시적 주장이다. 추론이나
 * 음차 자동생성이 아니라 사람이 검토할 수 있는 형태로 나열한다. 오른쪽
 * 영문명이 `ingredients.name_en` 에 정확히 없으면 그 항목은 건너뛴다.
 */
const KO_TO_INCI: Array<[ko: string, nameEn: string]> = [
  // --- 보습제·용매 ---
  ["부틸렌글라이콜", "Butylene Glycol"],
  ["판테놀", "Panthenol"],
  ["만니톨", "MANNITOL"],
  ["풀루란", "Pullulan"],
  ["안하이드로자일리톨", "Anhydroxylitol"],
  ["자일리틸글루코사이드", "Xylitylglucoside"],
  ["아이소펜틸다이올", "Isopentyldiol"],
  ["소듐피씨에이", "Sodium PCA"],
  ["피씨에이", "PCA"],

  // --- 지방 알코올·유성 성분 ---
  ["세틸알코올", "Cetyl Alcohol"],
  ["올리브오일", "Olea Europaea (Olive) Fruit Oil"],
  ["메도우폼씨오일", "Limnanthes Alba (Meadowfoam) Seed Oil"],
  ["카나우바왁스", "Copernicia Cerifera (Carnauba) Wax"],
  ["올레익애씨드", "OLEIC ACID"],
  ["글리세릴스테아레이트에스이", "Glyceryl Stearate SE"],
  ["폴리메틸실세스퀴옥세인", "Polymethylsilsesquioxane"],
  ["하이드록시프로필비스팔미타마이드엠이에이", "HYDROXYPROPYL BISPALMITAMIDE MEA"],
  ["하이드록시프로필비스라우라마이드엠이에이", "HYDROXYPROPYL BISLAURAMIDE MEA"],

  // --- 히알루론산 유도체 ---
  ["하이드롤라이즈드소듐하이알루로네이트", "Hydrolyzed Sodium Hyaluronate"],
  ["포타슘하이알루로네이트", "Potassium Hyaluronate"],
  ["하이드록시프로필트라이모늄하이알루로네이트", "Hydroxypropyltrimonium Hyaluronate"],
  ["소듐아세틸레이티드하이알루로네이트", "Sodium Acetylated Hyaluronate"],

  // --- 활성·비타민 ---
  ["토코페릴아세테이트", "Tocopheryl Acetate"],
  ["트레오닌", "Threonine"],
  ["라이신에이치씨엘", "Lysine HCl"],
  ["글루타티온", "Glutathione"],
  ["소듐디엔에이", "Sodium DNA"],
  ["피탄트리올", "Phytantriol"],

  // --- 식물 추출물 (표준 한글명이 해당 학명과 1:1인 것만) ---
  ["당근추출물", "Daucus Carota Sativa (Carrot) Root Extract"],
  ["다시마추출물", "Laminaria Japonica Extract"],
  ["참마뿌리추출물", "Dioscorea Japonica Root Extract"],
  ["제비꽃꽃추출물", "Viola Mandshurica Flower Extract"],
  ["아이리쉬모스추출물", "Chondrus Crispus Extract"],
  ["사탕수수추출물", "Saccharum Officinarum (Sugarcane) Extract"],
  ["스핑고모나스발효추출물", "Sphingomonas Ferment Extract"],
  ["비타민나무수", "Hippophae Rhamnoides Water"],
  ["비타민나무열매추출물", "Hippophae Rhamnoides Fruit Extract"],
  ["대왕송잎추출물", "Pinus Palustris Leaf Extract"],

  // --- 보존제·pH 조절·기본 ---
  ["포타슘솔베이트", "Potassium Sorbate"],
  ["소듐벤조에이트", "Sodium Benzoate"],
  ["시트릭애씨드", "Citric Acid"],
  ["소듐클로라이드", "Sodium Chloride"],
  ["소듐하이드록사이드", "Sodium Hydroxide"],
  ["토코페롤", "Tocopherol"],
  ["카페인", "Caffeine"],
  ["잔탄검", "Xanthan Gum"],
  ["알란토인", "Allantoin"],
  ["아데노신", "Adenosine"],
  ["스쿠알란", "Squalane"],
  ["다이메티콘", "Dimethicone"],
  ["글리세린", "Glycerin"],
  ["정제수", "Water"],

  // --- 기타 기능성 ---
  ["생강추출물", "Zingiber Officinale (Ginger) Root Extract"],
  ["하이드롤라이즈드케라틴", "Hydrolyzed Keratin"],
  ["프로테아제", "Protease"],
  ["셀룰로오스검", "Cellulose Gum"],
  ["에칠헥실글리세린", "Ethylhexylglycerin"],
  ["다이소듐이디티에이", "Disodium EDTA"],
  ["디소듐이디티에이", "Disodium EDTA"],
];

/** ingredient-normalize.normalizeTextKey 와 동일해야 한다. */
function normalizeTextKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-·•|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: ingredients, error: ingErr } = await client
    .from("ingredients")
    .select("id, slug, name_en, name_ko")
    .limit(5000);
  if (ingErr) throw ingErr;

  // 영문명 -> id (정규화 기준). 같은 키에 여러 id 가 걸리면 모호하므로 배열로 둔다.
  const byNameEn = new Map<string, number[]>();
  const takenKeys = new Map<string, number[]>();
  for (const r of (ingredients ?? []) as Array<{
    id: number;
    slug: string | null;
    name_en: string | null;
    name_ko: string | null;
  }>) {
    if (r.name_en) {
      const k = normalizeTextKey(r.name_en);
      byNameEn.set(k, [...(byNameEn.get(k) ?? []), r.id]);
    }
    for (const v of [r.slug, r.name_en, r.name_ko]) {
      if (!v) continue;
      const k = normalizeTextKey(v);
      takenKeys.set(k, [...(takenKeys.get(k) ?? []), r.id]);
    }
  }

  const { data: existingAliases, error: aliasErr } = await client
    .from("ingredient_aliases")
    .select("ingredient_id, normalized_alias")
    .limit(10000);
  if (aliasErr) {
    console.error(
      "[중단] ingredient_aliases 를 읽을 수 없다. 우회하지 않고 멈춘다:",
      aliasErr.message
    );
    process.exitCode = 1;
    return;
  }
  const already = new Set(
    (existingAliases ?? []).map((a: { normalized_alias: string }) =>
      String(a.normalized_alias).toLowerCase().trim()
    )
  );

  type Row = {
    ingredient_id: number;
    alias: string;
    normalized_alias: string;
    alias_type: string;
    language_code: string;
    review_status: string;
    active: boolean;
  };
  const toInsert: Row[] = [];
  const skipped: Array<[string, string]> = [];

  for (const [ko, nameEn] of KO_TO_INCI) {
    const normalized = normalizeTextKey(ko);
    const ids = byNameEn.get(normalizeTextKey(nameEn)) ?? [];

    if (ids.length === 0) {
      skipped.push([ko, `사전에 «${nameEn}» 없음`]);
      continue;
    }
    if (new Set(ids).size > 1) {
      skipped.push([ko, `«${nameEn}» 가 여러 행(${ids.join("/")})에 중복`]);
      continue;
    }
    if (already.has(normalized)) {
      skipped.push([ko, "이미 등록됨"]);
      continue;
    }
    // 이 한글명이 이미 다른 성분의 slug/name_en/name_ko 로 잡혀 있으면
    // alias 를 추가하는 순간 ambiguous 가 되어 오히려 매칭을 잃는다.
    const clash = (takenKeys.get(normalized) ?? []).filter((id) => id !== ids[0]);
    if (clash.length > 0) {
      skipped.push([ko, `기존 행 ${clash.join("/")} 과 키 충돌 -> 모호해짐`]);
      continue;
    }

    toInsert.push({
      ingredient_id: ids[0]!,
      alias: ko,
      normalized_alias: normalized,
      alias_type: "ko",
      language_code: "ko",
      // 사람 검수 전이지만 매칭에는 쓰인다(로더는 active 만 본다).
      review_status: "pending",
      active: true,
    });
  }

  console.log(`매핑 후보 ${KO_TO_INCI.length}건 -> 삽입 대상 ${toInsert.length}건 / 제외 ${skipped.length}건`);
  for (const [ko, why] of skipped) console.log(`  건너뜀  ${ko.padEnd(24)} ${why}`);
  for (const r of toInsert) console.log(`  삽입    ${r.alias.padEnd(24)} -> id ${r.ingredient_id}`);

  if (!apply) {
    console.log("\n검증 모드. 실제 INSERT 하려면 --apply 를 붙인다.");
    return;
  }
  if (toInsert.length === 0) return;

  const { data: inserted, error: insErr } = await client
    .from("ingredient_aliases")
    .insert(toInsert)
    .select("id");

  if (insErr) {
    // 2026-07-25 사고 재발 방지: 권한 문제면 절대 우회하지 않는다.
    console.error("\n[중단] ingredient_aliases INSERT 실패:", insErr.code, insErr.message);
    if (insErr.code === "42501") {
      console.error(
        "\n권한 부족이다. 그림자 행·임시 테이블 우회를 하지 않고 여기서 멈춘다.\n" +
          "필요한 GRANT:\n" +
          "  GRANT INSERT ON TABLE public.ingredient_aliases TO service_role;"
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\n삽입 완료: ${inserted?.length ?? 0}건`);
}

main().catch((e) => {
  console.error("[seed-ko-ingredient-aliases] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
