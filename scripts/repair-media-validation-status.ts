/**
 * 이미 담아 둔 이미지 중 **화면에 안 뜨는 것**을 고친다.
 *
 * ## 무엇이 문제였나
 *
 * 공개 API(`resolveVerifiedProductImageUrls`)는 `catalog_product_media` 에서
 * `validation_status = "verified"` 이고 `is_fixture = false` 인 행만 내보낸다.
 *
 * `collect-images-from-offer-page` 가 이 두 칼럼을 안 채웠다. 기본값이
 * `discovered` 라서, **DB 에는 이미지가 다 있는데 화면에는 안 뜨는** 상태가 됐다.
 * 「이미지 84/84」 라고 보고했지만 사용자가 보는 화면은 그대로였다(2026-08-08).
 *
 * ## 무엇을 «verified» 로 올리나
 *
 * 아무거나 올리지 않는다. **이 저장소가 스스로 만든 행**만 본다:
 *
 *   · `source_type` 이 `official_brand` / `official_brand_page` — 공식 페이지에서 왔고
 *   · `is_accessible = true` — 수집할 때 실제로 열리는 것을 확인했고
 *   · `image_url` 이 https 이고
 *   · **그 이미지 URL 을 다른 제품이 쓰고 있지 않다** — 공용 로고를 verified 로
 *     올리면 서로 다른 제품이 같은 그림을 달고 나온다. 그건 사진이 없는 것보다 나쁘다.
 *
 * 하나라도 어긋나면 건드리지 않는다.
 *
 * 실행: npm run repair:media-validation            # dry-run
 *       npm run repair:media-validation -- --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const OFFICIAL_SOURCES = new Set(["official_brand", "official_brand_page"]);

type MediaRow = {
  id: string;
  product_id: string | number | null;
  image_url: string | null;
  source_type: string | null;
  is_accessible: boolean | null;
  is_fixture: boolean | null;
  validation_status: string | null;
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
  const media = await fetchAll<MediaRow>(
    client,
    "catalog_product_media",
    "id,product_id,image_url,source_type,is_accessible,is_fixture,validation_status"
  );

  // 같은 이미지 URL 을 몇 제품이 쓰는지 — 공용 로고를 올리지 않기 위해.
  const productsPerUrl = new Map<string, Set<string>>();
  for (const m of media) {
    const u = String(m.image_url ?? "");
    if (!u) continue;
    const bucket = productsPerUrl.get(u) ?? new Set<string>();
    bucket.add(String(m.product_id));
    productsPerUrl.set(u, bucket);
  }

  const targets: MediaRow[] = [];
  const skipped = new Map<string, number>();
  const note = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);

  for (const m of media) {
    if (m.validation_status === "verified") continue;
    if (!OFFICIAL_SOURCES.has(String(m.source_type ?? ""))) {
      note(`출처가 공식 페이지가 아님 (${m.source_type ?? "없음"})`);
      continue;
    }
    if (m.is_accessible !== true) {
      note("열리는지 확인되지 않음 (is_accessible ≠ true)");
      continue;
    }
    const u = String(m.image_url ?? "");
    if (!/^https:\/\//i.test(u)) {
      note("이미지 URL 이 https 가 아님");
      continue;
    }
    if ((productsPerUrl.get(u)?.size ?? 0) > 1) {
      note("여러 제품이 같은 이미지를 쓴다 — 공용 로고일 수 있다");
      continue;
    }
    targets.push(m);
  }

  console.log(`미디어 ${media.length}행 · 이미 verified ${media.filter((m) => m.validation_status === "verified").length}행`);
  console.log(`verified 로 올릴 것 ${targets.length}행`);
  for (const [why, n] of [...skipped.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  올리지 않음 ${String(n).padStart(3)}행 — ${why}`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 고친다.");
    return;
  }

  let done = 0;
  for (const [i, m] of targets.entries()) {
    const { error } = await client
      .from("catalog_product_media")
      .update({ validation_status: "verified", is_fixture: false })
      .eq("id", m.id);
    if (error) {
      console.log(`  ${m.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    done += 1;
  }
  console.log(`\nverified 로 올린 행 ${done}건`);
}

main().catch((e) => {
  console.error("[repair-media-validation-status] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
