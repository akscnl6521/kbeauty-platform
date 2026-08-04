/**
 * Production 에 저장된 **오염된 전성분을 정제된 값으로 교체**한다.
 *
 * 감사(`audit-production-full-ingredients`) 결과 활성 제품 17건의
 * `products.full_ingredients` 에 페이지 문구가 섞여 있었다:
 *
 *   168 Round Lab  … "email-only", "text-only offers", "first dibs on new products. COMPANY About Us"
 *    21 COSRX      … "including fine lines", "loss of elasticity", "and"
 *     1 COSRX      전체가 자바스크립트 배열 — "works", "skin", "looks", "bottle" …
 *
 * ## 위험도가 두 가지로 갈린다
 *
 *   (가) **실제 성분은 다 있고 뒤에 문구가 붙은 것** — 알레르겐 검출 자체는 정상
 *        작동한다(없는 성분이 생긴 게 아니라 없는 문구가 붙은 것이라, 오검출은
 *        «안전한 쪽»으로만 틀린다). 사용자에게 성분표가 지저분하게 보이는 문제다.
 *   (나) **실제 성분이 아예 없는 것**(id 1) — 알레르겐 검사가 훑을 성분이 없으므로
 *        «알레르겐 없음 = 안전» 이라는 **잘못된 판정**이 나온다. 이쪽이 진짜 위험이다.
 *
 * ## 왜 그냥 비우지 않는가
 *
 * `full_ingredients` 를 NULL 로 만들면 안전 필터가 `key_ingredients` 만 보게 되는데,
 * 그건 기능성 성분 사전으로 고른 부분집합이라 향료·리모넨·리날룰이 구조적으로
 * 빠진다 — 2026-07-27 에 고친 바로 그 결함으로 되돌아간다. 비우는 건 해법이 아니다.
 * **정제된 값으로 교체하거나, 교체가 안 되면 비활성화해야 한다.**
 *
 * 이 스크립트는 교체만 한다. 교체 불가 건은 목록으로 남겨 사람이 판단하게 한다.
 *
 * 안전장치
 *   · `--apply` 없이는 아무것도 쓰지 않는다.
 *   · 쓰기 전에 현재 값을 `backups/` 에 SQL 로 남긴다.
 *   · 새 값이 검증을 통과할 때만 교체한다. 통과 못 하면 **기존 값을 그대로 둔다** —
 *     비우면 위 이유로 더 위험하다.
 *
 * 실행: npm run repair:full-ingredients -- --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import {
  sanitizeIngredientList,
  validateIngredientList,
} from "../src/lib/catalog/validateIngredientList";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0; +https://www.kbeautymatch.com)";

type Row = {
  id: number;
  name: string | null;
  brand: string | null;
  active: boolean | null;
  full_ingredients: string[] | string | null;
};

function asText(v: Row["full_ingredients"]): string {
  if (Array.isArray(v)) return v.join(", ");
  return String(v ?? "");
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** PostgREST 는 1000행에서 자른다. 페이지로 넘긴다. */
async function fetchAll(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,name,brand,active,full_ingredients")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`products: ${error.code} ${error.message}`);
    const page = (data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function getText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
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

  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const client = createClient(url, key, { auth: { persistSession: false } });

  const rows = await fetchAll(client);
  const contaminated = rows.filter((r) => {
    const t = asText(r.full_ingredients).trim();
    return t.length > 0 && !validateIngredientList(t).ok;
  });
  console.log(`오염된 전성분 ${contaminated.length}행 (활성 ${contaminated.filter((r) => r.active).length}행)\n`);

  // 판매 페이지 URL 을 오퍼에서 가져온다 — 브랜드 공식몰 오퍼가 원 출처다.
  const ids = contaminated.map((r) => r.id);
  const { data: offers, error: oErr } = await client
    .from("product_offers")
    .select("product_id,purchase_url,source")
    .in("product_id", ids);
  if (oErr) throw new Error(`product_offers: ${oErr.code} ${oErr.message}`);
  const urlByProduct = new Map<number, string>();
  for (const o of (offers ?? []) as Array<{ product_id: number; purchase_url: string | null; source: string | null }>) {
    // 브랜드 공식몰을 우선한다. 네이버 쇼핑 링크에는 전성분이 없다.
    const isOfficial = String(o.source ?? "").includes("brand_official");
    if (!o.purchase_url) continue;
    if (isOfficial || !urlByProduct.has(o.product_id)) urlByProduct.set(o.product_id, o.purchase_url);
  }

  const repairs: Array<{ row: Row; before: string[]; after: string[]; note: string }> = [];
  const unrepairable: Array<{ row: Row; why: string }> = [];

  for (const r of contaminated) {
    const src = urlByProduct.get(r.id);
    if (!src) {
      unrepairable.push({ row: r, why: "재수집할 공식 판매 페이지 URL 없음" });
      continue;
    }
    const raw = extractLabeledIngredientsRaw(await getText(src));
    if (!raw) {
      unrepairable.push({ row: r, why: "페이지에서 전성분 구간을 못 찾음" });
      continue;
    }
    const v = sanitizeIngredientList(raw.raw);
    if (!v.ok) {
      unrepairable.push({ row: r, why: `정제 후에도 반려 — ${v.reason}${v.sample ? ` (${v.sample.slice(0, 40)})` : ""}` });
      continue;
    }
    const before = Array.isArray(r.full_ingredients) ? r.full_ingredients.map(String) : [asText(r.full_ingredients)];
    repairs.push({
      row: r,
      before,
      after: v.tokens,
      note: `${before.length} → ${v.tokens.length}개${v.cutAtMarker ? " (꼬리 절단)" : ""}`,
    });
  }

  console.log(`교체 가능 ${repairs.length}행 · 교체 불가 ${unrepairable.length}행\n`);
  console.log("── 교체 가능 ──");
  for (const r of repairs)
    console.log(
      `  ${String(r.row.id).padStart(4)} ${String(r.row.brand).padEnd(16)} ${String(r.row.name).slice(0, 32).padEnd(34)} ${r.note}`
    );
  console.log("\n── 교체 불가 (사람 판단 필요) ──");
  for (const u of unrepairable)
    console.log(
      `  ${String(u.row.id).padStart(4)} ${String(u.row.brand).padEnd(16)} ${String(u.row.name).slice(0, 32).padEnd(34)} ${u.why}`
    );

  if (!apply) {
    console.log("\ndry-run. --apply 를 붙이면 실제로 교체한다.");
    return;
  }
  if (repairs.length === 0) return;

  // 백업 — 현재 값을 복원 가능한 형태로 남긴다.
  mkdirSync("backups", { recursive: true });
  const path = `backups/production_${stamp()}_full-ingredients-정제전.sql`;
  const arr = (xs: string[]) => `'{${xs.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}'`;
  writeFileSync(
    path,
    [
      `-- full_ingredients 정제 전 스냅샷 · ${repairs.length}행`,
      `-- 생성: ${new Date().toISOString()}`,
      "",
      ...repairs.map((r) => `UPDATE products SET full_ingredients = ${arr(r.before)} WHERE id = ${r.row.id};`),
      "",
    ].join("\n"),
    "utf8"
  );
  console.log(`\n백업: ${path}`);

  let updated = 0;
  for (const [i, r] of repairs.entries()) {
    const { data, error } = await client
      .from("products")
      .update({ full_ingredients: r.after })
      .eq("id", r.row.id)
      .select("id");
    if (error) {
      console.log(`  ${r.row.id} 실패: ${error.code} ${error.message}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    if ((data ?? []).length > 0) updated += 1;
  }
  console.log(`\n교체 ${updated}행`);
  console.log("검증: npm run check:production-full-ingredients");
}

main().catch((e) => {
  console.error("[repair-contaminated-full-ingredients] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
