#!/usr/bin/env node
/**
 * Preview SSO 대체: linked Staging SQL → Evidence/랭킹 로컬 검증.
 * .env.local 을 쓰지 않음 (Production URL 혼입 방지).
 * Production never.
 *
 * Run: node scripts/staging-preview-substitute-quality.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(
  path.join(root, "supabase/.temp/project-ref"),
  "utf8"
).trim();
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}

function q(sql) {
  const f = path.join(tmpdir(), `kb-sub-${process.pid}-${Math.random()}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      "npx.cmd",
      ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    const out = r.stdout || "";
    const i = out.indexOf("{");
    if ((r.status ?? 1) !== 0) {
      console.error((r.stderr || out).slice(-800));
      process.exit(r.status ?? 1);
    }
    return i >= 0 ? JSON.parse(out.slice(i)) : {};
  } finally {
    try {
      unlinkSync(f);
    } catch {}
  }
}

const CONCERNS = [
  { label: "붉은기", code: "redness" },
  { label: "건조함", code: "dryness" },
  { label: "민감", code: "sensitivity" },
  { label: "여드름", code: "acne" },
  { label: "색소침착", code: "pigmentation" },
  { label: "주름", code: "antiaging" },
  { label: "모공", code: "pores" },
  { label: "자외선", code: "uv" },
];

// Register tsx for TS imports
spawnSync("npx.cmd", ["--yes", "tsx", "--version"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});

// Prefer a small TS runner child for imports
function runTsHelper(catalogJson) {
  const helper = path.join(tmpdir(), `kb-sub-rank-${process.pid}.ts`);
  const catalogPath = path.join(tmpdir(), `kb-sub-cat-${process.pid}.json`);
  writeFileSync(catalogPath, catalogJson, "utf8");
  writeFileSync(
    helper,
    `
import { readFileSync } from "node:fs";
import { applyEvidenceToRecommendation } from "${root.replace(/\\/g, "/")}/src/lib/evidence/applyEvidenceToRecommendation.ts";
import { loadStaticApprovedEvidenceForConcerns } from "${root.replace(/\\/g, "/")}/src/lib/evidence/staticCatalog.ts";
import { isKoreanBeautyBrand } from "${root.replace(/\\/g, "/")}/src/lib/brand/displayBrandName.ts";
import { applyRednessObservationToRecommendation, isRednessCounselingPriority } from "${root.replace(/\\/g, "/")}/src/lib/ai/rednessObservation.ts";
import { buildMatchReason } from "${root.replace(/\\/g, "/")}/src/lib/recommend/buildMatchReason.ts";
import { clampTopNWithoutPadding } from "${root.replace(/\\/g, "/")}/src/lib/recommend/clampTopN.ts";
import { filterCandidatesBySafety } from "${root.replace(/\\/g, "/")}/src/lib/recommend/filterCandidatesBySafety.ts";
import { filterRankedByMatchEvidence } from "${root.replace(/\\/g, "/")}/src/lib/recommend/filterRankedByMatchEvidence.ts";
import { filterCandidatesByOfferAvailability } from "${root.replace(/\\/g, "/")}/src/lib/recommend/productOffer.ts";
import { filterOutStimulatingActives, filterPublicCatalogProducts, isExcludedFromPublicCatalog } from "${root.replace(/\\/g, "/")}/src/lib/recommend/publicCatalogFilter.ts";
import { rankProducts } from "${root.replace(/\\/g, "/")}/src/lib/recommend/rankProducts.ts";
import { CORE_RECOMMEND_OFFER_COUNTRY, RANKED_PRODUCTS_TOP_N } from "${root.replace(/\\/g, "/")}/src/lib/recommend/types.ts";

const concerns = ${JSON.stringify(CONCERNS)};
const catalog = JSON.parse(readFileSync(${JSON.stringify(catalogPath)}, "utf8"));

function fp(rec, topIds, reason0) {
  const pmids = (rec.evidenceLinks||[]).map(e=>e.pmid||"").filter(Boolean).sort().join(",");
  const ings = (rec.recommendedIngredients||[]).slice(0,4).join("|");
  const prec = (rec.precautions||[])[0]||"";
  return [rec.skinConcerns?.[0]||"", pmids, ings, topIds.join(","), reason0.slice(0,80), prec.slice(0,40), rec.managementLevel||""].join("||");
}

const rows = [];
for (const { label, code } of concerns) {
  const evidence = loadStaticApprovedEvidenceForConcerns([label]);
  if (!evidence.length) throw new Error(label + ": no evidence");
  let rec = { skinConcerns:[label], recommendedIngredients:[], ingredientsToAvoid:[], confidenceScore:0.7, managementLevel:"cosmetic_care" };
  rec = applyEvidenceToRecommendation(rec, evidence);
  if (!(rec.evidenceLinks?.length>=1)) throw new Error(label + ": links");
  if (!(rec.precautions?.length>=1)) throw new Error(label + ": precautions");

  const publicOnly = filterPublicCatalogProducts(catalog);
  for (const p of publicOnly) {
    if (isExcludedFromPublicCatalog(p)) throw new Error(label + ": probe leak " + p.slug);
  }
  const { eligible } = filterCandidatesByOfferAvailability(publicOnly, CORE_RECOMMEND_OFFER_COUNTRY);
  if (!eligible.length) throw new Error(label + ": empty KR pool");
  for (const p of eligible) {
    if (isExcludedFromPublicCatalog(p)) throw new Error(label + ": probe in KR " + p.slug);
  }
  const { safe } = filterCandidatesBySafety(eligible, rec);
  const top = clampTopNWithoutPadding(filterRankedByMatchEvidence(rankProducts(rec, safe)), RANKED_PRODUCTS_TOP_N);
  if (!top.length) throw new Error(label + ": empty TopN");
  for (const row of top) {
    if (isExcludedFromPublicCatalog(row.product)) throw new Error(label + ": ranked probe");
    if (!isKoreanBeautyBrand(row.product.brand)) throw new Error(label + ": non-KR " + row.product.brand);
  }
  const reason0 = buildMatchReason({ recommendation: rec, matchedIngredients: top[0].matchedIngredients, product: top[0].product });
  const row = {
    label, code,
    evidenceCount: rec.evidenceLinks.length,
    precaution0: rec.precautions[0],
    topSlug: top[0].product.slug,
    matched0: top[0].matchedIngredients.slice(0,3),
    pmids: (rec.evidenceLinks||[]).map(e=>e.pmid||"").filter(Boolean).sort().join(","),
    fingerprint: fp(rec, top.map(t=>String(t.product.id)), reason0),
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}

const fps = rows.map(r=>r.fingerprint);
if (new Set(fps).size !== fps.length) throw new Error("identical fingerprints");
const pmidSets = rows.map(r=>r.pmids);
if (new Set(pmidSets).size !== pmidSets.length) throw new Error("identical PMID sets");

const risky = { trigger:"unknown", duration:"recurrent", symptoms:["burning"], areas:["cheeks"] };
if (!isRednessCounselingPriority(risky)) throw new Error("counseling priority");
let elevated = applyRednessObservationToRecommendation({
  skinConcerns:["붉은기"], recommendedIngredients:["판테놀"], ingredientsToAvoid:[], confidenceScore:0.7, managementLevel:"cosmetic_care"
}, risky);
if (elevated.managementLevel !== "expert_first") throw new Error("not expert_first");
elevated = applyEvidenceToRecommendation(elevated, loadStaticApprovedEvidenceForConcerns(["붉은기"]));
const { eligible } = filterCandidatesByOfferAvailability(filterPublicCatalogProducts(catalog), CORE_RECOMMEND_OFFER_COUNTRY);
const pool = filterOutStimulatingActives(eligible);
const { safe } = filterCandidatesBySafety(pool, elevated);
const riskTop = clampTopNWithoutPadding(filterRankedByMatchEvidence(rankProducts(elevated, safe)), RANKED_PRODUCTS_TOP_N);
for (const row of riskTop) {
  const blob = (row.product.name||"") + "\\n" + (row.product.key_ingredients||[]).join("\\n");
  if (/\\bretinol\\b/i.test(blob)) throw new Error("risk retinol");
  if (/salicylic/i.test(blob)) throw new Error("risk salicylic");
}

console.log(JSON.stringify({
  phase: "staging_preview_substitute_ok",
  concerns: rows.length,
  fingerprintsUnique: true,
  counseling: "expert_first",
  riskTopCount: riskTop.length,
}));
`,
    "utf8"
  );

  try {
    const r = spawnSync("npx.cmd", ["--yes", "tsx", helper], {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: {
        ...process.env,
        npm_config_loglevel: "silent",
        // Force empty supabase env so accidental import does not hit Production
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
    });
    process.stdout.write(r.stdout || "");
    if ((r.status ?? 1) !== 0) {
      console.error((r.stderr || "").slice(-1200));
      process.exit(r.status ?? 1);
    }
  } finally {
    try {
      unlinkSync(helper);
    } catch {}
    try {
      unlinkSync(catalogPath);
    } catch {}
  }
}

const products = q(`
SELECT p.id::text AS id,
       p.name, p.name_ko, p.name_ja, p.brand, p.category,
       p.skin_concern, p.skin_tone, p.key_ingredients, p.key_ingredients_ja,
       p.price_usd, p.recommendation_reason, p.recommendation_reason_ko, p.recommendation_reason_ja,
       p.slug,
       p.link_sephora, p.link_amazon_us, p.link_amazon_jp, p.link_qoo10,
       p.link_oliveyoung, p.link_coupang, p.link_yesstyle,
       p.active, p.verified_at
FROM products p
WHERE p.active IS TRUE AND p.verified_at IS NOT NULL
ORDER BY p.id;
`);

const offers = q(`
SELECT o.product_id::text AS product_id,
       o.id::text AS id,
       o.retailer_name, o.retailer_country, o.ships_to_countries,
       o.purchase_url, o.price, o.currency, o.stock_status,
       o.verification_status, o.verified_at, o.is_official, o.active
FROM product_offers o
JOIN products p ON p.id = o.product_id
WHERE p.active IS TRUE AND p.verified_at IS NOT NULL;
`);

const offerByProduct = new Map();
for (const o of offers.rows || []) {
  const list = offerByProduct.get(o.product_id) || [];
  list.push({
    id: o.id,
    productId: o.product_id,
    retailerName: o.retailer_name,
    retailerCountry: o.retailer_country,
    shipsToCountries: o.ships_to_countries || ["KR"],
    purchaseUrl: o.purchase_url,
    price: o.price != null ? Number(o.price) : undefined,
    currency: o.currency,
    stockStatus: o.stock_status,
    verificationStatus: o.verification_status,
    verifiedAt: o.verified_at,
    isOfficial: o.is_official,
    active: o.active !== false,
  });
  offerByProduct.set(o.product_id, list);
}

const catalog = (products.rows || []).map((p) => ({
  id: p.id,
  name: p.name,
  name_ko: p.name_ko,
  name_ja: p.name_ja,
  brand: p.brand,
  category: p.category,
  skin_concern: p.skin_concern,
  skin_tone: p.skin_tone,
  key_ingredients: p.key_ingredients,
  key_ingredients_ja: p.key_ingredients_ja,
  price_usd: p.price_usd,
  recommendation_reason: p.recommendation_reason,
  recommendation_reason_ko: p.recommendation_reason_ko,
  recommendation_reason_ja: p.recommendation_reason_ja,
  slug: p.slug,
  link_sephora: p.link_sephora,
  link_amazon_us: p.link_amazon_us,
  link_amazon_jp: p.link_amazon_jp,
  link_qoo10: p.link_qoo10,
  link_oliveyoung: p.link_oliveyoung,
  link_coupang: p.link_coupang,
  link_yesstyle: p.link_yesstyle,
  offers: offerByProduct.get(p.id) || [],
}));

// Fail if any active verified product looks like probe/test
const probeLike = catalog.filter((p) => {
  const text = [p.name, p.name_ko, p.slug].filter(Boolean).join("\n");
  return /(HTTP\s*API|Alias\s*Probe|probe|fixture|검증용|테스트\s*제품|http-api|test-only)/i.test(
    text
  );
});
if (probeLike.length) {
  console.error(
    "FAIL probe/test products still active+verified",
    probeLike.map((p) => p.slug)
  );
  process.exit(1);
}

assert.ok(catalog.length >= 1, "no active verified products on Staging");
console.log(
  JSON.stringify({
    phase: "staging_catalog_loaded",
    linked,
    productCount: catalog.length,
    offerRows: (offers.rows || []).length,
  })
);

runTsHelper(JSON.stringify(catalog));
