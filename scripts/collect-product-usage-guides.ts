/**
 * Collect §36.5 usage guidance from official brand product pages.
 *
 * Source rule: only offers already marked `is_official` in the catalog, i.e. the
 * brand's own storefront. No search, no third-party blogs, no marketplaces.
 *
 * Politeness: one page per product, sequential, with a delay between requests.
 * A 403/429 is taken at face value and the product is skipped — bot blocks are
 * not worked around, per the project's crawling policy.
 *
 * Reads the catalog, writes a JSON snapshot. Writes nothing to the database and
 * approves nothing.
 *
 *   npm run usage:collect-guides
 *   npm run usage:collect-guides -- --limit 10
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  detectGuidanceLocale,
  extractUsageGuidance,
  hasUsableGuidance,
  htmlToVisibleText,
  looksMojibake,
  productSpecificCautions,
} from "../src/lib/catalog/enrichment/extractUsageGuidance";

const root = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "KBeautyMatchBot/1.0 (+https://www.kbeautymatch.com; usage-guide-research)";
const DELAY_MS = 1500;
const TIMEOUT_MS = 15000;

function loadEnvFile(name: string): Record<string, string> {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decode with the charset the page actually declares.
 *
 * Several Korean brand storefronts still serve EUC-KR. Assuming UTF-8 turns the
 * whole page into replacement characters, and mojibake that reaches the database
 * is worse than a missing row.
 */
