/**
 * Production `full_ingredients` 중 **성분처럼 보이지 않는 것만** 골라 되돌린다.
 *
 * 추출기를 고쳤는데도 일부 페이지에서 여전히 문구가 섞여 들어왔다
 * (예: `"works","skin","looks"` · `improves hydration, firmness ...`).
 * 깨끗한 것은 남기고 오염된 것만 지운다.
 *
 * 판정 (하나라도 걸리면 오염):
 *   · 첫 토큰이 용매(water/aqua/정제수/glycerin…)가 아니다
 *   · 따옴표로 감싸인 토큰이 있다 — 정상 INCI 에는 없다
 *   · 문장형 토큰(동사·소유격·6단어 초과)이 15% 를 넘는다
 *
 * 되돌리기 전에 현재 값을 파일로 남긴다.
 *
 * 실행: npm run audit:bad-ingredients -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

const VEHICLE =
  /^(?:"?\s*)?(?:aqua|water|정제수|glycerin|글리세린|butylene\s*glycol|부틸렌글라이콜|propanediol|dipropylene|alcohol|ethanol|변성알코올)/i;

const SENTENCE_LIKE =
  /\b(?:works|looks|feels|helps?|improves?|provides?|your|our|the|is|are|and\s+get|need)\b|[!?]/i;

function isContaminated(tokens: string[]): { bad: boolean; why: string } {
  if (tokens.length === 0) return { bad: false, why: "" };
  if (!VEHICLE.test(String(tokens[0]))) return { bad: true, why: `첫 토큰이 용매가 아님: "${tokens[0]}"` };
  const quoted = tokens.filter((t) => /^["'].*["']$/.test(String(t).trim())).length;
  if (quoted > 0) return { bad: true, why: `따옴표 토큰 ${quoted}개` };
  const sentence = tokens.filter(
    (t) => SENTENCE_LIKE.test(String(t)) || String(t).split(/\s+/).filter(Boolean).length > 6
  ).length;
  const ratio = sentence / tokens.length;
  if (ratio > 0.15) return { bad: true, why: `문장형 토큰 ${sentence}/${tokens.length}` };
  return { bad: false, why: "" };
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("자격증명 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client
    .from("products")
    .select("id,name,full_ingredients")
    .not("full_ingredients", "is", null);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: number; name: string; full_ingredients: string[] }>;
  const bad: typeof rows = [];
  const good: typeof rows = [];
  for (const r of rows) {
    const t = Array.isArray(r.full_ingredients) ? r.full_ingredients : [];
    if (t.length === 0) continue;
    const v = isContaminated(t.map(String));
    if (v.bad) {
      bad.push(r);
      console.log(`  오염 ${String(r.id).padStart(4)} ${String(r.name).slice(0, 32).padEnd(34)} ${v.why}`);
    } else {
      good.push(r);
    }
  }
  console.log(`\n전성분 보유 ${rows.length}건 · 정상 ${good.length} · 오염 ${bad.length}`);
  console.log("정상 유지:");
  for (const r of good) console.log(`  ${String(r.id).padStart(4)} ${String(r.name).slice(0, 34).padEnd(36)} ${r.full_ingredients.length}개`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 오염분만 되돌린다.");
    return;
  }
  if (bad.length === 0) return;

  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_full-ingredients-오염-되돌리기전.sql`;
  writeFileSync(
    path,
    [
      "-- 오염 판정된 full_ingredients 되돌리기 전 스냅샷",
      `-- 생성: ${new Date().toISOString()} · ${bad.length}건`,
      "",
      ...bad.map(
        (r) =>
          `UPDATE products SET full_ingredients = '{${r.full_ingredients
            .map((x) => `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
            .join(",")}}' WHERE id = ${r.id};`
      ),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let reverted = 0;
  for (const r of bad) {
    const { data: d, error: e } = await client
      .from("products")
      .update({ full_ingredients: null })
      .eq("id", r.id)
      .select("id");
    if (e) {
      console.log(`  ${r.id} 실패: ${e.message}`);
      continue;
    }
    if ((d ?? []).length > 0) reverted += 1;
  }
  console.log(`\n되돌림 ${reverted}건 · 정상 ${good.length}건 유지`);
}

main().catch((e) => {
  console.error("[audit-and-revert-bad-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
