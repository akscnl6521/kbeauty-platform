/**
 * Phase 2.2 Staging write: insert 6 missing A/B/C slugs (non-destructive).
 * Abort on Production. No migration / truncate / delete.
 *
 * Usage:
 *   npx tsx scripts/phase22-apply-staging-missing-slugs.mjs --dry-run
 *   npx tsx scripts/phase22-apply-staging-missing-slugs.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize.ts";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients.ts";
import { assertStagingCatalogWriteAllowed } from "../src/lib/admin/stagingWriteGate.ts";

const ROOT = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const BUCKET = "product-images";
const ARTIFACT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json"
);
const OUT_DIR = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22"
);
const CASE_TAG = "[phase22-missing-slug-2026-07-22]";

const APPLY = process.argv.includes("--apply");
const DRY = !APPLY || process.argv.includes("--dry-run");

function loadEnv(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function extractRef(url) {
  return (String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || "";
}

function mask(ref) {
  if (!ref || ref.length < 8) return String(ref || "");
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function ingredientSlugFromName(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || `tok-${Date.now()}`
  );
}

const TARGETS = [
  {
    slug: "aestura-atobarrier365-cream",
    nameKo: "아토베리어365 크림",
    volumeNote: "80ml",
    offer: {
      retailer_name: "아모레몰",
      purchase_url:
        "https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=150100000286&onlineProdSn=60498",
      price: 52800,
      currency: "KRW",
      stock_status: "in_stock",
      is_official: true,
      note: "공식 유통 아모레몰 더블(80ml×2) 구매 UI+주간판매 확인. 단품 공식몰은 일시품절 신호.",
    },
  },
  {
    slug: "round-lab-dokdo-cream",
    nameKo: "1025 독도 크림",
    volumeNote: "80ml",
    offer: {
      retailer_name: "ROUND LAB 공식몰",
      purchase_url:
        "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%81%AC%EB%A6%BC-80ml/24/",
      price: 25600,
      currency: "KRW",
      stock_status: "out_of_stock",
      is_official: true,
      note: "공식몰 품절 확인 — in_stock 승격 금지.",
    },
  },
  {
    slug: "torriden-dive-in-serum",
    nameKo: "다이브인 저분자 히알루론산 세럼",
    volumeNote: "50ml",
    offer: null,
  },
  {
    slug: "skin1004-madagascar-centella-ampoule",
    nameKo: "마다가스카르 센텔라 앰플",
    volumeNote: "100ml",
    offer: null,
  },
  {
    slug: "beauty-of-joseon-green-plum-refreshing-toner",
    nameKo: "청매실 AHA BHA 토너",
    volumeNote: "150ml",
    offer: {
      retailer_name: "조선미녀 공식몰",
      purchase_url:
        "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/",
      price: 18000,
      currency: "KRW",
      stock_status: "out_of_stock",
      is_official: true,
      note: "공식몰 SOLD OUT 확인 — in_stock 승격 금지.",
    },
  },
  {
    slug: "haruharu-wonder-black-rice-hyaluronic-toner",
    nameKo: "블랙라이스 히알루로닉 토너",
    volumeNote: "150ml",
    offer: null,
  },
];

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`image_fetch_${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!ct.startsWith("image/") || buf.length < 1000) {
    throw new Error(`image_invalid_${ct}_${buf.length}`);
  }
  if (buf.length > 5 * 1024 * 1024) throw new Error("image_too_large");
  return { bytes: buf, mimeType: ct };
}

async function ensureIngredient(client, token, created) {
  if (token.matchedIngredientId != null) return Number(token.matchedIngredientId);
  const slug = ingredientSlugFromName(token.normalizedName);
  const nameEn = token.token.slice(0, 120);
  const { data: existing } = await client
    .from("ingredients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id != null) return Number(existing.id);
  const { data: inserted, error } = await client
    .from("ingredients")
    .insert({
      slug,
      name_en: nameEn,
      caution: "본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.",
      effects: [],
    })
    .select("id")
    .single();
  if (error || inserted?.id == null) {
    const { data: again } = await client
      .from("ingredients")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (again?.id != null) return Number(again.id);
    throw new Error(`ingredient_insert:${slug}:${error?.message}`);
  }
  created.push(Number(inserted.id));
  return Number(inserted.id);
}

async function enrichExistingKeys(client, result) {
  // Staging service_role has SELECT+INSERT only on products (no UPDATE grant).
  // Key enrichment that requires UPDATE is reported as skipped with computed after values.
  const enrichIds = [
    { id: 14, slug: "beauty-of-joseon-glow-serum-propolis-niacinamide" },
    { id: 13, slug: "anua-heartleaf-77-soothing-toner" },
  ];
  for (const row of enrichIds) {
    const { data: p, error } = await client
      .from("products")
      .select("id,slug,full_ingredients,key_ingredients")
      .eq("id", row.id)
      .maybeSingle();
    if (error || !p) {
      result.keyEnrich.push({ ...row, status: "missing" });
      continue;
    }
    const full = Array.isArray(p.full_ingredients) ? p.full_ingredients : [];
    const cleaned = full.filter(
      (t) =>
        typeof t === "string" &&
        t.length > 1 &&
        t.length < 120 &&
        !/[\"{}]/.test(t) &&
        !/how to use|published_at|created_at/i.test(t)
    );
    const parsed = parseIngredientList(cleaned.join(", "));
    const keys = extractKeyIngredientsFromFullList(
      parsed.normalized.map((t) => ({
        token: t.token,
        normalizedName: t.normalizedName,
        order: t.order,
      }))
    );
    const keyNames = keys.map((k) => k.tokenFromList);
    if (row.id === 13) {
      const hout = cleaned.find((t) => /houttuynia/i.test(t));
      if (hout && !keyNames.some((k) => /houttuynia/i.test(k))) {
        keyNames.unshift(hout);
      }
    }
    result.keyEnrich.push({
      ...row,
      status: "skipped_no_update_grant",
      before: p.key_ingredients,
      afterDesired: keyNames,
      note: "service_role products UPDATE privilege absent; Heartleaf alias code fix covers anua match.",
    });
  }
}

async function main() {
  const env = {
    ...loadEnv(".env.staging"),
    ...loadEnv(".env.preview.staging"),
    ...loadEnv(".env.local"),
  };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const ref = extractRef(url);

  if (ref === PROD_REF) throw new Error("ABORT Production");
  if (ref !== STAGING_REF) throw new Error(`ABORT unexpected ref ${mask(ref)}`);
  if (!key) throw new Error("missing service role");

  // Gate uses process env — align for assertStagingCatalogWriteAllowed
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  process.env.SUPABASE_PROJECT_REF = ref;
  process.env.CATALOG_DATABASE_ENV = "staging";
  if (!process.env.APP_ENV) process.env.APP_ENV = "staging";

  const gate = assertStagingCatalogWriteAllowed(process.env);
  if (!gate.ok && APPLY) {
    throw new Error(`${gate.code}: ${gate.message}`);
  }

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const client = createClient(url, key, { auth: { persistSession: false } });

  const result = {
    phase: "2.2-apply",
    mode: DRY ? "DRY_RUN" : "APPLY",
    projectRef: mask(ref),
    productionWrite: 0,
    caseTag: CASE_TAG,
    products: [],
    keyEnrich: [],
    errors: [],
  };

  await enrichExistingKeys(client, result);

  for (const target of TARGETS) {
    const art = artifact.products.find((p) => p.externalProductId === target.slug);
    if (!art) {
      result.errors.push({ slug: target.slug, error: "artifact_missing" });
      continue;
    }

    const { data: existing } = await client
      .from("products")
      .select("id,slug,active,verified_at,key_ingredients")
      .eq("slug", target.slug)
      .maybeSingle();

    const parsed = parseIngredientList(art.ingredientsRaw || "");
    const keys = extractKeyIngredientsFromFullList(
      parsed.normalized.map((t) => ({
        token: t.token,
        normalizedName: t.normalizedName,
        order: t.order,
      }))
    );
    const keyNames = keys.map((k) => k.tokenFromList);
    const keyOrder = new Set(keys.map((k) => k.orderInList));
    const imageMeta = art.images?.[0];
    const nowIso = new Date().toISOString();

    const entry = {
      slug: target.slug,
      action: existing ? "enrich_existing" : "insert",
      productId: existing?.id ?? null,
      media: null,
      offer: null,
      ingredientsLinked: 0,
      hold: !target.offer || target.offer.stock_status !== "in_stock",
      offerPlan: target.offer,
      keyIngredients: keyNames,
    };

    if (existing) {
      result.products.push({ ...entry, note: "exists_skip_insert" });
      continue;
    }

    if (DRY) {
      entry.media = { action: "would_insert", url: imageMeta?.imageUrl };
      entry.offer = target.offer
        ? {
            action:
              target.offer.stock_status === "in_stock"
                ? "would_insert_verified"
                : "would_insert_out_of_stock",
            ...target.offer,
          }
        : { action: "skip_no_verified_kr_offer" };
      entry.ingredientsLinked = parsed.normalized.length;
      result.products.push(entry);
      continue;
    }

    // INSERT product
    const { data: product, error: pErr } = await client
      .from("products")
      .insert({
        brand: art.brand,
        name: art.productName,
        name_ko: target.nameKo,
        category: art.productIdentity?.category || "skincare",
        slug: target.slug,
        usage_area: "face",
        recommendation_reason: `${art.brand} ${art.productName} (${target.volumeNote}) — Phase 2.2 staging enrichment`,
        recommendation_reason_ko: `${target.nameKo} (${target.volumeNote}) — Phase 2.2 Staging 보강`,
        full_ingredients: parsed.normalized.map((t) => t.token),
        key_ingredients: keyNames,
        active: true,
        verified_at: nowIso,
        data_confidence: "official_brand_inci_phase22",
      })
      .select("id,slug")
      .single();
    if (pErr || product?.id == null) {
      result.errors.push({ slug: target.slug, error: pErr?.message || "insert_failed" });
      continue;
    }
    const productId = Number(product.id);
    entry.productId = productId;

    // ingredients link
    const createdIng = [];
    for (const token of parsed.normalized) {
      const ingredientId = await ensureIngredient(client, token, createdIng);
      const { error: linkErr } = await client.from("product_ingredients").insert({
        product_id: productId,
        ingredient_id: ingredientId,
        ingredient_order: token.order,
        is_key_ingredient: keyOrder.has(token.order),
        source_type: "official_brand",
        source_url: art.officialUrl || null,
        verification_status: "verified",
        source_verified: true,
        confidence: token.confidence,
        verified_at: nowIso,
      });
      if (!linkErr) entry.ingredientsLinked += 1;
    }

    // media: download official CDN → storage
    if (imageMeta?.imageUrl) {
      try {
        const img = await downloadImage(imageMeta.imageUrl);
        const ext =
          img.mimeType === "image/png"
            ? "png"
            : img.mimeType === "image/webp"
              ? "webp"
              : "jpg";
        const hash = createHash("sha256").update(img.bytes).digest("hex");
        const objectPath = `products/${productId}/primary-${hash.slice(0, 16)}.${ext}`;
        const { error: upErr } = await client.storage
          .from(BUCKET)
          .upload(objectPath, img.bytes, {
            contentType: img.mimeType,
            upsert: false,
          });
        if (upErr && !/already exists|duplicate/i.test(upErr.message)) {
          throw upErr;
        }
        const { data: signed } = await client.storage
          .from(BUCKET)
          .createSignedUrl(objectPath, 60 * 60 * 24 * 7);
        const { data: mediaRow, error: mErr } = await client
          .from("catalog_product_media")
          .insert({
            product_id: productId,
            media_type: "product_front",
            image_url: signed?.signedUrl || `storage://${BUCKET}/${objectPath}`,
            canonical_image_url: `storage://${BUCKET}/${objectPath}`,
            source_page_url: imageMeta.sourcePageUrl || art.officialUrl,
            source_domain: new URL(imageMeta.sourcePageUrl || art.officialUrl).hostname,
            source_type: "official_brand",
            source_tier: 1,
            is_official_source: true,
            usage_rights_status: "licensed_copy_allowed",
            mime_type: img.mimeType,
            content_length: img.bytes.length,
            content_hash: hash,
            is_accessible: true,
            is_primary: true,
            display_order: 0,
            validation_status: "verified",
            validation_errors: [],
            verified_at: nowIso,
            is_fixture: false,
          })
          .select("id")
          .single();
        if (mErr) throw mErr;
        entry.media = { action: "inserted", mediaId: mediaRow.id, objectPath };
      } catch (e) {
        entry.media = { action: "failed", error: String(e) };
        result.errors.push({ slug: target.slug, error: `media:${String(e)}` });
      }
    }

    // offer
    if (target.offer) {
      const o = target.offer;
      const verified = o.stock_status === "in_stock";
      const { data: offerRow, error: oErr } = await client
        .from("product_offers")
        .insert({
          product_id: productId,
          retailer_name: o.retailer_name,
          retailer_country: "KR",
          ships_to_countries: ["KR"],
          purchase_url: o.purchase_url,
          price: o.price,
          currency: o.currency,
          stock_status: o.stock_status,
          verification_status: verified ? "verified" : "needs_review",
          is_official: o.is_official,
          verified_at: verified ? nowIso : null,
          last_checked_at: nowIso,
          active: true,
          source: `${CASE_TAG} ${o.note}`,
        })
        .select("id,stock_status,verification_status")
        .single();
      if (oErr) {
        entry.offer = { action: "failed", error: oErr.message };
        result.errors.push({ slug: target.slug, error: `offer:${oErr.message}` });
      } else {
        entry.offer = { action: "inserted", ...offerRow };
      }
    } else {
      entry.offer = { action: "skipped_no_kr_in_stock_source" };
    }

    result.products.push(entry);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(
    OUT_DIR,
    DRY ? "phase22-apply-dry-run.json" : "phase22-apply-result.json"
  );
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outFile}`);
  if (result.errors.length && !DRY) process.exitCode = 1;
}

main().catch((e) => {
  const msg =
    e instanceof Error
      ? e.message
      : e && typeof e === "object"
        ? JSON.stringify(e)
        : String(e);
  console.error(JSON.stringify({ ok: false, error: msg, stack: e?.stack }, null, 2));
  process.exit(1);
});
