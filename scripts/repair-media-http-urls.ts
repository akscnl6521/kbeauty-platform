/**
 * `http://` 로 저장된 제품 이미지를 **https 로 올린다.**
 *
 * ## 왜 안 보였나
 *
 * 사이트는 https 로 열린다. 그 안에서 `http://` 이미지를 부르면 브라우저가
 * **혼합 콘텐츠(mixed content)** 로 보고 차단한다. 즉 DB 에도 있고 API 도 내보내는데
 * 화면에는 아무것도 안 뜬다. 2026-08-08 실측에서 COSRX 8건이 이 상태였다.
 *
 * 몰이 http 링크를 내줬다고 해서 https 가 없는 것은 아니다 — 같은 경로가 https
 * 로도 열리는 경우가 대부분이다.
 *
 * ## 지어내지 않는다
 *
 * 주소만 바꿔 놓고 «되겠지» 하지 않는다. **https 로 실제로 받아 보고**
 * HTTP 200 + `image/*` 인 것만 바꾼다. 안 열리면 그대로 둔다 — 깨진 주소로
 * 바꾸면 지금보다 나빠진다.
 *
 * 실행: npm run repair:media-http-urls            # dry-run
 *       npm run repair:media-http-urls -- --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA = "Mozilla/5.0 (compatible; KBeautyMatchCatalog/1.0)";
const TIMEOUT_MS = 15_000;

type MediaRow = { id: string; product_id: string | number | null; image_url: string | null; canonical_image_url: string | null };

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function servesImage(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: ctl.signal });
    clearTimeout(timer);
    return r.ok && /^image\//i.test(r.headers.get("content-type") ?? "");
  } catch {
    return false;
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
    "id,product_id,image_url,canonical_image_url"
  );
  const http = media.filter((m) => /^http:\/\//i.test(String(m.image_url ?? "")));
  console.log(`미디어 ${media.length}행 · http:// 인 것 ${http.length}행\n`);

  const fixable: Array<{ row: MediaRow; https: string }> = [];
  for (const m of http) {
    const https = String(m.image_url).replace(/^http:\/\//i, "https://");
    if (await servesImage(https)) {
      fixable.push({ row: m, https });
      console.log(`  ✔ 제품 ${String(m.product_id).padStart(4)} https 로 열린다`);
    } else {
      console.log(`  ✗ 제품 ${String(m.product_id).padStart(4)} https 로는 안 열린다 — 그대로 둔다`);
    }
  }

  console.log(`\nhttps 로 바꿀 것 ${fixable.length}행`);
  if (!apply) {
    console.log("\ndry-run. --apply 로 고친다.");
    return;
  }

  let done = 0;
  for (const [i, f] of fixable.entries()) {
    const patch: Record<string, string> = { image_url: f.https };
    // `canonical_image_url` 도 같은 주소면 함께 올린다. 다르면 건드리지 않는다.
    if (String(f.row.canonical_image_url ?? "") === String(f.row.image_url ?? "")) {
      patch.canonical_image_url = f.https;
    }
    // 바뀐 행을 돌려받아 센다 — 갱신이 0행을 건드려도 오류는 나지 않는다.
    const { data: updated, error } = await client
      .from("catalog_product_media")
      .update(patch)
      .eq("id", f.row.id)
      .select("id");
    if (error) {
      console.log(`  ${f.row.id} 실패: ${error.code} ${error.message.slice(0, 70)}`);
      if (i === 0) {
        console.log("  첫 건에서 실패 — 중간 상태를 남기지 않기 위해 중단한다.");
        break;
      }
      continue;
    }
    if ((updated ?? []).length > 0) done += 1;
    else console.log(`  ${f.row.id} 갱신이 0행을 바꿨다`);
  }
  console.log(`\nhttps 로 바꾼 행 ${done}건`);
}

main().catch((e) => {
  console.error("[repair-media-http-urls] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
