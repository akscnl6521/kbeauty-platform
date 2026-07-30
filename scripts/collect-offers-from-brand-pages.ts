/**
 * 검증 오퍼가 없는 제품에 대해, **경로가 확인된 브랜드 자사몰**에서 오퍼를
 * 다시 수집한다.
 *
 * §30-29 에서 병목이 사전이 아니라 오퍼로 옮겨간 것을 확인했고,
 * `survey-cafe24-brand-stores.ts` 로 어느 자사몰이 실제로 가격·재고를
 * 내주는지 실측했다. 여기서는 그 목록에 있는 도메인만 대상으로 한다 —
 * 통하지 않는 곳을 긁어 봐야 비활성 제품만 늘어난다.
 *
 * 수집·게이트 로직은 기존 것을 그대로 쓴다(`discoverAndPersistOffers`).
 * 가격·재고를 만들어내지 않고 페이지가 노출한 것만 저장한다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/collect-offers-from-brand-pages.ts            # 검증만
 *   ... scripts/collect-offers-from-brand-pages.ts --apply  # 실제 저장
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 가격과 재고 신호가 실제로 확인된 자사몰만 넣는다
 * (`artifacts/cafe24-brand-survey/survey.json` 근거).
 *
 * miseenscene.com 은 Cafe24 이고 신호도 읽히지만 **가격이 100원 자리표시**라
 * 뺀다 — §30-12 에서 확인했고 게이트도 막는다. 긁어 봐야 needs_review 만 는다.
 */
const VERIFIED_PATH_HOSTS = new Set([
  "lador.co.kr",
  "sulwhasoo.com",
  "isntree.com",
  "beautyofjoseon.co.kr",
  "numbuzin.com",
  "roundlab.co.kr",
]);

const UA = "Mozilla/5.0 (compatible; kbm-sourcing)";

function hostOf(url: string | null): string | null {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Cafe24 목록 링크의 `/category/<n>/display/<n>/` 꼬리를 떼고 정규 형태로 만든다.
 * 그 꼬리가 붙어 있으면 `looksLikeProductUrl` 이 목록 페이지로 보고 거부한다(§30-17).
 */
function canonicalProductUrl(url: string): string {
  return url.replace(/(\/product\/[^/]+\/\d+\/)category\/\d+\/display\/\d+\/?$/i, "$1");
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
  const { discoverAndPersistOffers } = await import("../src/lib/pipeline/offers/offer-persist");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = "brand-offer-collect-2026-07-27";

  const products = await fetchAll<{ id: number; name: string | null; brand: string | null; active: boolean }>(
    client,
    "products",
    "id,name,brand,active"
  );
  const offers = await fetchAll<{
    product_id: number;
    purchase_url: string | null;
    verification_status: string;
    stock_status: string;
  }>(client, "product_offers", "id,product_id,purchase_url,verification_status,stock_status");
  const candidates = await fetchAll<{ linked_product_id: number | null; discovered_url: string | null }>(
    client,
    "product_discovery_candidates",
    "id,linked_product_id,discovered_url"
  );

  const targets: Array<{ id: number; label: string; url: string; host: string }> = [];
  for (const p of products) {
    const hasVerified = offers.some(
      (o) => o.product_id === p.id && o.verification_status === "verified" && o.stock_status === "in_stock"
    );
    if (hasVerified) continue;

    const urls = [
      ...offers.filter((o) => o.product_id === p.id).map((o) => o.purchase_url),
      ...candidates.filter((c) => c.linked_product_id === p.id).map((c) => c.discovered_url),
    ].filter((u): u is string => Boolean(u));

    const pick = urls.find((u) => {
      const h = hostOf(u);
      return h != null && VERIFIED_PATH_HOSTS.has(h);
    });
    if (!pick) continue;

    targets.push({
      id: p.id,
      label: `${p.brand ?? ""} ${p.name ?? ""}`.trim(),
      url: canonicalProductUrl(pick),
      host: hostOf(pick)!,
    });
  }

  console.log(`검증 오퍼 없는 제품 중, 경로가 확인된 자사몰에 연결된 것: ${targets.length}건\n`);
  for (const t of targets) console.log(`  ${String(t.id).padStart(3)} ${t.host.padEnd(22)}${t.label.slice(0, 40)}`);

  if (!apply) {
    console.log("\n검증 모드. 실제 수집하려면 --apply 를 붙인다.");
    return;
  }

  let verified = 0;
  let inserted = 0;
  console.log();
  for (const t of targets) {
    let html = "";
    try {
      const res = await fetch(t.url, { redirect: "follow", headers: { "user-agent": UA } });
      html = res.ok ? await res.text() : "";
      if (!html) {
        console.log(`  ${String(t.id).padStart(3)} 건너뜀: 페이지 HTTP ${res.status}`);
        continue;
      }
    } catch (e) {
      console.log(`  ${String(t.id).padStart(3)} 건너뜀: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const p = products.find((x) => x.id === t.id)!;
    const out = await discoverAndPersistOffers(client, {
      productId: t.id,
      productName: p.name ?? "",
      brandName: p.brand ?? "",
      productActive: Boolean(p.active),
      pageHtml: html,
      pageUrl: t.url,
      officialHost: t.host,
      batchId,
    });
    verified += out.verified;
    inserted += out.inserted;
    console.log(
      `  ${String(t.id).padStart(3)} ${t.label.slice(0, 34).padEnd(36)}` +
        `신규 ${out.inserted} · 갱신 ${out.updated} · 검증 ${out.verified} · 건너뜀 ${out.skipped}` +
        (out.reasons?.length ? `  (${[...new Set(out.reasons)].join(", ")})` : "")
    );
  }
  console.log(`\n합계: 신규 오퍼 ${inserted}건 · 검증 ${verified}건`);
}

main().catch((e) => {
  console.error("[collect-offers-from-brand-pages] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