function decodeBody(buffer: ArrayBuffer, contentTypeHeader: string): string {
  const headerCharset = /charset=["']?([\w-]+)/i.exec(contentTypeHeader)?.[1];

  // The meta tag lives in ASCII-safe bytes, so a latin1 peek is enough to read it.
  const peek = Buffer.from(buffer.slice(0, 4096)).toString("latin1");
  const metaCharset =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(peek)?.[1] ??
    /content=["'][^"']*charset=([\w-]+)/i.exec(peek)?.[1];

  const candidates = [headerCharset, metaCharset, "utf-8"].filter(
    (value): value is string => Boolean(value)
  );

  for (const charset of candidates) {
    try {
      const decoded = new TextDecoder(charset.toLowerCase(), {
        fatal: false,
      }).decode(buffer);
      if (!looksMojibake(decoded)) return decoded;
    } catch {
      // unknown label — try the next candidate
    }
  }
  return new TextDecoder("utf-8").decode(buffer);
}

/** Korean brand sites carry the Korean usage block; prefer them. */
function urlPriority(url: string): number {
  try {
    const host = new URL(url).hostname;
    if (/\.co\.kr$|\.kr$/.test(host)) return 0;
    if (/^(www\.)?(numbuzin|sulwhasoo|laneige|lador|miseenscene|roundlab|isntree|anua|banila|beautyofjoseon)\./.test(host)) {
      return 1;
    }
    return 2;
  } catch {
    return 9;
  }
}

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    console.error("[collect-usage-guides] Staging URL / service role key missing");
    process.exit(1);
  }
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
  if (ref === PROD_REF) {
    console.error("[collect-usage-guides] refusing to read Production");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: products, error: productError } = await admin
    .from("products")
    .select("id, name, brand, category")
    .limit(500);
  if (productError) {
    console.error(`[collect-usage-guides] products: ${productError.message}`);
    process.exit(1);
  }

  const { data: offers, error: offerError } = await admin
    .from("product_offers")
    .select("product_id, purchase_url, is_official, active")
    .eq("is_official", true)
    .limit(1000);
  if (offerError) {
    console.error(`[collect-usage-guides] offers: ${offerError.message}`);
    process.exit(1);
  }

  const officialByProduct = new Map<number, string>();
  for (const offer of offers ?? []) {
    if (offer.active === false) continue;
    const productId = Number(offer.product_id);
    const candidate = String(offer.purchase_url ?? "");
    if (!candidate.startsWith("https://")) continue;
    const current = officialByProduct.get(productId);
    if (!current || urlPriority(candidate) < urlPriority(current)) {
      officialByProduct.set(productId, candidate);
    }
  }

  const productById = new Map(
    (products ?? []).map((p) => [Number(p.id), p as Record<string, unknown>])
  );

  const limitArg = argValue("--limit");
  const limit = limitArg ? Number(limitArg) : Number.POSITIVE_INFINITY;

  const targets = [...officialByProduct.entries()]
    .filter(([productId]) => productById.has(productId))
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  console.log(
    `[collect-usage-guides] ${targets.length} products with an official brand page`
  );

  const candidates: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  let usable = 0;

  for (const [productId, pageUrl] of targets) {
    const product = productById.get(productId)!;
    const label = `${String(product.brand ?? "")} ${String(product.name ?? "")}`.trim();
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");

    let html = "";
    let status = 0;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(pageUrl, {
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ko,en;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = res.status;
      if (res.ok) {
        html = decodeBody(
          await res.arrayBuffer(),
          res.headers.get("content-type") ?? ""
        );
      }
    } catch (error) {
      failures.push({
        productId,
        label,
        host,
        reason: "fetch_error",
        detail: String((error as Error)?.message ?? error).slice(0, 120),
      });
      console.log(`  ${label.slice(0, 34).padEnd(34)} fetch error`);
      await sleep(DELAY_MS);
      continue;
    }

    if (!html) {
      const reason =
        status === 403 || status === 429 ? "blocked_or_throttled" : `http_${status}`;
      failures.push({ productId, label, host, reason, httpStatus: status });
      console.log(`  ${label.slice(0, 34).padEnd(34)} ${reason}`);
      await sleep(DELAY_MS);
      continue;
    }

    const text = htmlToVisibleText(html);
    if (looksMojibake(text)) {
      failures.push({
        productId,
        label,
        host,
        reason: "charset_undecodable",
        httpStatus: status,
      });
      console.log(`  ${label.slice(0, 34).padEnd(34)} charset undecodable — skipped`);
      await sleep(DELAY_MS);
      continue;
    }

    const guidance = extractUsageGuidance(text);
    const ok = hasUsableGuidance(guidance);
    if (ok) usable += 1;

    candidates.push({
      productId,
      productName: product.name ?? null,
      brand: product.brand ?? null,
      category: product.category ?? null,
      locale: detectGuidanceLocale(guidance.methodSteps),
      sourceType: "official_brand",
      sourceUrl: pageUrl,
      sourceDomain: host,
      extractionMethod: "automated_extraction",
      contentHash: createHash("sha256").update(text).digest("hex").slice(0, 32),
      amountLabel: guidance.amountLabel,
      methodSteps: guidance.methodSteps,
      applicationArea: guidance.applicationArea,
      orderHints: guidance.orderHints,
      frequency: guidance.frequency,
      cautionText: productSpecificCautions(guidance),
      statutoryNotices: guidance.cautions
        .filter((caution) => caution.kind === "statutory")
        .map((caution) => caution.text),
      sourceExcerpt: guidance.sourceExcerpt,
      missingFields: guidance.missingFields,
      usable: ok,
    });

    console.log(
      `  ${label.slice(0, 34).padEnd(34)} ${ok ? "guidance" : "no usage section"}` +
        `${guidance.amountLabel ? ` · ${guidance.amountLabel}` : ""}`
    );

    await sleep(DELAY_MS);
  }

  const day = new Date().toISOString().slice(0, 10);
  const outDir = path.join(root, "data", "usage-guides", day);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "candidates.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policy:
          "Official brand product pages only (product_offers.is_official). Extraction only — every field is present in the source or null. Nothing approved; each row needs human review.",
        totals: {
          productsWithOfficialPage: targets.length,
          fetched: candidates.length,
          withUsageGuidance: usable,
          withoutUsageSection: candidates.length - usable,
          fetchFailures: failures.length,
        },
        candidates,
        failures,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log("");
  console.log(`[collect-usage-guides] fetched ${candidates.length} official pages`);
  console.log(`[collect-usage-guides] usage guidance found: ${usable}`);
  console.log(
    `[collect-usage-guides] no usage section: ${candidates.length - usable} · fetch failures: ${failures.length}`
  );
  console.log(`[collect-usage-guides] report: data/usage-guides/${day}/candidates.json`);
}

main().catch((error) => {
  console.error("[collect-usage-guides] failed:", error);
  process.exit(1);
});
