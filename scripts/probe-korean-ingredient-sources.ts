/**
 * **국내 소스에서 전성분을 가져올 수 있는지** 조사한다. 읽기 전용 · 쓰기 없음.
 *
 * ## 왜 이 조사인가
 *
 * §39 에서 영문 글로벌 스토어 경로가 소진된 것을 확인했다 — 대조 실패 76건 중 49건이
 * «스토어가 그 제품을 안 판다» 였다. 국내 전용 제품이 미국 스토어에 없는 게 당연하다.
 *
 * 남은 경로는 **국내 소스**다. 이미 검증된 부품이 둘 있다:
 *   · `koreanProductTerms.ts` — 한글 음역 대응 (네이버 오퍼 수집에서 실증됨)
 *   · 추출기의 `전성분` 라벨 인식 (한글 라벨을 이미 본다)
 *
 * 조사할 것은 하나다: **국내 페이지를 정적으로 받아서 전성분이 나오는가.**
 * 올리브영·쿠팡 같은 곳은 본문을 자바스크립트로 그리므로 정적 fetch 로는 못 읽을 수 있다.
 * 그걸 먼저 확인해야 «국내 경로가 있다/없다» 를 말할 수 있다. 추측으로 결론 내지 않는다.
 *
 * 대상은 **이미 DB 에 있는 오퍼 URL** 이다 — 새로 크롤링하지 않고, 가진 링크가
 * 전성분 소스로 쓸 수 있는지만 본다.
 *
 * 실행: npx tsx scripts/probe-korean-ingredient-sources.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { sanitizeIngredientList } from "../src/lib/catalog/validateIngredientList";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type Offer = {
  product_id: number;
  purchase_url: string | null;
  retailer_name: string | null;
  source: string | null;
};

async function fetchAllOffers(client: SupabaseClient): Promise<Offer[]> {
  const out: Offer[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("product_offers")
      .select("product_id,purchase_url,retailer_name,source")
      .order("product_id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${error.code} ${error.message}`);
    const page = (data ?? []) as Offer[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function get(url: string): Promise<{ status: number; body: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { status: r.status, body: r.ok ? await r.text() : "" };
  } catch {
    return { status: 0, body: "" };
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "(파싱 실패)";
  }
}

async function main() {
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key =
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PRODUCTION_SUPABASE_ANON_KEY ?? "";
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

  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const client = createClient(url, key, { auth: { persistSession: false } });
  const offers = (await fetchAllOffers(client)).filter((o) => o.purchase_url);

  // 호스트별로 한 건씩만 시험한다 — «이 사이트가 정적 fetch 로 전성분을 주는가» 만
  // 알면 되고, 같은 사이트를 여러 번 두드릴 이유가 없다.
  const byHost = new Map<string, Offer[]>();
  for (const o of offers) {
    const h = hostOf(o.purchase_url!);
    byHost.set(h, [...(byHost.get(h) ?? []), o]);
  }

  console.log(`오퍼 ${offers.length}건 · 호스트 ${byHost.size}곳\n`);
  console.log(`${"호스트".padEnd(28)}${"오퍼".padStart(5)}  ${"응답".padStart(5)}  ${"전성분 라벨".padStart(12)}  판정`);

  const report: Array<{
    host: string;
    offerCount: number;
    status: number;
    bytes: number;
    label: string | null;
    verdict: string;
  }> = [];

  for (const [host, list] of [...byHost.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = list[0];
    const res = await get(sample.purchase_url!);
    const raw = res.body ? extractLabeledIngredientsRaw(res.body) : null;
    const v = raw ? sanitizeIngredientList(raw.raw) : null;

    const verdict =
      res.status === 0
        ? "연결 실패·차단"
        : res.status !== 200
          ? `HTTP ${res.status}`
          : !raw
            ? "전성분 라벨 없음 (본문을 JS 로 그리는 듯)"
            : v?.ok
              ? `**쓸 수 있다** — 성분 ${v.tokens.length}개`
              : `라벨은 있으나 반려 — ${v?.ok === false ? v.reason : "?"}`;

    console.log(
      `${host.padEnd(28)}${String(list.length).padStart(5)}  ${String(res.status).padStart(5)}  ` +
        `${(raw?.label ?? "-").padStart(12)}  ${verdict}`
    );
    report.push({
      host,
      offerCount: list.length,
      status: res.status,
      bytes: res.body.length,
      label: raw?.label ?? null,
      verdict,
    });
    await new Promise((r) => setTimeout(r, 900));
  }

  const usable = report.filter((r) => r.verdict.startsWith("**쓸 수 있다"));
  console.log(`\n전성분 소스로 쓸 수 있는 호스트 ${usable.length}곳 / ${report.length}곳`);
  if (usable.length > 0) {
    const reach = usable.reduce((s, r) => s + r.offerCount, 0);
    console.log(`  해당 호스트가 가진 오퍼 ${reach}건 — 여기서 전성분을 뽑을 수 있다`);
  }

  mkdirSync("artifacts/korean-source-probe", { recursive: true });
  const path = "artifacts/korean-source-probe/host-capability.json";
  writeFileSync(path, JSON.stringify({ checkedAt: new Date().toISOString(), report }, null, 2), "utf8");
  console.log(`\n결과 저장: ${path}`);
}

main().catch((e) => {
  console.error("[probe-korean-ingredient-sources] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
