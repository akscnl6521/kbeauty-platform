/**
 * 제품명에 남은 HTML 마크업을 걷어낸다.
 *
 * 크롤이 브랜드 페이지의 `<br>` 을 제품명에 그대로 담아 왔다. 그대로 공개하면
 * 사용자에게 태그가 보이거나 엉뚱한 줄바꿈이 생긴다. 제품명은 화면에 그대로
 * 나가는 값이라, 활성화 전에 정리해야 한다.
 *
 * 브랜드명·제품명을 번역하거나 바꾸지 않는다 — 태그만 없애고 공백을 정리한다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/clean-product-name-markup.ts            # 검증만
 *   ... scripts/clean-product-name-markup.ts --apply  # 실제 반영
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/** 태그는 공백으로 바꾼다 — 지워 버리면 앞뒤 낱말이 붙는다. */
function cleanName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
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
  const { data, error } = await client.from("products").select("id,name,brand,active").limit(2000);
  if (error) throw error;

  const targets = (data ?? [])
    .map((p) => ({ ...p, cleaned: cleanName(String(p.name ?? "")) }))
    .filter((p) => p.cleaned !== String(p.name ?? "") && p.cleaned.length > 0);

  console.log(`제품명 정리 대상 ${targets.length}건`);
  for (const t of targets) {
    console.log(`  ${String(t.id).padStart(3)} ${t.active ? "활성" : "비활성"}`);
    console.log(`      전: ${JSON.stringify(t.name)}`);
    console.log(`      후: ${JSON.stringify(t.cleaned)}`);
  }

  if (!apply) {
    console.log("\n검증 모드. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }
  for (const t of targets) {
    const { error: upErr } = await client.from("products").update({ name: t.cleaned }).eq("id", t.id);
    if (upErr) throw new Error(`${t.id} 갱신 실패: ${upErr.code} ${upErr.message}`);
  }
  console.log(`\n${targets.length}건 갱신 완료`);
}

main().catch((e) => {
  console.error("[clean-product-name-markup] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
