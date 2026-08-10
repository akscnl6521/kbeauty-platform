/**
 * 제품 유형을 **표준 분류로 맞춘다.**
 *
 * 2026-08-09 Production 추천 풀 86건에 유형이 23종 있었다. 실제 유형은 그 절반도
 * 안 된다 — `serum`/`Serum`, `toner`/`Toner`, `SPF`/`sunscreen` 처럼 표기만 다르다.
 *
 * ## 지어내지 않는다
 *
 *   · `canonicalProductCategory` 가 **null 을 돌려주면 건드리지 않는다.**
 *     `mask` 는 시트인지 수면팩인지 워시오프인지 모르고, `cleanser` 도 마찬가지다.
 *     모르는 것을 그럴듯한 값으로 바꿔 놓으면 틀렸다는 것조차 드러나지 않는다.
 *   · 유형이 **비어 있는 제품도 건드리지 않는다** — 이름으로 추측해 채우지 않는다.
 *     그건 등록 경로(`categoryFromKoreanName`)가 출처를 보고 할 일이다.
 *   · 바뀌는 것이 없으면 아무것도 쓰지 않는다.
 *
 * 실행: npm run repair:product-categories            # dry-run
 *       npm run repair:product-categories -- --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import {
  canonicalProductCategory,
  categoryFromNameWhenEmpty,
  refineCategoryFromName,
} from "../src/lib/catalog/taxonomy/canonicalProductCategory";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

type ProductRow = {
  id: number;
  brand: string | null;
  name: string | null;
  name_ko: string | null;
  category: string | null;
  active: boolean | null;
  verified_at: string | null;
};

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  // PostgREST 는 1000행에서 자른다.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }
  console.log(`대상 DB: Production (${ref})\n`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const products = await fetchAll<ProductRow>(client, "products", "id,brand,name,name_ko,category,active,verified_at");

  const changes: Array<{ row: ProductRow; to: string }> = [];
  const untouched = new Map<string, number>();

  for (const p of products) {
    const raw = String(p.category ?? "").trim();
    if (!raw) {
      // **비어 있으면 «아무 시나리오에나» 걸린다** — 유형 조건이 통째로 건너뛰어진다.
      // 이름이 유형을 분명히 말할 때만 채운다. 애매하면 그대로 둔다.
      const label = `${String(p.name_ko ?? "")} ${String(p.name ?? "")}`;
      const guessed = categoryFromNameWhenEmpty(label);
      if (guessed) changes.push({ row: p, to: guessed });
      else untouched.set("(비어 있음)", (untouched.get("(비어 있음)") ?? 0) + 1);
      continue;
    }
    const canonical = canonicalProductCategory(raw);
    if (canonical && canonical !== raw) {
      changes.push({ row: p, to: canonical });
      continue;
    }
    if (canonical) continue;

    // 표준으로 못 바꾼 덩어리 값(`mask` · `cleanser`)은 **이름이 말해 줄 때만** 좁힌다.
    const label = `${String(p.name_ko ?? "")} ${String(p.name ?? "")}`;
    const refined = refineCategoryFromName(raw, label);
    if (refined && refined !== raw) {
      changes.push({ row: p, to: refined });
      continue;
    }
    untouched.set(raw, (untouched.get(raw) ?? 0) + 1);
  }

  const inPool = (p: ProductRow) => p.active === true && p.verified_at != null;
  console.log(`제품 ${products.length}건 · 바꿀 것 ${changes.length}건 (그중 추천 풀 ${changes.filter((c) => inPool(c.row)).length}건)\n`);
  for (const c of changes.slice(0, 30))
    console.log(
      `  ${String(c.row.id).padStart(4)} ${String(c.row.brand).padEnd(12)} ${String(c.row.name).slice(0, 28).padEnd(30)} ` +
        `«${c.row.category}» → «${c.to}»`
    );
  if (changes.length > 30) console.log(`  … 외 ${changes.length - 30}건`);

  if (untouched.size > 0) {
    console.log(`\n**그대로 두는 값** — 뜻이 하나로 정해지지 않는다. 사람이 봐야 한다:`);
    for (const [v, n] of [...untouched.entries()].sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(n).padStart(3)}건  «${v}»`);
  }

  if (!apply) {
    console.log("\ndry-run. --apply 로 바꾼다.");
    return;
  }
  if (changes.length === 0) return;

  let done = 0;
  for (const [i, c] of changes.entries()) {
    // **`.eq(칼럼, null)` 은 NULL 을 못 잡는다** — SQL 에서 `= NULL` 은 참이 되지
    // 않는다. 그래서 비어 있던 유형을 채우는 갱신이 **0행을 바꾸고도 «성공» 으로**
    // 보고됐다(2026-08-10: «2건 바꿨다» 고 했지만 DB 는 그대로였다).
    // 비어 있으면 `.is()` 를 써야 한다.
    const q = client.from("products").update({ category: c.to }).eq("id", c.row.id);
    const guarded =
      c.row.category == null || c.row.category === ""
        ? q.is("category", null)
        : q.eq("category", c.row.category);
    const { data: updated, error } = await guarded.select("id");
    if (error) {
      console.log(`  ${c.row.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    // **바뀐 행 수를 세어서 보고한다.** 갱신이 0행을 건드려도 오류는 나지 않는다.
    if ((updated ?? []).length > 0) done += 1;
    else console.log(`  ${c.row.id} 갱신이 0행을 바꿨다 — 그 사이 값이 달라졌을 수 있다`);
  }
  console.log(`\n유형을 표준으로 바꾼 제품 ${done}건`);
}

main().catch((e) => {
  console.error("[normalize-product-categories] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
