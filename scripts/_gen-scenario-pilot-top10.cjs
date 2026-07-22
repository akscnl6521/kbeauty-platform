'use strict';
/**
 * Generator for scenario Top10 pilot artifacts (2026-07-22).
 * KEEP for regen: node scripts/_gen-scenario-pilot-top10.cjs
 * Writes UTF-8 only via fs.writeFileSync(..., { encoding: "utf8" }).
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "catalog", "scenario-pilot", "2026-07-22");
const CHECKED_AT = "2026-07-22";
const BRAND_CAP_DEFAULT = 2;
const READINESS = [
  "trend_candidate",
  "catalog_ready",
  "ingredient_candidate",
  "recommendation_ready",
  "review_required",
  "unavailable",
];
const READINESS_SET = new Set(READINESS);

function cand(p) {
  const c = {
    productIdentity: p.productIdentity,
    brand: p.brand,
    normalizedProductName: p.normalizedProductName,
    category: p.category,
    scenarioFit: p.scenarioFit || {
      fitNotes: "Aligned with scenario concern and category for pilot pool.",
      fitScore: 0.75,
    },
    roleTags: p.roleTags,
    trendEvidence: p.trendEvidence || {
      present: false,
      notes: "No formal trend score; pilot qualitative only.",
      signals: [],
    },
    ingredientEvidence: p.ingredientEvidence || {
      present: false,
      inciAvailable: false,
      sourceUrls: [],
      notes: "INCI not verified for pilot.",
    },
    imageEvidence: p.imageEvidence || {
      present: false,
      sourceUrls: [],
      notes: "Official product image not captured in pilot.",
    },
    offerEvidence: p.offerEvidence || {
      present: false,
      offerUrl: null,
      notes: "Offer URL not confirmed in pilot.",
    },
    sourceUrls: p.sourceUrls || [],
    sourceTrust: p.sourceTrust || {
      tier: "secondary",
      notes: "Pilot trust based on known brand PDP / public knowledge.",
    },
    dataFreshness: p.dataFreshness || {
      checkedAt: CHECKED_AT,
      staleness: "pilot_manual",
    },
    cautionIngredients: p.cautionIngredients || [],
    readiness: p.readiness,
    rejectionReason: p.rejectionReason == null ? null : p.rejectionReason,
    affiliateOrAdInScore: false,
  };
  if (!READINESS_SET.has(c.readiness)) {
    throw new Error("bad readiness " + c.readiness + " for " + c.productIdentity);
  }
  return c;
}

function metricsFor(candidates, scenarioId) {
  const usable = candidates.filter((c) => c.readiness !== "unavailable");
  if (usable.length !== 10) {
    throw new Error(scenarioId + ": expected 10 non-unavailable, got " + usable.length);
  }
  const byReadiness = {};
  for (const r of READINESS) byReadiness[r] = 0;
  for (const c of usable) byReadiness[c.readiness] += 1;
  const brandCounts = {};
  for (const c of usable) {
    const k = c.brand.trim().toLowerCase();
    brandCounts[k] = (brandCounts[k] || 0) + 1;
    if (brandCounts[k] > BRAND_CAP_DEFAULT) {
      throw new Error(scenarioId + ": brand cap exceeded for " + c.brand);
    }
  }
  if (usable.some((c) => c.affiliateOrAdInScore !== false)) {
    throw new Error(scenarioId + ": affiliateOrAdInScore must be false");
  }
  const roleSet = new Set();
  for (const c of usable) for (const t of c.roleTags) roleSet.add(t);
  return {
    scenarioId,
    poolSize: usable.length,
    brandCapDefault: BRAND_CAP_DEFAULT,
    affiliateOrAdInScore: false,
    readinessCounts: byReadiness,
    recommendationReadyCount: byReadiness.recommendation_ready,
    distinctBrands: Object.keys(brandCounts).length,
    brandCounts,
    distinctRoleTags: [...roleSet].sort(),
    identities: usable.map((c) => c.productIdentity),
  };
}

function buildPool(meta, candidates) {
  const filtered = candidates.filter((c) => c.readiness !== "unavailable");
  return {
    scenarioId: meta.scenarioId,
    displayNameKo: meta.displayNameKo,
    coreScenarioRef: meta.coreScenarioRef || meta.scenarioId,
    pilotDate: CHECKED_AT,
    brandCapDefault: BRAND_CAP_DEFAULT,
    affiliateOrAdInScore: false,
    notes: meta.notes || null,
    candidates: filtered,
    metrics: metricsFor(filtered, meta.scenarioId),
  };
}

function writeUtf8(filePath, text) {
  fs.writeFileSync(filePath, text, { encoding: "utf8" });
}

function writeJson(fileName, obj) {
  const p = path.join(OUT_DIR, fileName);
  writeUtf8(p, JSON.stringify(obj, null, 2) + "\n");
  return p;
}

const poolA = buildPool(
  {
    scenarioId: "kr-redness-sensitive-cream",
    displayNameKo: "????? ??",
    notes:
      "recommendation_ready only for COSRX Snail 92 + AESTURA Atobarrier365 with prior official INCI research.",
  },
  [
    cand({
      productIdentity: "cosrx-advanced-snail-92-all-in-one-cream",
      brand: "COSRX",
      normalizedProductName: "Advanced Snail 92 All in One Cream",
      category: "cream",
      roleTags: ["popular", "safety"],
      scenarioFit: {
        fitNotes: "Snail mucin barrier support for sensitive dryness/redness-adjacent care.",
        fitScore: 0.92,
      },
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: ["https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream"],
        notes: "Official INCI page previously researched for pilot.",
      },
      imageEvidence: {
        present: true,
        sourceUrls: ["https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream"],
        notes: "Official PDP product imagery reachable.",
      },
      offerEvidence: {
        present: true,
        offerUrl: "https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream",
        notes: "Official brand store PDP.",
      },
      sourceUrls: ["https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream"],
      sourceTrust: { tier: "official_brand", notes: "Brand official PDP." },
      readiness: "recommendation_ready",
      trendEvidence: {
        present: true,
        notes: "Long-standing K-beauty staple; qualitative pilot signal only.",
        signals: ["known_popular"],
      },
    }),
    cand({
      productIdentity: "aestura-atobarrier365-cream",
      brand: "AESTURA",
      normalizedProductName: "Atobarrier 365 Cream",
      category: "cream",
      roleTags: ["safety", "popular"],
      scenarioFit: {
        fitNotes: "Ceramide barrier cream commonly used for sensitive skin.",
        fitScore: 0.94,
      },
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: ["https://www.aestura.com/"],
        notes: "Official INCI researched previously for pilot.",
      },
      imageEvidence: {
        present: true,
        sourceUrls: ["https://www.aestura.com/"],
        notes: "Official product imagery available.",
      },
      offerEvidence: {
        present: true,
        offerUrl: "https://www.aestura.com/",
        notes: "Official brand site / KR pharmacy channel PDP reachable.",
      },
      sourceUrls: ["https://www.aestura.com/"],
      sourceTrust: { tier: "official_brand", notes: "Amorepacific dermocosmetic line." },
      readiness: "recommendation_ready",
      trendEvidence: {
        present: true,
        notes: "Strong KR dermocosmetic presence.",
        signals: ["known_popular", "dermocosmetic"],
      },
    }),
    cand({
      productIdentity: "illiyoon-ceramide-ato-concentrate-cream",
      brand: "Illiyoon",
      normalizedProductName: "Ceramide Ato Concentrate Cream",
      category: "cream",
      roleTags: ["value", "safety"],
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "INCI known from secondary lists; not re-verified against live PDP this pilot.",
      },
      imageEvidence: {
        present: true,
        sourceUrls: [],
        notes: "Retail images common; pilot did not archive asset.",
      },
      offerEvidence: {
        present: true,
        offerUrl: "https://www.oliveyoung.co.kr/",
        notes: "Typically stocked at Olive Young; exact SKU URL not locked.",
      },
      readiness: "ingredient_candidate",
      rejectionReason:
        "Usable INCI known but offer URL + image evidence not locked to a single confirmed PDP snapshot.",
    }),
    cand({
      productIdentity: "drjart-cicapair-intensive-soothing-repair-cream",
      brand: "Dr.Jart+",
      normalizedProductName: "Cicapair Intensive Soothing Repair Cream",
      category: "cream",
      roleTags: ["popular"],
      offerEvidence: {
        present: true,
        offerUrl: "https://www.drjart.com/",
        notes: "Brand site reachable; full evidence pack incomplete.",
      },
      imageEvidence: { present: true, sourceUrls: [], notes: "PDP imagery exists." },
      readiness: "catalog_ready",
      rejectionReason: "Identity + PDP reachable; INCI not extracted for pilot.",
    }),
    cand({
      productIdentity: "etude-soonjung-2x-barrier-intensive-cream",
      brand: "Etude",
      normalizedProductName: "SoonJung 2x Barrier Intensive Cream",
      category: "cream",
      roleTags: ["safety", "value"],
      offerEvidence: {
        present: true,
        offerUrl: "https://www.etude.com/",
        notes: "Official brand catalog.",
      },
      readiness: "catalog_ready",
      rejectionReason: "PDP identity OK; ingredient + image evidence incomplete.",
    }),
    cand({
      productIdentity: "skin1004-madagascar-centella-soothing-cream",
      brand: "SKIN1004",
      normalizedProductName: "Madagascar Centella Soothing Cream",
      category: "cream",
      roleTags: ["rising"],
      trendEvidence: {
        present: true,
        notes: "Rising centella line popularity.",
        signals: ["rising_search"],
      },
      readiness: "trend_candidate",
      rejectionReason: "Trend signal only; catalog evidence incomplete for pilot.",
    }),
    cand({
      productIdentity: "torriden-dive-in-low-molecular-hyaluronic-acid-cream",
      brand: "Torriden",
      normalizedProductName: "Dive-In Low Molecular Hyaluronic Acid Cream",
      category: "cream",
      roleTags: ["rising", "value"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://torriden.com/",
        notes: "Brand site reachable.",
      },
      rejectionReason: "Catalog identity OK; INCI not extracted.",
    }),
    cand({
      productIdentity: "pyunkang-yul-ato-cream-deep-moisture",
      brand: "Pyunkang Yul",
      normalizedProductName: "ATO Cream Deep Moisture",
      category: "cream",
      roleTags: ["safety", "value"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Short INCI publicly listed; not paired with locked offer+image pack.",
      },
      rejectionReason: "INCI present but recommendation_ready package incomplete.",
    }),
    cand({
      productIdentity: "isntree-hyaluronic-acid-moist-cream",
      brand: "Isntree",
      normalizedProductName: "Hyaluronic Acid Moist Cream",
      category: "cream",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "PDP known; evidence pack incomplete.",
    }),
    cand({
      productIdentity: "round-lab-dokdo-cream",
      brand: "ROUND LAB",
      normalizedProductName: "Dokdo Cream",
      category: "cream",
      roleTags: ["emerging", "value"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; ingredients/image/offer not fully locked.",
    }),
  ]
);

const poolB = buildPool(
  {
    scenarioId: "pilot-dryness-barrier-serum",
    coreScenarioRef: "kr-dryness-barrier-essence",
    displayNameKo: "????? ??/??? (???)",
    notes:
      "Pilot scenarioId; coreScenarioRef = kr-dryness-barrier-essence. No recommendation_ready (honest).",
  },
  [
    cand({
      productIdentity: "cosrx-advanced-snail-96-mucin-power-essence",
      brand: "COSRX",
      normalizedProductName: "Advanced Snail 96 Mucin Power Essence",
      category: "essence",
      roleTags: ["popular"],
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: ["https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence"],
        notes: "Official ingredients listed; image evidence not archived for recommendation_ready.",
      },
      offerEvidence: {
        present: true,
        offerUrl: "https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence",
        notes: "Official PDP.",
      },
      imageEvidence: {
        present: false,
        sourceUrls: [],
        notes: "Image evidence missing for ready gate.",
      },
      readiness: "ingredient_candidate",
      rejectionReason: "INCI + offer OK; image evidence missing for recommendation_ready.",
    }),
    cand({
      productIdentity: "beauty-of-joseon-glow-serum-propolis-niacinamide",
      brand: "Beauty of Joseon",
      normalizedProductName: "Glow Serum Propolis + Niacinamide",
      category: "serum",
      roleTags: ["popular", "rising"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://beautyofjoseon.com/products/glow-serum",
        notes: "Official PDP reachable.",
      },
      rejectionReason: "PDP OK; INCI not extracted in pilot.",
    }),
    cand({
      productIdentity: "torriden-dive-in-serum",
      brand: "Torriden",
      normalizedProductName: "Dive-In Low Molecular Hyaluronic Acid Serum",
      category: "serum",
      roleTags: ["rising", "value"],
      readiness: "catalog_ready",
      rejectionReason: "Catalog identity; evidence incomplete.",
    }),
    cand({
      productIdentity: "aestura-atobarrier365-hydro-essence",
      brand: "AESTURA",
      normalizedProductName: "Atobarrier 365 Hydro Essence",
      category: "essence",
      roleTags: ["safety"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Ceramide essence INCI known; not full ready pack.",
      },
      rejectionReason: "INCI candidate; offer/image not locked.",
    }),
    cand({
      productIdentity: "isntree-hyaluronic-acid-water-essence",
      brand: "Isntree",
      normalizedProductName: "Hyaluronic Acid Water Essence",
      category: "essence",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "Known product; incomplete evidence.",
    }),
    cand({
      productIdentity: "skin1004-madagascar-centella-ampoule",
      brand: "SKIN1004",
      normalizedProductName: "Madagascar Centella Ampoule",
      category: "ampoule",
      roleTags: ["popular", "rising"],
      readiness: "trend_candidate",
      trendEvidence: {
        present: true,
        notes: "High visibility centella ampoule.",
        signals: ["rising_search"],
      },
      rejectionReason: "Trend-led; catalog/INCI package incomplete.",
    }),
    cand({
      productIdentity: "mixsoon-bean-essence",
      brand: "mixsoon",
      normalizedProductName: "Bean Essence",
      category: "essence",
      roleTags: ["emerging"],
      readiness: "trend_candidate",
      rejectionReason: "Emerging trend product; verification incomplete.",
    }),
    cand({
      productIdentity: "iunik-beta-glucan-power-moisture-serum",
      brand: "iUNIK",
      normalizedProductName: "Beta-Glucan Power Moisture Serum",
      category: "serum",
      roleTags: ["value", "safety"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; evidence incomplete.",
    }),
    cand({
      productIdentity: "anua-heartleaf-80-soothing-ampoule",
      brand: "Anua",
      normalizedProductName: "Heartleaf 80% Soothing Ampoule",
      category: "ampoule",
      roleTags: ["rising"],
      readiness: "catalog_ready",
      rejectionReason: "PDP known; INCI not extracted.",
    }),
    cand({
      productIdentity: "round-lab-birch-juice-moisturizing-serum",
      brand: "ROUND LAB",
      normalizedProductName: "Birch Juice Moisturizing Serum",
      category: "serum",
      roleTags: ["emerging", "value"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; evidence incomplete.",
    }),
  ]
);

const poolC = buildPool(
  {
    scenarioId: "kr-acne-pores-toner",
    displayNameKo: "?????? ??",
  },
  [
    cand({
      productIdentity: "cosrx-aha-bha-clarifying-treatment-toner",
      brand: "COSRX",
      normalizedProductName: "AHA/BHA Clarifying Treatment Toner",
      category: "toner",
      roleTags: ["popular"],
      cautionIngredients: ["AHA", "BHA"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: ["https://www.cosrx.com/"],
        notes: "Actives known; full ready pack not completed.",
      },
      rejectionReason: "INCI candidate; image/offer pack incomplete for recommendation_ready.",
    }),
    cand({
      productIdentity: "some-by-mi-aha-bha-pha-30-days-miracle-toner",
      brand: "Some By Mi",
      normalizedProductName: "AHA BHA PHA 30 Days Miracle Toner",
      category: "toner",
      roleTags: ["popular", "value"],
      cautionIngredients: ["AHA", "BHA", "PHA"],
      readiness: "catalog_ready",
      rejectionReason: "PDP known; INCI not extracted in pilot.",
    }),
    cand({
      productIdentity: "anua-heartleaf-77-soothing-toner",
      brand: "Anua",
      normalizedProductName: "Heartleaf 77% Soothing Toner",
      category: "toner",
      roleTags: ["rising", "popular"],
      readiness: "catalog_ready",
      rejectionReason: "High visibility; evidence pack incomplete.",
    }),
    cand({
      productIdentity: "beauty-of-joseon-green-plum-refreshing-toner",
      brand: "Beauty of Joseon",
      normalizedProductName: "Green Plum Refreshing Toner AHA + BHA",
      category: "toner",
      roleTags: ["rising"],
      cautionIngredients: ["AHA", "BHA"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://beautyofjoseon.com/",
        notes: "Brand catalog.",
      },
      rejectionReason: "Catalog ready; INCI not extracted.",
    }),
    cand({
      productIdentity: "isntree-green-tea-fresh-toner",
      brand: "Isntree",
      normalizedProductName: "Green Tea Fresh Toner",
      category: "toner",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; incomplete evidence.",
    }),
    cand({
      productIdentity: "round-lab-dokdo-toner",
      brand: "ROUND LAB",
      normalizedProductName: "Dokdo Toner",
      category: "toner",
      roleTags: ["safety", "value"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Mineral toner INCI commonly published; not full ready pack.",
      },
      rejectionReason: "INCI candidate only.",
    }),
    cand({
      productIdentity: "pyunkang-yul-essence-toner",
      brand: "Pyunkang Yul",
      normalizedProductName: "Essence Toner",
      category: "toner",
      roleTags: ["safety"],
      readiness: "catalog_ready",
      rejectionReason: "Minimalist toner; evidence incomplete.",
    }),
    cand({
      productIdentity: "haruharu-wonder-black-rice-hyaluronic-toner",
      brand: "haruharu wonder",
      normalizedProductName: "Black Rice Hyaluronic Toner",
      category: "toner",
      roleTags: ["rising"],
      readiness: "trend_candidate",
      rejectionReason: "Trend visibility; verification incomplete.",
    }),
    cand({
      productIdentity: "celimax-dual-barrier-creamy-toner",
      brand: "celimax",
      normalizedProductName: "Dual Barrier Creamy Toner",
      category: "toner",
      roleTags: ["emerging", "safety"],
      readiness: "catalog_ready",
      rejectionReason: "Barrier toner; INCI not extracted.",
    }),
    cand({
      productIdentity: "numbuzin-no3-super-glowing-essence-toner",
      brand: "numbuzin",
      normalizedProductName: "No.3 Super Glowing Essence Toner",
      category: "toner",
      roleTags: ["emerging"],
      readiness: "trend_candidate",
      rejectionReason: "Emerging; incomplete catalog evidence.",
    }),
  ]
);

const poolD = buildPool(
  {
    scenarioId: "kr-uv-sunscreen-sensitive",
    displayNameKo: "?? ?? ???",
    notes:
      "ROUND LAB birch = ingredient_candidate (KR vs US filter SKU conflict). BOJ Relief Sun = catalog_ready (PDP OK, INCI not extracted).",
  },
  [
    cand({
      productIdentity: "round-lab-birch-juice-moisturizing-sunscreen",
      brand: "ROUND LAB",
      normalizedProductName: "Birch Juice Moisturizing Sunscreen",
      category: "sunscreen",
      roleTags: ["popular", "safety"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes:
          "KR formula filters differ from US-marketed SKU; regional conflict blocks recommendation_ready.",
      },
      offerEvidence: {
        present: true,
        offerUrl: "https://roundlab.com/",
        notes: "PDP reachable; SKU region must be disambiguated.",
      },
      imageEvidence: {
        present: true,
        sourceUrls: [],
        notes: "Images exist but may depict region-specific packaging.",
      },
      rejectionReason:
        "KR vs US filter / SKU conflict ? keep as ingredient_candidate until regional SKU resolved.",
      cautionIngredients: ["UV_filters_region_specific"],
    }),
    cand({
      productIdentity: "beauty-of-joseon-relief-sun-rice-probiotics",
      brand: "Beauty of Joseon",
      normalizedProductName: "Relief Sun Rice + Probiotics",
      category: "sunscreen",
      roleTags: ["popular", "rising"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://beautyofjoseon.com/products/relief-sun-rice-probiotics",
        notes: "PDP reachable; INCI not extracted in this pilot.",
      },
      rejectionReason: "PDP reachable; INCI not extracted ? catalog_ready (not recommendation_ready).",
    }),
    cand({
      productIdentity: "isntree-hyaluronic-acid-watery-sun-gel",
      brand: "Isntree",
      normalizedProductName: "Hyaluronic Acid Watery Sun Gel",
      category: "sunscreen",
      roleTags: ["popular", "value"],
      readiness: "catalog_ready",
      rejectionReason: "Known KR sunscreen; evidence pack incomplete.",
    }),
    cand({
      productIdentity: "skin1004-hyalu-cica-water-fit-sun-serum",
      brand: "SKIN1004",
      normalizedProductName: "Hyalu-Cica Water-Fit Sun Serum",
      category: "sunscreen",
      roleTags: ["rising"],
      readiness: "trend_candidate",
      rejectionReason: "Rising product; verification incomplete.",
    }),
    cand({
      productIdentity: "torriden-dive-in-mild-suncream",
      brand: "Torriden",
      normalizedProductName: "Dive-In Mild Suncream",
      category: "sunscreen",
      roleTags: ["rising", "safety"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; INCI not extracted.",
    }),
    cand({
      productIdentity: "cosrx-aloe-soothing-sun-cream",
      brand: "COSRX",
      normalizedProductName: "Aloe Soothing Sun Cream SPF50+",
      category: "sunscreen",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "Catalog identity; incomplete evidence.",
    }),
    cand({
      productIdentity: "drg-green-mild-up-sun-plus",
      brand: "Dr.G",
      normalizedProductName: "Green Mild Up Sun+",
      category: "sunscreen",
      roleTags: ["safety"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Dermocosmetic sunscreen; filters need KR SKU confirm.",
      },
      rejectionReason: "INCI candidate; regional/filter confirm pending.",
    }),
    cand({
      productIdentity: "make-prem-uv-defense-me-blue-ray-sun-fluid",
      brand: "Make P:rem",
      normalizedProductName: "UV Defense Me Blue Ray Sun Fluid",
      category: "sunscreen",
      roleTags: ["emerging"],
      readiness: "trend_candidate",
      rejectionReason: "Emerging; incomplete evidence.",
    }),
    cand({
      productIdentity: "celimax-oil-control-cooling-suncream",
      brand: "celimax",
      normalizedProductName: "Oil Control Cooling Suncream",
      category: "sunscreen",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; incomplete evidence.",
    }),
    cand({
      productIdentity: "aestura-derma-uv-365-barrier-hydro-sunscreen",
      brand: "AESTURA",
      normalizedProductName: "Derma UV 365 Barrier Hydro Sunscreen",
      category: "sunscreen",
      roleTags: ["safety"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Sensitive-skin sunscreen line; full ready pack not completed.",
      },
      rejectionReason: "INCI candidate; offer/image not locked for recommendation_ready.",
    }),
  ]
);

const poolE = buildPool(
  {
    scenarioId: "kr-aging-eye-cream",
    displayNameKo: "??? ????",
  },
  [
    cand({
      productIdentity: "cosrx-advanced-snail-peptide-eye-cream",
      brand: "COSRX",
      normalizedProductName: "Advanced Snail Peptide Eye Cream",
      category: "eye_cream",
      roleTags: ["popular"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://www.cosrx.com/",
        notes: "Brand catalog.",
      },
      rejectionReason: "PDP known; INCI/image not fully locked.",
    }),
    cand({
      productIdentity: "beauty-of-joseon-revive-eye-serum",
      brand: "Beauty of Joseon",
      normalizedProductName: "Revive Eye Serum Ginseng + Retinal",
      category: "eye_cream",
      roleTags: ["popular", "rising"],
      cautionIngredients: ["retinal"],
      readiness: "catalog_ready",
      offerEvidence: {
        present: true,
        offerUrl: "https://beautyofjoseon.com/",
        notes: "Official catalog; retinal caution for sensitive users.",
      },
      rejectionReason: "PDP OK; INCI not extracted in pilot.",
    }),
    cand({
      productIdentity: "illiyoon-ceramide-ato-eye-cream",
      brand: "Illiyoon",
      normalizedProductName: "Ceramide Ato Eye Cream",
      category: "eye_cream",
      roleTags: ["safety", "value"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Ceramide eye cream INCI commonly listed.",
      },
      rejectionReason: "INCI candidate; ready pack incomplete.",
    }),
    cand({
      productIdentity: "pyunkang-yul-eye-cream",
      brand: "Pyunkang Yul",
      normalizedProductName: "Eye Cream",
      category: "eye_cream",
      roleTags: ["value", "safety"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; incomplete evidence.",
    }),
    cand({
      productIdentity: "drjart-ceramidin-eye-cream",
      brand: "Dr.Jart+",
      normalizedProductName: "Ceramidin Eye Cream",
      category: "eye_cream",
      roleTags: ["popular"],
      readiness: "catalog_ready",
      rejectionReason: "Catalog ready; INCI not extracted.",
    }),
    cand({
      productIdentity: "laneige-perfect-renew-youth-regenerator-eye-cream",
      brand: "Laneige",
      normalizedProductName: "Perfect Renew Youth Regenerator Eye Cream",
      category: "eye_cream",
      roleTags: ["popular"],
      readiness: "trend_candidate",
      rejectionReason: "Brand-known SKU; pilot evidence incomplete.",
    }),
    cand({
      productIdentity: "innisfree-green-tea-seed-eye-cream",
      brand: "Innisfree",
      normalizedProductName: "Green Tea Seed Eye Cream",
      category: "eye_cream",
      roleTags: ["value"],
      readiness: "catalog_ready",
      rejectionReason: "Identity OK; incomplete evidence.",
    }),
    cand({
      productIdentity: "sulwhasoo-concentrated-ginseng-renewing-eye-cream",
      brand: "Sulwhasoo",
      normalizedProductName: "Concentrated Ginseng Renewing Eye Cream",
      category: "eye_cream",
      roleTags: ["emerging", "popular"],
      readiness: "catalog_ready",
      rejectionReason: "Premium aging eye cream; evidence pack incomplete.",
    }),
    cand({
      productIdentity: "torriden-dive-in-eye-cream",
      brand: "Torriden",
      normalizedProductName: "Dive-In Eye Cream",
      category: "eye_cream",
      roleTags: ["rising"],
      readiness: "trend_candidate",
      rejectionReason: "Rising line extension; verification incomplete.",
    }),
    cand({
      productIdentity: "aestura-atobarrier365-eye-cream",
      brand: "AESTURA",
      normalizedProductName: "Atobarrier 365 Eye Cream",
      category: "eye_cream",
      roleTags: ["safety"],
      readiness: "ingredient_candidate",
      ingredientEvidence: {
        present: true,
        inciAvailable: true,
        sourceUrls: [],
        notes: "Barrier eye cream; not full recommendation_ready pack.",
      },
      rejectionReason: "INCI candidate; offer/image not locked.",
    }),
  ]
);

const pools = {
  "A-kr-redness-sensitive-cream.json": poolA,
  "B-pilot-dryness-barrier-serum.json": poolB,
  "C-kr-acne-pores-toner.json": poolC,
  "D-kr-uv-sunscreen-sensitive.json": poolD,
  "E-kr-aging-eye-cream.json": poolE,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const written = [];
for (const [file, pool] of Object.entries(pools)) {
  written.push(writeJson(file, pool));
}

const allIds = [];
const perScenario = {};
let recommendationReadyTotal = 0;
const readinessTotals = {};
for (const r of READINESS) readinessTotals[r] = 0;
for (const pool of Object.values(pools)) {
  perScenario[pool.scenarioId] = pool.metrics;
  recommendationReadyTotal += pool.metrics.recommendationReadyCount;
  for (const c of pool.candidates) {
    allIds.push(c.productIdentity);
    readinessTotals[c.readiness] += 1;
  }
}
const unique = new Set(allIds);
const reuseRate = allIds.length === 0 ? 0 : 1 - unique.size / allIds.length;
const summary = {
  pilotDate: CHECKED_AT,
  outputDir: "data/catalog/scenario-pilot/2026-07-22",
  scenarioFiles: Object.keys(pools),
  brandCapDefault: BRAND_CAP_DEFAULT,
  affiliateOrAdInScore: false,
  totals: {
    scenarioCount: Object.keys(pools).length,
    candidateSlots: allIds.length,
    uniqueProductIdentities: unique.size,
    reuseRate: Number(reuseRate.toFixed(4)),
    reuseCount: allIds.length - unique.size,
    recommendationReadyTotal,
    readinessTotals,
  },
  perScenario,
  honestyNotes: [
    "Few recommendation_ready by design ? only when identity + usable INCI + image + offer URL + no major conflict.",
    "Scenario A: COSRX Snail 92 cream + AESTURA Atobarrier365 cream marked recommendation_ready from prior official INCI research.",
    "ROUND LAB birch sunscreen: ingredient_candidate due to KR vs US filter SKU conflict.",
    "BOJ Relief Sun: catalog_ready (PDP reachable, INCI not extracted).",
    "Artifacts only ? no runtime/UI/DB/multiSource implementation in this pilot.",
  ],
};
written.push(writeJson("SUMMARY.json", summary));

const readme = [
  "# Scenario Top10 Pilot ? 2026-07-22",
  "",
  "Offline pilot artifacts for 5 recommendation scenarios (exactly 10 candidates each after filtering `unavailable`).",
  "",
  "## Purpose",
  "",
  "- Demonstrate honest Top10 pools with real KR products",
  "- Show low `recommendation_ready` rates when evidence is incomplete",
  "- Document multiSource gaps needed before runtime fill",
  "- **No** runtime wiring, UI, DB migration, or multiSource implementation",
  "",
  "## Files",
  "",
  "| File | scenarioId |",
  "|------|------------|",
  "| A-kr-redness-sensitive-cream.json | kr-redness-sensitive-cream |",
  "| B-pilot-dryness-barrier-serum.json | pilot-dryness-barrier-serum (coreScenarioRef: kr-dryness-barrier-essence) |",
  "| C-kr-acne-pores-toner.json | kr-acne-pores-toner |",
  "| D-kr-uv-sunscreen-sensitive.json | kr-uv-sunscreen-sensitive |",
  "| E-kr-aging-eye-cream.json | kr-aging-eye-cream |",
  "| SUMMARY.json | aggregate metrics |",
  "| README.md | this file |",
  "",
  "## Rules baked into artifacts",
  "",
  "- brandCapDefault = 2",
  "- affiliateOrAdInScore = false (never in organic score)",
  "- recommendation_ready only with identity + usable INCI + image + offer URL + no major conflict",
  "",
  "## multiSource needed features (list only ? not implemented)",
  "",
  "1. Retail PDP fetch with robots.txt respect",
  "2. INCI merge across sources",
  "3. Image evidence capture",
  "4. Offer freshness checks",
  "5. SKU regional conflict detection (sunscreen filters KR vs US)",
  "6. CAPTCHA/block detection ? switch source",
  "7. No affiliate / ad signals in organic score",
  "",
  "## Regen",
  "",
  "```bash",
  "node scripts/_gen-scenario-pilot-top10.cjs",
  "```",
  "",
  "Generator is kept for regeneration.",
  "",
  "## Validate",
  "",
  "```bash",
  "npm run test:recommendation-pilot",
  "```",
  "",
].join("\n");
writeUtf8(path.join(OUT_DIR, "README.md"), readme);
written.push(path.join(OUT_DIR, "README.md"));

console.log("Wrote", written.length, "files to", OUT_DIR);
console.log(JSON.stringify(summary.totals, null, 2));
