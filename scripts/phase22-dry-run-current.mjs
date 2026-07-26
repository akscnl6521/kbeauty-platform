/**
 * Phase 2.2 dry-run ONLY (SELECT). No INSERT/UPDATE/DELETE.
 * Reflects current Staging state for 6 A/B/C target slugs.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize.ts";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients.ts";

const ROOT = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const ARTIFACT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json"
);
const OUT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase22-dry-run-current.json"
);

const TARGETS = [
  {
    slug: "aestura-atobarrier365-cream",
    scenarios: ["A", "B"],
    nameKo: "아토베리어365 크림",
    volume: "80ml",
    category: "cream",
  },
  {
    slug: "round-lab-dokdo-cream",
    scenarios: ["A", "B"],
    nameKo: "1025 독도 크림",
    volume: "80ml",
    category: "cream",
  },
  {
    slug: "torriden-dive-in-serum",
    scenarios: ["A", "B"],
    nameKo: "다이브인 저분자 히알루론산 세럼",
    volume: "50ml",
    category: "serum",
  },
  {
    slug: "skin1004-madagascar-centella-ampoule",
    scenarios: ["B"],
    nameKo: "마다가스카르 센텔라 앰플",
    volume: "100ml",
    category: "ampoule",
  },
  {
    slug: "beauty-of-joseon-green-plum-refreshing-toner",
    scenarios: ["C"],
    nameKo: "청매실 AHA BHA 토너",
    volume: "150ml",
    category: "toner",
  },
  {
    slug: "haruharu-wonder-black-rice-hyaluronic-toner",
    scenarios: ["C"],
    nameKo: "블랙라이스 히알루로닉 토너",
    volume: "150ml",
    category: "toner",
  },
];

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

function isCoreKrOffer(o) {
  return (
    o &&
    o.active === true &&
    o.retailer_country === "KR" &&
    o.verification_status === "verified" &&
    o.stock_status === "in_stock" &&
    o.currency === "KRW" &&
    Number(o.price) > 0 &&
    String(o.purchase_url || "").startsWith("https://")
  );
}

function readinessGuess({ exists, hasKeys, hasMedia, hasCoreOffer, stockNote }) {
  if (!exists && !hasKeys) return "not_registered";
  if (!hasCoreOffer) {
    if (stockNote === "out_of_stock") return "offer_missing_or_oos";
    return "offer_missing";
  }
  if (!hasMedia) return "image_missing";
  if (!hasKeys) return "ingredient_incomplete";
  return "recommendation_ready_candidate";
}

const env = {
  ...loadEnv(".env.staging"),
  ...loadEnv(".env.preview.staging"),
  ...loadEnv(".env.local"),
};
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const ref = extractRef(url);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (ref === PROD_REF) {
  console.error(JSON.stringify({ ok: false, error: "ABORT Production" }));
  process.exit(2);
}
if (ref !== STAGING_REF) {
  console.error(JSON.stringify({ ok: false, error: "ABORT unexpected ref", ref: mask(ref) }));
  process.exit(2);
}
if (!key) {
  console.error(JSON.stringify({ ok: false, error: "missing service role" }));
  process.exit(2);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
const client = createClient(url, key, { auth: { persistSession: false } });
const slugs = TARGETS.map((t) => t.slug);

const { data: products, error: pErr } = await client
  .from("products")
  .select(
    "id,slug,brand,name,name_ko,category,active,verified_at,data_confidence,key_ingredients,full_ingredients,recommendation_reason_ko"
  )
  .in("slug", slugs);
if (pErr) throw pErr;

const bySlug = new Map((products || []).map((p) => [p.slug, p]));
const ids = (products || []).map((p) => p.id);

const { data: offers } = ids.length
  ? await client
      .from("product_offers")
      .select(
        "id,product_id,retailer_name,retailer_country,ships_to_countries,purchase_url,price,currency,stock_status,verification_status,is_official,verified_at,last_checked_at,active,source"
      )
      .in("product_id", ids)
  : { data: [] };

const { data: media } = ids.length
  ? await client
      .from("catalog_product_media")
      .select(
        "id,product_id,image_url,canonical_image_url,source_page_url,is_primary,validation_status,is_fixture,is_official_source"
      )
      .in("product_id", ids)
  : { data: [] };

const { data: links } = ids.length
  ? await client
      .from("product_ingredients")
      .select("product_id")
      .in("product_id", ids)
  : { data: [] };

const offersByPid = new Map();
for (const o of offers || []) {
  const list = offersByPid.get(o.product_id) || [];
  list.push(o);
  offersByPid.set(o.product_id, list);
}
const mediaByPid = new Map();
for (const m of media || []) {
  const list = mediaByPid.get(m.product_id) || [];
  list.push(m);
  mediaByPid.set(m.product_id, list);
}
const linkCountByPid = new Map();
for (const l of links || []) {
  linkCountByPid.set(l.product_id, (linkCountByPid.get(l.product_id) || 0) + 1);
}

// duplicate name/brand collisions among staging (narrow)
const { data: brandHits } = await client
  .from("products")
  .select("id,slug,brand,name,name_ko")
  .or(
    [
      "slug.ilike.%aestura%",
      "slug.ilike.%dokdo-cream%",
      "slug.ilike.%torriden%",
      "slug.ilike.%skin1004%centella%",
      "slug.ilike.%green-plum%",
      "slug.ilike.%haruharu%black-rice%",
    ].join(",")
  )
  .limit(50);

const plans = [];
for (const t of TARGETS) {
  const art = artifact.products.find((p) => p.externalProductId === t.slug);
  const existing = bySlug.get(t.slug) || null;
  const parsed = parseIngredientList(art?.ingredientsRaw || "");
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((x) => ({
      token: x.token,
      normalizedName: x.normalizedName,
      order: x.order,
    }))
  );
  const keyNames = keys.map((k) => k.tokenFromList);
  const imageUrl = art?.images?.[0]?.imageUrl || null;
  const offs = existing ? offersByPid.get(existing.id) || [] : [];
  const meds = existing ? mediaByPid.get(existing.id) || [] : [];
  const linkCount = existing ? linkCountByPid.get(existing.id) || 0 : 0;
  const coreOffers = offs.filter(isCoreKrOffer);
  const primaryMedia = meds.find(
    (m) => m.is_primary && m.validation_status === "verified" && m.is_fixture === false
  ) || meds.find((m) => m.validation_status === "verified");

  const existingKeys = Array.isArray(existing?.key_ingredients)
    ? existing.key_ingredients
    : [];
  const existingFull = Array.isArray(existing?.full_ingredients)
    ? existing.full_ingredients
    : [];

  const krOfficialSoldOut =
    t.slug === "round-lab-dokdo-cream" ||
    t.slug === "beauty-of-joseon-green-plum-refreshing-toner";
  const krOfferHold =
    t.slug === "torriden-dive-in-serum" ||
    t.slug === "haruharu-wonder-black-rice-hyaluronic-toner" ||
    t.slug === "skin1004-madagascar-centella-ampoule";

  let productAction = "insert";
  if (existing) productAction = "update_enrich_only_if_gap";

  let mediaAction = "insert_primary";
  if (primaryMedia) mediaAction = "skip_media_ok";
  else if (meds.length) mediaAction = "insert_or_repair_primary";

  let offerAction = "skip_no_verified_in_stock_source";
  if (coreOffers.length > 0) offerAction = "skip_core_offer_ok";
  else if (krOfficialSoldOut) offerAction = "keep_oos_or_hold_no_fake_instock";
  else if (krOfferHold) offerAction = "hold_until_kr_instock_url";
  else if (t.slug === "aestura-atobarrier365-cream" && coreOffers.length === 0) {
    offerAction = existing ? "insert_kr_if_missing" : "insert_kr";
  }

  let ingredientAction = "link_from_official_inci";
  if (linkCount > 0 && existingKeys.length > 0) ingredientAction = "skip_keys_and_links_ok";
  else if (existingKeys.length > 0 && linkCount === 0) ingredientAction = "insert_product_ingredients_links";
  else if (existing && existingKeys.length === 0) ingredientAction = "enrich_key_ingredients_then_link";

  const missingFields = [];
  if (!existing) missingFields.push("products_row");
  if (!(existing?.active === true && existing?.verified_at)) missingFields.push("active_verified");
  if (!primaryMedia) missingFields.push("verified_primary_image");
  if (coreOffers.length === 0) missingFields.push("kr_verified_in_stock_offer");
  if (existingKeys.length === 0 && keyNames.length === 0) missingFields.push("key_ingredients");
  if (existingFull.length === 0 && parsed.normalized.length === 0) missingFields.push("full_ingredients");
  if (!art?.officialUrl) missingFields.push("source_url");

  const dupCandidates = (brandHits || [])
    .filter((r) => r.slug !== t.slug)
    .filter((r) => {
      const n = `${r.slug} ${r.name} ${r.name_ko}`.toLowerCase();
      const needle = t.slug.split("-").slice(0, 2).join(" ");
      return n.includes(t.slug.split("-")[0]) || n.includes(needle.replace(/-/g, " "));
    })
    .map((r) => ({ id: r.id, slug: r.slug, brand: r.brand, name: r.name }));

  const stockNote = coreOffers.length
    ? "in_stock_verified"
    : krOfficialSoldOut
      ? "out_of_stock"
      : krOfferHold
        ? "hold"
        : "unknown";

  const readinessExpected = readinessGuess({
    exists: Boolean(existing),
    hasKeys: existingKeys.length > 0 || keyNames.length > 0,
    hasMedia: Boolean(primaryMedia) || Boolean(imageUrl),
    hasCoreOffer: coreOffers.length > 0,
    stockNote,
  });

  plans.push({
    slug: t.slug,
    scenarios: t.scenarios,
    exists: Boolean(existing),
    existingId: existing?.id ?? null,
    current: existing
      ? {
          brand: existing.brand,
          name: existing.name,
          name_ko: existing.name_ko,
          category: existing.category,
          active: existing.active,
          verified_at: existing.verified_at,
          key_count: existingKeys.length,
          full_count: existingFull.length,
          ingredient_links: linkCount,
          media_count: meds.length,
          verified_primary_media: Boolean(primaryMedia),
          offers: offs.map((o) => ({
            id: o.id,
            seller: o.retailer_name,
            country: o.retailer_country,
            price: o.price,
            currency: o.currency,
            stock: o.stock_status,
            verification: o.verification_status,
            official: o.is_official,
            active: o.active,
            checked_at: o.last_checked_at,
            core_eligible: isCoreKrOffer(o),
          })),
          core_kr_offer_count: coreOffers.length,
        }
      : null,
    planned: {
      product_action: productAction,
      media_action: mediaAction,
      offer_action: offerAction,
      ingredient_action: ingredientAction,
      canonical_brand: art?.brand || existing?.brand,
      normalized_name: art?.productName || existing?.name,
      name_ko: t.nameKo,
      category: t.category,
      volume_variant: t.volume,
      kr_identity: `KR · ${t.nameKo} · ${t.volume}`,
      active: true,
      verification_status_note:
        "products.verified_at already set on existing rows; do not auto-publish beyond current stage",
      key_ingredients_planned: keyNames,
      caution: art?.cautionIngredients || [],
      source_urls: {
        official: art?.officialUrl,
        image_source: art?.images?.[0]?.sourcePageUrl,
        ingredient_evidence: art?.ingredientEvidences?.[0]?.sourceUrl,
      },
      source_evidence: {
        ingredientStatus_artifact: art?.ingredientStatus,
        evidence_channel: art?.ingredientEvidences?.[0]?.channel,
        evidence_status: art?.ingredientEvidences?.[0]?.status,
        image_trust: art?.images?.[0]?.trust,
        note:
          "해외 공식 INCI는 KR 근거 보강 전 reference/source_verified_candidate 취급. 단일 일반 판매자만으로 recommendation_ready 금지.",
      },
      representative_image: imageUrl,
    },
    missing_fields: missingFields,
    duplicate_candidates: dupCandidates,
    readiness_expected: readinessExpected,
    rollback:
      existing
        ? `기존 id=${existing.id}는 DELETE 금지. 이번 write에서 추가한 offer/media만 active=false 또는 validation 유지.`
        : "신규 insert 시 발급 id를 기록 후 active=false, verified_at=null (DELETE/TRUNCATE 금지).",
  });
}

const summary = {
  product_insert: plans.filter((p) => p.planned.product_action === "insert").length,
  product_update_enrich: plans.filter((p) =>
    String(p.planned.product_action).startsWith("update")
  ).length,
  product_skip_ok: plans.filter((p) => p.exists && p.missing_fields.length === 0).length,
  media_insert: plans.filter((p) =>
    String(p.planned.media_action).includes("insert")
  ).length,
  media_skip_ok: plans.filter((p) => p.planned.media_action === "skip_media_ok").length,
  offer_insert: plans.filter((p) =>
    String(p.planned.offer_action).includes("insert")
  ).length,
  offer_hold_or_oos: plans.filter((p) =>
    /hold|oos|skip_no_verified/.test(p.planned.offer_action)
  ).length,
  offer_ok: plans.filter((p) => p.planned.offer_action === "skip_core_offer_ok").length,
  ingredient_link: plans.filter((p) =>
    /link|enrich/.test(p.planned.ingredient_action)
  ).length,
  ingredient_ok: plans.filter((p) => p.planned.ingredient_action === "skip_keys_and_links_ok")
    .length,
};

const report = {
  ok: true,
  phase: "2.2-dry-run-current-SELECT_ONLY",
  branch_expected: "feature/recommendation-usage-guide-display-20260720",
  projectRef: mask(ref),
  productionWrite: 0,
  mode: "SELECT_ONLY_NO_WRITE",
  masterPlan: "MASTER_PLAN.md v4.2",
  scope: "exactly 6 A/B/C missing-slug targets",
  summary,
  totals: {
    targets: plans.length,
    existing_rows: plans.filter((p) => p.exists).length,
    missing_rows: plans.filter((p) => !p.exists).length,
    core_kr_offer_ready: plans.filter((p) => (p.current?.core_kr_offer_count || 0) > 0)
      .length,
    recommendation_ready_candidate: plans.filter(
      (p) => p.readiness_expected === "recommendation_ready_candidate"
    ).length,
  },
  conflicts: plans
    .filter((p) => (p.duplicate_candidates || []).length > 0)
    .map((p) => ({ slug: p.slug, duplicates: p.duplicate_candidates })),
  blockers: plans
    .filter((p) => p.missing_fields.includes("kr_verified_in_stock_offer"))
    .map((p) => ({
      slug: p.slug,
      readiness_expected: p.readiness_expected,
      offer_action: p.planned.offer_action,
    })),
  plans,
  rollback_global: [
    "DELETE/TRUNCATE/schema 변경 금지",
    "신규 id만 active=false + verified_at=null",
    "기존 COSRX 등 비대상 제품 변경 금지",
    "Production ref 절대 미적용",
  ],
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${OUT}`);
