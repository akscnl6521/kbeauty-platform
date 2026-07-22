import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { CandidateProduct, Recommendation } from "../src/lib/recommend/types";
import type { ProductOffer } from "../src/lib/recommend/catalogTypes";
import { filterCandidatesByOfferAvailability } from "../src/lib/recommend/productOffer";
import { normalizeProductOffer } from "../src/lib/recommend/productOffer";
import { filterCandidatesBySafety } from "../src/lib/recommend/filterCandidatesBySafety";
import {
  buildScenarioPilotPreviewSamples,
  countRecommendationReadyInPool,
  getReadySlugsForScenario,
  isPilotInsufficientScenario,
  isRegionalSkuExcludedForKr,
  runScenarioPilotPhase2,
} from "../src/lib/recommend/scenarios/pilotPhase2";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const ROOT = process.cwd();

function loadEnvFile(name: string): Record<string, string> {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
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

function extractRef(url: string): string {
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? "";
}

type ProductRow = {
  id: string;
  slug: string | null;
  name: string | null;
  name_ko: string | null;
  name_ja: string | null;
  brand: string | null;
  category: string | null;
  skin_concern: string | string[] | null;
  skin_tone: string | string[] | null;
  key_ingredients: string[] | string | null;
  key_ingredients_ja: string[] | string | null;
  price_usd: number | null;
  recommendation_reason: string | null;
  recommendation_reason_ko: string | null;
  recommendation_reason_ja: string | null;
  active: boolean | null;
  verified_at: string | null;
};

type MediaRow = {
  product_id: string;
  image_url: string | null;
  validation_status: string | null;
  is_primary: boolean | null;
  is_fixture: boolean | null;
};

type ProductIngredientRow = {
  product_id: string;
};

function toCandidateProduct(
  row: ProductRow,
  offers: ProductOffer[],
  mediaUrl: string | null
): CandidateProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    name_ko: row.name_ko,
    name_ja: row.name_ja,
    brand: row.brand,
    category: row.category,
    skin_concern: row.skin_concern,
    skin_tone: row.skin_tone,
    key_ingredients: row.key_ingredients,
    key_ingredients_ja: row.key_ingredients_ja,
    price_usd: row.price_usd,
    recommendation_reason: row.recommendation_reason,
    recommendation_reason_ko: row.recommendation_reason_ko,
    recommendation_reason_ja: row.recommendation_reason_ja,
    image_url: mediaUrl,
    image_verified: Boolean(mediaUrl),
    offers,
  };
}

function normalizeIdentityKey(row: ProductRow): string {
  return [
    row.brand ?? "",
    row.name_ko ?? row.name ?? "",
    row.category ?? "",
  ]
    .join("||")
    .trim()
    .toLowerCase();
}

