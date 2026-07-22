/**
 * Phase 2.2 dry-run: inspect Staging for 6 missing A/B/C slugs.
 * SELECT-only. Abort on Production.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";

const ROOT = process.cwd();
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const ARTIFACT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/products.json"
);
const OUT = path.join(
  ROOT,
  "data/catalog/scenario-pilot-enrichment-de/2026-07-22/phase22-dry-run.json"
);

const TARGETS = [
  {
    slug: "aestura-atobarrier365-cream",
    scenarios: ["A", "B"],
    nameKo: "아토베리어365 크림",
    volume: "80ml",
    krOfferCandidate: {
      retailer_name: "AESTURA 공식몰",
      purchase_url: "https://www.aestura.com/web/product/view.do?prdSeq=1021",
      price: 33000,
      currency: "KRW",
      stock_status: "unknown_needs_confirm",
      is_official: true,
      note: "공식몰 페이지에 장바구니/구매 UI 확인. 품절 문구는 미확인.",
    },
  },
  {
    slug: "round-lab-dokdo-cream",
    scenarios: ["A", "B"],
    nameKo: "1025 독도 크림",
    volume: "80ml",
    krOfferCandidate: {
      retailer_name: "ROUND LAB 공식몰",
      purchase_url:
        "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%81%AC%EB%A6%BC-80ml/24/",
      price: 25600,
      currency: "KRW",
      stock_status: "out_of_stock",
      is_official: true,
      note: "공식몰 페이지에 '품 절/SOLD OUT' 흔적 — in_stock 승격 금지.",
    },
  },
  {
    slug: "torriden-dive-in-serum",
    scenarios: ["A", "B"],
    nameKo: "다이브인 저분자 히알루론산 세럼",
    volume: "50ml",
    krOfferCandidate: {
      retailer_name: null,
      purchase_url: null,
      price: null,
      currency: "KRW",
      stock_status: "hold",
      is_official: false,
      note: "토리든 공식몰 구매 불가. 올리브영 등 KR in-stock URL/가격 미확정 — offer 보류.",
    },
  },
  {
    slug: "skin1004-madagascar-centella-ampoule",
    scenarios: ["B"],
    nameKo: "마다가스카르 센텔라 앰플",
    volume: "100ml",
    krOfferCandidate: {
      retailer_name: "SKIN1004 네이버 브랜드스토어",
      purchase_url: "https://brand.naver.com/skin1004/products/253640353",
      price: 17600,
      currency: "KRW",
      stock_status: "unknown_needs_confirm",
      is_official: true,
      note: "공식 브랜드스토어. 가격은 검색 근거 17600원 — 페이지에서 재고/가격 재확인 필요.",
    },
  },
  {
    slug: "beauty-of-joseon-green-plum-refreshing-toner",
    scenarios: ["C"],
    nameKo: "청매실 AHA BHA 토너",
    volume: "150ml",
    krOfferCandidate: {
      retailer_name: "조선미녀 공식몰",
      purchase_url:
        "https://beautyofjoseon.co.kr/product/%EC%B2%AD%EB%A7%A4%EC%8B%A4-aha-bha-%ED%86%A0%EB%84%88/31/",
      price: 18000,
      currency: "KRW",
      stock_status: "out_of_stock",
      is_official: true,
      note: "공식몰 SOLD OUT 확인. in_stock 승격 금지.",
    },
  },
  {
    slug: "haruharu-wonder-black-rice-hyaluronic-toner",
    scenarios: ["C"],
    nameKo: "블랙라이스 히알루로닉 토너",
    volume: "150ml",
    krOfferCandidate: {
      retailer_name: null,
      purchase_url: null,
      price: null,
      currency: "KRW",
      stock_status: "hold",
      is_official: false,
      note: "글로벌몰 sold out. KR in-stock 구매 URL/가격 미확정 — offer 보류.",
    },
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
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function extractRef(url) {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? "";
}

function mask(ref) {
  if (!ref || ref.length < 8) return String(ref || "");
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
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
  console.error("ABORT Production");
  process.exit(2);
}
if (ref !== STAGING_REF) {
  console.error("ABORT unexpected ref", mask(ref));
  process.exit(2);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
const client = createClient(url, key, { auth: { persistSession: false } });

const slugs = TARGETS.map((t) => t.slug);
const { data: existing, error } = await client
  .from("products")
  .select("id,slug,brand,name,name_ko,category,active,verified_at,key_ingredients,full_ingredients")
  .in("slug", slugs);
if (error) throw error;

const bySlug = new Map((existing || []).map((r) => [r.slug, r]));

const plans = [];
for (const t of TARGETS) {
  const art = artifact.products.find((p) => p.externalProductId === t.slug);
  const parsed = parseIngredientList(art?.ingredientsRaw || "");
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((x) => ({
      token: x.token,
      normalizedName: x.normalizedName,
      order: x.order,
    }))
  );
  const imageUrl = art?.images?.[0]?.imageUrl || null;
  const exists = bySlug.get(t.slug) || null;
  const offerOk =
    t.krOfferCandidate.stock_status === "in_stock" &&
    t.krOfferCandidate.price != null &&
    t.krOfferCandidate.purchase_url;

  const plan = {
    slug: t.slug,
    scenarios: t.scenarios,
    exists: Boolean(exists),
    existingId: exists?.id ?? null,
    action: exists ? "update_enrich_only" : "insert",
    product: {
      brand: art?.brand,
      name: art?.productName,
      name_ko: t.nameKo,
      category: art?.productIdentity?.category,
      volume: t.volume,
      active: true,
      verified_at: "set_now_if_offer_ready_else_set_with_hold_note",
      data_confidence: "official_brand_inci_artifact_2026-07-22",
      full_ingredients_count: parsed.normalized.length,
      key_ingredients: keys.map((k) => k.tokenFromList),
      source_url: art?.officialUrl,
      ingredient_status_planned: "verified",
      ingredient_evidence: art?.ingredientEvidences?.[0] || null,
      caution: art?.cautionIngredients || [],
    },
    media: {
      action: exists ? "insert_if_missing_primary" : "insert",
      imageUrl,
      sourcePageUrl: art?.images?.[0]?.sourcePageUrl || art?.officialUrl,
      trust: art?.images?.[0]?.trust,
      isOfficialSource: art?.images?.[0]?.isOfficialSource === true,
    },
    offer: {
      action: offerOk
        ? exists
          ? "insert_kr_if_missing"
          : "insert_kr"
        : "SKIP_or_out_of_stock_only",
      candidate: t.krOfferCandidate,
      recommendationGatePass: Boolean(offerOk),
    },
    ingredientsLink: {
      action: "upsert_product_ingredients_from_full_list",
      count: parsed.normalized.length,
    },
    missingFields: [
      !imageUrl ? "representative_image" : null,
      parsed.normalized.length === 0 ? "full_ingredients" : null,
      !offerOk ? "kr_verified_in_stock_offer" : null,
      keys.length === 0 ? "key_ingredients" : null,
    ].filter(Boolean),
    duplicateRisk: {
      slugExact: Boolean(exists),
      brandNameCollisionCheck: "required_at_write",
    },
    hold: !offerOk,
  };
  plans.push(plan);
}

const report = {
  phase: "2.2-dry-run",
  projectRef: mask(ref),
  productionWrite: 0,
  mode: "SELECT_ONLY",
  summary: {
    total: plans.length,
    insert: plans.filter((p) => p.action === "insert").length,
    update: plans.filter((p) => p.action === "update_enrich_only").length,
    mediaInsert: plans.filter((p) => p.media.action !== "skip").length,
    offerInsertReady: plans.filter((p) => p.offer.recommendationGatePass).length,
    holdNoKrInStockOffer: plans.filter((p) => p.hold).length,
  },
  plans,
  blockers: plans
    .filter((p) => p.hold)
    .map((p) => ({
      slug: p.slug,
      reason: p.offer.candidate.note,
      stock: p.offer.candidate.stock_status,
    })),
  rollback: [
    "Write는 product id 목록을 phase22-write-result.json에 기록한다.",
    "Rollback(비파괴 권장): 신규 product_id에 대해 active=false, verified_at=null 로만 비활성 (DELETE/TRUNCATE 금지).",
    "신규 offer/media는 product_id 기준으로 active=false 또는 validation_status 유지하되 DELETE 금지.",
    "Production 절대 미적용.",
  ],
  writeDecision:
    "현재 KR verified+in_stock offer가 확정된 제품이 0건이므로, dry-run 기준 즉시 recommendation_ready Top3 write는 위험. 재고 확인된 제품만 offer verified+in_stock으로 등록하고, 나머지는 제품/이미지/성분은 등록하되 offer는 out_of_stock 또는 생략.",
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
