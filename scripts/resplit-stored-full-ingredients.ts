/**
 * 저장된 `full_ingredients` 를 **고쳐진 분리 규칙으로 다시 쪼갠다.**
 *
 * ## 왜 필요한가
 *
 * 옛 분리 규칙 `,(?!\s*\d+\s*[,-])` 은 `1,2-Hexanediol` 안의 쉼표를 지키려다
 * **이름 앞의 쉼표까지 막았다**(§41 에서 고침). 그래서 두 성분이 한 토큰으로 붙은
 * 채 저장됐다:
 *
 *   `Panthenol, 3-O-Ethyl Ascorbic Acid`      ← 2개가 한 덩어리
 *   `Sorbitol, 1,2-Hexanediol`                ← 2개가 한 덩어리
 *   `Pentylene Glycol, 1,2-Hexanediol`        ← 2개가 한 덩어리
 *
 * 규칙은 고쳤지만 **이미 저장된 데이터는 그대로**다. 그리고 이게 활성화를 막고 있다 —
 * 붙은 토큰은 성분 사전과 대조가 안 되어 `unmatchedIngredientCount > 0` 이 되고,
 * 게이트가 «미매칭 0» 을 요구하므로 제품이 추천 풀에 못 들어온다.
 *
 * 2026-08-04 실측: 미매칭이 1~3개뿐인 제품 8건 중 대부분이 이 한 가지 원인이었다.
 *
 * ## 재수집이 아니라 재분리다
 *
 * 페이지를 다시 긁지 않는다. **이미 가진 문자열을 다시 쪼갤 뿐**이라 데이터가
 * 늘거나 줄지 않는다 — 한 덩어리가 제 개수로 나뉠 뿐이다. 그래서 성분을
 * 잃을 위험이 없다.
 *
 * 함께 고치는 것: 괄호 뒤 공백 누락(`(Acerola)Fruit Extract`). 원문 표기 오류라
 * 공백만 넣어 사전 대조가 되게 한다. 성분명 자체는 바꾸지 않는다.
 *
 * 안전장치 — `--apply` 없이는 쓰지 않는다. 쓰기 전 현재 값을 `backups/` 에 남긴다.
 * **토큰 수가 줄어드는 변경은 절대 적용하지 않는다**(성분이 사라진다는 뜻이므로).
 *
 * 실행: npm run repair:resplit-ingredients -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { splitIngredientTokens } from "../src/lib/catalog/validateIngredientList";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

type Row = { id: number; brand: string | null; name: string | null; full_ingredients: string[] | string | null };

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 원문 표기 오류만 다듬는다 — 성분명 자체는 바꾸지 않는다.
 * `(Acerola)Fruit Extract` → `(Acerola) Fruit Extract`
 */
function fixSpacing(token: string): string {
  return token.replace(/\)(?=[A-Za-z가-힣])/g, ") ").replace(/\s{2,}/g, " ").trim();
}

async function fetchAll(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,brand,name,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`products: ${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
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
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAll(client);

  const changes: Array<{ row: Row; before: string[]; after: string[] }> = [];
  for (const r of rows) {
    const before = Array.isArray(r.full_ingredients) ? r.full_ingredients.map(String) : [];
    if (before.length === 0) continue;

    // 각 원소를 다시 쪼갠다. 이미 제대로 쪼개진 것은 그대로 하나로 남는다.
    const after: string[] = [];
    for (const el of before) for (const t of splitIngredientTokens(el)) {
      const f = fixSpacing(t);
      if (f) after.push(f);
    }

    if (after.length === before.length && after.every((v, i) => v === before[i])) continue;
    // 줄어드는 변경은 성분이 사라진다는 뜻이다 — 적용하지 않는다.
    if (after.length < before.length) {
      console.log(`  !! ${r.id} 토큰이 ${before.length} → ${after.length} 로 줄어 건너뛴다`);
      continue;
    }
    changes.push({ row: r, before, after });
  }

  console.log(`전성분 보유 ${rows.filter((r) => Array.isArray(r.full_ingredients) && r.full_ingredients.length > 0).length}행`);
  console.log(`재분리 대상 ${changes.length}행\n`);
  for (const c of changes) {
    console.log(
      `  ${String(c.row.id).padStart(4)} ${String(c.row.brand).padEnd(17)} ` +
        `${String(c.row.name).slice(0, 30).padEnd(32)} ${c.before.length} → ${c.after.length}개`
    );
    // 무엇이 나뉘었는지 한 줄만 보여준다 — 눈으로 확인할 수 있게.
    const split = c.before.find((b) => splitIngredientTokens(b).length > 1);
    if (split) console.log(`         예: «${split.slice(0, 60)}» → ${splitIngredientTokens(split).length}개`);
  }

  if (!apply) {
    console.log("\ndry-run. --apply 로 반영한다.");
    return;
  }
  if (changes.length === 0) return;

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_full-ingredients-재분리전.sql`;
  const arr = (xs: string[]) =>
    `'{${xs.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}'`;
  writeFileSync(
    path,
    [
      `-- full_ingredients 재분리 전 스냅샷 · ${changes.length}행`,
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...changes.map((c) => `UPDATE products SET full_ingredients = ${arr(c.before)} WHERE id = ${c.row.id};`),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let updated = 0;
  for (const [i, c] of changes.entries()) {
    const { data, error } = await client
      .from("products")
      .update({ full_ingredients: c.after })
      .eq("id", c.row.id)
      .select("id");
    if (error) {
      console.log(`  ${c.row.id} 실패: ${error.code} ${error.message}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    if ((data ?? []).length > 0) updated += 1;
  }
  console.log(`\n재분리 ${updated}행`);
}

main().catch((e) => {
  console.error("[resplit-stored-full-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