async function main() {
  const env = {
    ...loadEnvFile(".env.staging"),
    ...loadEnvFile(".env.preview.staging"),
    ...loadEnvFile(".env.local"),
    ...process.env,
  };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.STAGING_SUPABASE_URL || "";
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = extractRef(url) || env.SUPABASE_PROJECT_REF || "";

  if (!url || !key) throw new Error("missing staging url or service role");
  if (ref === PROD_REF) throw new Error("production ref blocked");
  if (ref !== STAGING_REF) {
    throw new Error(`unexpected staging ref: ${ref || "missing"}`);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scenarioSamples = buildScenarioPilotPreviewSamples();
  const results: Array<Record<string, unknown>> = [];
  const failures: string[] = [];

  for (const sample of scenarioSamples) {
    const matchScenarioId = {
      A: "kr-redness-sensitive-cream",
      B: "pilot-dryness-barrier-serum",
      C: "kr-acne-pores-toner",
      D: "kr-uv-sunscreen-sensitive",
      E: "kr-aging-eye-cream",
    }[sample.id];

    const readySlugs = getReadySlugsForScenario(matchScenarioId);
    const filteredReadySlugs = readySlugs.filter(
      (slug) => !isRegionalSkuExcludedForKr(slug)
    );

    const { data: productRowsRaw, error: productError } = await admin
      .from("products")
      .select(
        "id, slug, name, name_ko, name_ja, brand, category, skin_concern, skin_tone, key_ingredients, key_ingredients_ja, price_usd, recommendation_reason, recommendation_reason_ko, recommendation_reason_ja, active, verified_at"
      )
      .in("slug", filteredReadySlugs);
    if (productError) throw productError;
    const productRows = (productRowsRaw ?? []) as ProductRow[];

    const productIds = productRows.map((row) => row.id);
    const rowsBySlug = new Map(
      productRows
        .filter((row) => row.slug)
        .map((row) => [String(row.slug).trim().toLowerCase(), row] as const)
    );

    const { data: offerRowsRaw, error: offerError } = productIds.length
      ? await admin
          .from("product_offers")
          .select(
            "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, last_checked_at, active"
          )
          .in("product_id", productIds)
      : { data: [], error: null };
    if (offerError) throw offerError;
    const offerRows = (offerRowsRaw ?? [])
      .map((row) => normalizeProductOffer(row))
      .filter((row): row is ProductOffer => Boolean(row));
    const offersByProductId = new Map<string, ProductOffer[]>();
    for (const offer of offerRows) {
      const list = offersByProductId.get(String(offer.productId)) ?? [];
      list.push(offer);
      offersByProductId.set(String(offer.productId), list);
    }

    const { data: mediaRowsRaw, error: mediaError } = productIds.length
      ? await admin
          .from("catalog_product_media")
          .select("product_id, image_url, validation_status, is_primary, is_fixture")
          .in("product_id", productIds)
          .eq("validation_status", "verified")
          .eq("is_fixture", false)
          .order("is_primary", { ascending: false })
      : { data: [], error: null };
    if (mediaError) throw mediaError;
    const mediaRows = (mediaRowsRaw ?? []) as MediaRow[];
    const mediaByProductId = new Map<string, string>();
    for (const row of mediaRows) {
      const pid = String(row.product_id);
      const url = String(row.image_url ?? "").trim();
      if (!pid || !url || mediaByProductId.has(pid)) continue;
      mediaByProductId.set(pid, url);
    }

    const { data: ingredientRowsRaw, error: ingredientError } = productIds.length
      ? await admin
          .from("product_ingredients")
          .select("product_id")
          .in("product_id", productIds)
      : { data: [], error: null };
    if (ingredientError) throw ingredientError;
    const ingredientRows = (ingredientRowsRaw ?? []) as ProductIngredientRow[];
    const ingredientCountByProductId = new Map<string, number>();
    for (const row of ingredientRows) {
      const pid = String(row.product_id);
      ingredientCountByProductId.set(pid, (ingredientCountByProductId.get(pid) ?? 0) + 1);
    }

    const exclusions: Array<{ slug: string; reasons: string[] }> = [];
    const rowPresentRows: ProductRow[] = [];
    const activeVerifiedRows: ProductRow[] = [];

    for (const slug of filteredReadySlugs) {
      const reasons: string[] = [];
      const row = rowsBySlug.get(slug);
      if (!row) {
        reasons.push("products_row_missing");
      } else {
        rowPresentRows.push(row);
        const activeVerified =
          row.active === true && Boolean(row.verified_at);
        if (!activeVerified) {
          if (row.active !== true) reasons.push("product_not_active");
          if (!row.verified_at) reasons.push("product_not_verified");
        } else {
          activeVerifiedRows.push(row);
        }
        if (!mediaByProductId.get(String(row.id))) {
          reasons.push("verified_image_missing");
        }
        const hasIngredientEvidence =
          (Array.isArray(row.key_ingredients) && row.key_ingredients.length > 0) ||
          (Array.isArray(row.key_ingredients_ja) && row.key_ingredients_ja.length > 0) ||
          (ingredientCountByProductId.get(row.id) ?? 0) > 0;
        if (!hasIngredientEvidence) reasons.push("ingredient_or_safety_evidence_missing");
      }

      if (row) {
        const offers = offersByProductId.get(String(row.id)) ?? [];
        const { eligible } = filterCandidatesByOfferAvailability(
          [
            toCandidateProduct(
              row,
              offers,
              mediaByProductId.get(String(row.id)) ?? null
            ),
          ],
          "KR"
        );
        if (eligible.length === 0) reasons.push("kr_verified_offer_missing");
      }

      if (reasons.length > 0) {
        exclusions.push({ slug, reasons });
      }
    }

    const identityKeys = new Map<string, string[]>();
    for (const row of activeVerifiedRows) {
      const key2 = normalizeIdentityKey(row);
      const list = identityKeys.get(key2) ?? [];
      list.push(row.slug ?? row.id);
      identityKeys.set(key2, list);
    }
    const duplicateIdentity = [...identityKeys.entries()]
      .filter(([, slugs]) => slugs.length > 1)
      .map(([identity, slugs]) => ({ identity, slugs }));

    const stageCandidates = activeVerifiedRows.map((row) =>
      toCandidateProduct(
        row,
        offersByProductId.get(String(row.id)) ?? [],
        mediaByProductId.get(String(row.id)) ?? null
      )
    );
    const offerPass = filterCandidatesByOfferAvailability(stageCandidates, "KR").eligible;
    const safetyPass = filterCandidatesBySafety(
      offerPass,
      sample.recommendation as Recommendation
    ).safe;

    const runtime = await runScenarioPilotPhase2({
      recommendation: sample.recommendation,
      fetchCandidatesBySlugs: async (slugs) =>
        slugs
          .map((slug) => rowsBySlug.get(slug))
          .filter((row): row is ProductRow => Boolean(row))
          .map((row) =>
            toCandidateProduct(
              row,
              offersByProductId.get(String(row.id)) ?? [],
              mediaByProductId.get(String(row.id)) ?? null
            )
          ),
    });

    let metExpectation = true;
    if (sample.expectation === "recommendations_ready") {
      metExpectation =
        runtime.status === "ok" &&
        runtime.ranked.length >= 3 &&
        runtime.ranked.length <= 5;
      if (!metExpectation) {
        failures.push(
          `${sample.id}: expected 3-5 recommendations, got status=${runtime.status} count=${runtime.ranked.length}`
        );
      }
    } else {
      metExpectation =
        runtime.status === "insufficient_verified_candidates" &&
        runtime.ranked.length === 0 &&
        isPilotInsufficientScenario(matchScenarioId) === true;
      if (!metExpectation) {
        failures.push(
          `${sample.id}: expected insufficient_verified_candidates, got status=${runtime.status} count=${runtime.ranked.length}`
        );
      }
    }

    results.push({
      scenario: sample.id,
      label: sample.label,
      scenarioId: matchScenarioId,
      expectedOutcome: sample.expectation,
      metExpectation,
      poolReadyCount: countRecommendationReadyInPool(matchScenarioId),
      stagingProductIntersectionCount: rowPresentRows.length,
      activeVerifiedCount: activeVerifiedRows.length,
      krOfferPassCount: offerPass.length,
      safetyPassCount: safetyPass.length,
      finalRecommendationCount: runtime.ranked.length,
      status: runtime.status,
      verifiedCount: runtime.snapshot.verifiedCount ?? null,
      duplicateProductIdentityCount: duplicateIdentity.length,
      duplicateProductIdentity: duplicateIdentity,
      excludedSlugs: exclusions,
      ranked: runtime.ranked.map((row, index) => ({
        rank: index + 1,
        slug: row.product.slug,
        brand: row.product.brand,
        nameKo: row.product.name_ko,
        matchedIngredients: row.matchedIngredients,
      })),
      message: runtime.snapshot.userMessageKo ?? null,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        phase: "scenario_phase21_staging_validation",
        dbMode: "SELECT_ONLY",
        projectRef: `${STAGING_REF.slice(0, 4)}***${STAGING_REF.slice(-3)}`,
        failures,
        results,
      },
      null,
      2
    )
  );
  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        phase: "scenario_phase21_staging_validation",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
