/**
 * Repair catalog product names that failed to decode (EUC-KR read as UTF-8).
 *
 * §17 official-source rule: the replacement name is re-fetched from the brand's
 * own product page — the same URL already recorded as an official offer. Nothing
 * is reconstructed from the corrupted string, because that information is gone.
 *
 * Guard against fixing the wrong product: the corrupted name and the fetched name
 * must share an identical ASCII skeleton (brand, digits, units, pack markers like
 * "1+1"). Mojibake only destroys the multi-byte Korean, so the ASCII survives — if
 * those skeletons differ, the page is not this product and the row is skipped.
 * That rule lives in src/lib/catalog/enrichment/productNameRepair.ts and is
 * covered by scripts/product-name-repair-selftest.ts.
 *
 * Writes an audit row to product_change_history (change_type='name') with the old
 * and new value BEFORE touching products, plus a JSON backup on disk.
 *
 *   npm run catalog:repair-names            # dry run
 *   npm run catalog:repair-names -- --write # apply to Staging
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  extractProductNameFromHtml,
  isMojibakeName,
  looksMojibake,
  validateNameReplacement,
} from "../src/lib/catalog/enrichment/productNameRepair";

const root = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const WRITE = process.argv.includes("--write");
const UA =
  "KBeautyMatchBot/1.0 (+https://www.kbeautymatch.com; catalog-name-repair)";
const DELAY_MS = 1500;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decodeBody(
  buffer: ArrayBuffer,
  contentTypeHeader: string
): { text: string; charset: string } {
  const headerCharset = /charset=["']?([\w-]+)/i.exec(contentTypeHeader)?.[1];
  const peek = Buffer.from(buffer.slice(0, 4096)).toString("latin1");
  const metaCharset =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(peek)?.[1] ??
    /content=["'][^"']*charset=([\w-]+)/i.exec(peek)?.[1];

  for (const charset of [headerCharset, metaCharset, "utf-8"].filter(
    (value): value is string => Boolean(value)
  )) {
    try {
      const decoded = new TextDecoder(charset.toLowerCase()).decode(buffer);
      if (!looksMojibake(decoded)) return { text: decoded, charset };
    } catch {
      // unknown label — try the next candidate
    }
  }
  return { text: new TextDecoder("utf-8").decode(buffer), charset: "utf-8" };
}

type PlannedChange = {
  id: number;
  brand: string | null;
  slug: string | null;
  oldName: string;
  newName: string;
  extractedFrom: string;
  charset: string;
  officialUrl: string;
};

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    console.error("[repair:names] FAIL: Staging URL / service role key missing");
    process.exitCode = 1;
    return;
  }
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
  if (ref === PROD_REF) {
    console.error("[repair:names] FAIL: refusing to write to Production");
    process.exitCode = 1;
    return;
  }
  console.log(
    `[repair:names] target ${ref.slice(0, 4)}***${ref.slice(-3)} · mode ${WRITE ? "WRITE" : "dry run"}`
  );

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, brand, slug")
    .limit(1000);
  if (error) {
    console.error(`[repair:names] FAIL: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const broken = (products ?? []).filter((p) => isMojibakeName(p.name as string));
  if (broken.length === 0) {
    console.log("[repair:names] no broken product names — nothing to do");
    return;
  }

  const { data: offers } = await admin
    .from("product_offers")
    .select("product_id, purchase_url, is_official, active")
    .eq("is_official", true)
    .limit(1000);
  const officialByProduct = new Map<number, string>();
  for (const offer of offers ?? []) {
    if (offer.active === false) continue;
    const key = Number(offer.product_id);
    if (!officialByProduct.has(key)) {
      officialByProduct.set(key, String(offer.purchase_url));
    }
  }

  console.log(`[repair:names] ${broken.length} broken names found`);
  console.log("");

  const planned: PlannedChange[] = [];
  const skipped: Array<Record<string, unknown>> = [];

  for (const product of broken) {
    const productId = Number(product.id);
    const currentName = String(product.name);
    const officialUrl = officialByProduct.get(productId);
    if (!officialUrl) {
      skipped.push({ id: productId, reason: "no_official_offer_url" });
      console.log(`  #${productId} skip — no official offer url`);
      continue;
    }

    let html = "";
    let charset = "";
    try {
      const res = await fetch(officialUrl, {
        headers: { "user-agent": UA, accept: "text/html", "accept-language": "ko" },
        redirect: "follow",
      });
      if (!res.ok) {
        skipped.push({ id: productId, reason: `http_${res.status}`, officialUrl });
        console.log(`  #${productId} skip — HTTP ${res.status}`);
        await sleep(DELAY_MS);
        continue;
      }
      const decoded = decodeBody(
        await res.arrayBuffer(),
        res.headers.get("content-type") ?? ""
      );
      html = decoded.text;
      charset = decoded.charset;
    } catch (fetchError) {
      skipped.push({
        id: productId,
        reason: "fetch_error",
        detail: String((fetchError as Error)?.message ?? fetchError).slice(0, 120),
        officialUrl,
      });
      console.log(`  #${productId} skip — fetch error`);
      await sleep(DELAY_MS);
      continue;
    }

    const extracted = extractProductNameFromHtml(html);
    if (!extracted?.value) {
      skipped.push({ id: productId, reason: "name_not_found_on_page", officialUrl });
      console.log(`  #${productId} skip — no name on page`);
      await sleep(DELAY_MS);
      continue;
    }

    const verdict = validateNameReplacement(currentName, extracted.value);
    if (!verdict.acceptable) {
      skipped.push({
        id: productId,
        reason: verdict.reasons.join(","),
        officialUrl,
        candidate: extracted.value,
      });
      console.log(`  #${productId} skip — ${verdict.reasons.join(", ")}`);
      await sleep(DELAY_MS);
      continue;
    }

    planned.push({
      id: productId,
      brand: (product.brand as string | null) ?? null,
      slug: (product.slug as string | null) ?? null,
      oldName: currentName,
      newName: extracted.value,
      extractedFrom: extracted.from,
      charset,
      officialUrl,
    });
    console.log(`  #${productId} ${currentName}`);
    console.log(`        → ${extracted.value}   (${extracted.from}, ${charset})`);

    await sleep(DELAY_MS);
  }

  console.log("");
  console.log(
    `[repair:names] ready to fix ${planned.length} · skipped ${skipped.length}`
  );

  if (!WRITE) {
    console.log("");
    console.log("[repair:names] dry run — pass --write to apply to Staging");
    return;
  }
  if (planned.length === 0) {
    console.log("[repair:names] nothing to write");
    return;
  }

  // --- backup before touching anything --------------------------------------
  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10);
  const backupDir = path.join(root, "data", "backups", day);
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(
    path.join(backupDir, "product-name-repair.json"),
    `${JSON.stringify(
      {
        appliedAt: stamp,
        environment: "staging",
        reason:
          "EUC-KR product pages were decoded as UTF-8 at collection time; names were unreadable.",
        changes: planned,
        skipped,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(
    `[repair:names] backup written: data/backups/${day}/product-name-repair.json`
  );

  let audited = 0;
  let updated = 0;
  let failed = 0;

  for (const change of planned) {
    // audit first, so a failed update can never leave an unrecorded change
    const { error: auditError } = await admin.from("product_change_history").insert({
      product_id: change.id,
      variant_id: null,
      change_type: "name",
      old_value: { name: change.oldName },
      new_value: {
        name: change.newName,
        action: "mojibake_name_repair",
        extractedFrom: change.extractedFrom,
        sourceCharset: change.charset,
        normalization: "NFC",
      },
      source_url: change.officialUrl,
      approved_by: null,
      reviewed_at: null,
    });
    if (auditError) {
      failed += 1;
      console.error(`  ! #${change.id} audit failed: ${auditError.message.slice(0, 80)}`);
      console.error("    product left unchanged (audit must precede the write)");
      continue;
    }
    audited += 1;

    const { error: updateError } = await admin
      .from("products")
      .update({ name: change.newName })
      .eq("id", change.id);
    if (updateError) {
      failed += 1;
      console.error(
        `  ! #${change.id} update failed: ${updateError.message.slice(0, 80)}`
      );
      continue;
    }
    updated += 1;
    console.log(`  ✓ #${change.id} ${change.newName}`);
  }

  // --- verify by reading back ------------------------------------------------
  const { data: after } = await admin
    .from("products")
    .select("id, name")
    .in(
      "id",
      planned.map((change) => change.id)
    );

  let stillBroken = 0;
  let mismatched = 0;
  for (const change of planned) {
    const row = (after ?? []).find((r) => Number(r.id) === change.id);
    if (!row) continue;
    if (isMojibakeName(row.name as string)) stillBroken += 1;
    else if (row.name !== change.newName) mismatched += 1;
  }

  console.log("");
  console.log(`[repair:names] audited ${audited} · updated ${updated} · failed ${failed}`);
  console.log(
    `[repair:names] verify: still broken ${stillBroken} · unexpected value ${mismatched}`
  );
  if (stillBroken > 0 || mismatched > 0 || failed > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "[repair:names] DONE — names repaired, every change recorded in product_change_history"
  );
}

main().catch((error) => {
  console.error("[repair:names] failed:", error);
  process.exitCode = 1;
});
