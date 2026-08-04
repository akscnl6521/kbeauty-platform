import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import { evaluateProductVerificationGate } from "@/lib/pipeline/product-verify/product-verify-gate";
import type { ProductQualityGrade } from "@/lib/pipeline/product-verify/product-verify-gate";
import { normalizeProductOffer } from "@/lib/recommend/productOffer";
import { validateIngredientList } from "@/lib/catalog/validateIngredientList";

/**
 * 한 번 검증됐다가 **내려진** 제품을 다시 공개한다.
 *
 * `verifyAndActivateProduct` 는 최초 검증 전용이다. 마지막 UPDATE 에
 * `.is("verified_at", null)` 이 걸려 있어서, 이미 검증 이력이 있는 제품은
 * 절대 건드리지 않는다. 그건 결함이 아니라 **사람이 내린 제품을 자동 실행이
 * 몰래 되살리지 못하게** 막는 가드다. 그 가드는 그대로 두고, 재활성화는
 * 여기서 별도로 처리한다.
 *
 * 다루는 상태는 하나뿐이다 — `active = false` 이면서 `verified_at` 이 있는 제품.
 *
 *   - 검증된 적 없는 제품(`verified_at` 이 null)은 여기서 처리하지 않는다.
 *     그건 최초 검증이고 `verifyAndActivateProduct` 의 몫이다.
 *   - 이미 활성인 제품은 손대지 않는다.
 *
 * 게이트는 최초 검증과 **똑같은 것**을 쓴다. 기준을 낮추지 않는다.
 * 성분 미매칭·모호 개수는 호출자가 실제로 세어 넘겨야 한다 — 넘기지 않으면
 * 0 으로 간주되어 `ingredient_unmatched` 조건이 발동하지 않는다(그 탓에 성분이
 * 절반도 안 맞는 제품이 공개된 적이 있다).
 */
export type ProductReactivationResult = {
  productId: number;
  reactivated: boolean;
  /** 왜 안 됐는지. 성공 시 null. */
  skippedReason: string | null;
  gateBlockers: string[];
  verifiedOfferCount: number;
};

const OFFICIAL_SOURCE_TYPES = new Set([
  "official_brand_page",
  "official_retailer",
  "official_label",
  "brand_csv",
]);

export async function reactivateVerifiedProduct(
  client: SupabaseClient,
  input: {
    productId: number;
    batchId: string;
    /** 실제로 센 값을 넘긴다. 기본값에 기대면 게이트가 무력해진다. */
    unmatchedIngredientCount: number;
    ambiguousIngredientCount: number;
    safetyConflict?: boolean;
    /** 품질 등급. 재활성화 시점에 다시 계산해 넘긴다. */
    qualityGrade: ProductQualityGrade;
  }
): Promise<ProductReactivationResult> {
  const op = loadPipelineOperationConfig();
  const empty = (reason: string): ProductReactivationResult => ({
    productId: input.productId,
    reactivated: false,
    skippedReason: reason,
    gateBlockers: [],
    verifiedOfferCount: 0,
  });

  const { data: productRow, error: readErr } = await client
    .from("products")
    .select("id, name, brand, active, verified_at, full_ingredients")
    .eq("id", input.productId)
    .maybeSingle();
  if (readErr || !productRow) return empty(`read_failed:${readErr?.code ?? "not_found"}`);

  const row = productRow as {
    active: boolean | null;
    verified_at: string | null;
    full_ingredients: unknown;
  };

  // 이 함수가 다루는 상태가 아니면 아무것도 하지 않는다.
  if (row.active === true) return empty("already_active");
  if (!row.verified_at) return empty("never_verified_use_initial_path");

  const { data: ingredientRows } = await client
    .from("product_ingredients")
    .select("id, source_url, source_type")
    .eq("product_id", input.productId)
    .limit(500);

  const officialStructured = (ingredientRows ?? []).filter((i) => {
    const r = i as { source_url: string | null; source_type: string | null };
    return r.source_url && r.source_type && OFFICIAL_SOURCE_TYPES.has(r.source_type);
  });

  const { data: offerRows } = await client
    .from("product_offers")
    .select(
      "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, last_checked_at, active"
    )
    .eq("product_id", input.productId)
    .limit(100);

  const offers = (offerRows ?? [])
    .map((r) => normalizeProductOffer(r))
    .filter((o): o is NonNullable<typeof o> => o != null);

  const verifiedInStock = offers.filter(
    (o) =>
      o.verificationStatus === "verified" &&
      o.stockStatus === "in_stock" &&
      o.price != null &&
      o.price > 0 &&
      o.currency &&
      o.verifiedAt &&
      o.purchaseUrl?.startsWith("https://") &&
      (o.shipsToCountries?.length ?? 0) > 0 &&
      o.active !== false
  );

  const fullIngredients = Array.isArray(row.full_ingredients)
    ? (row.full_ingredients as unknown[])
    : [];

  const gate = evaluateProductVerificationGate({
    active: row.active,
    verifiedAt: row.verified_at,
    qualityGrade: input.qualityGrade,
    allowedGrades: op.productVerifyQualityGrades as ProductQualityGrade[],
    hasOfficialIngredientsText: fullIngredients.length > 0,
    // 재활성화도 같은 기준이어야 한다 — 한쪽만 막으면 다른 경로로 오염이 들어온다.
    ingredientsTextValid: validateIngredientList(fullIngredients.map(String).join(", ")).ok,
    structuredOfficialIngredientCount: officialStructured.length,
    ambiguousIngredientCount: input.ambiguousIngredientCount,
    unmatchedIngredientCount: input.unmatchedIngredientCount,
    safetyConflict: input.safetyConflict ?? false,
    verifiedInStockOfferCount: verifiedInStock.length,
    countryEligibleOfferCount: verifiedInStock.filter(
      (o) => (o.shipsToCountries?.length ?? 0) > 0
    ).length,
    allowPublish: op.allowPublish,
    allowProductDemotion: op.allowProductDemotion,
  });

  if (!gate.canActivate) {
    return {
      productId: input.productId,
      reactivated: false,
      skippedReason: "gate_failed",
      gateBlockers: gate.blockers,
      verifiedOfferCount: verifiedInStock.length,
    };
  }

  // `verified_at` 은 덮어쓰지 않는다. 최초 검증 시점을 지우면 «언제 처음
  // 확인했는가» 라는 사실이 사라진다. 여기서 바꾸는 것은 공개 여부뿐이다.
  const { error: upErr } = await client
    .from("products")
    .update({ active: true })
    .eq("id", input.productId)
    .eq("active", false)
    .not("verified_at", "is", null);

  if (upErr) {
    return {
      productId: input.productId,
      reactivated: false,
      skippedReason: `update_failed:${upErr.message}`,
      gateBlockers: ["update_failed"],
      verifiedOfferCount: verifiedInStock.length,
    };
  }

  const { data: after } = await client
    .from("products")
    .select("active")
    .eq("id", input.productId)
    .maybeSingle();
  const reactivated = (after as { active?: boolean } | null)?.active === true;

  if (reactivated && op.allowAuditInsert) {
    // 재활성화는 사람이 내린 결정을 되돌리는 조작이다. 추적할 수 있어야 한다.
    await tryInsertWriteAudit(client, {
      action: "product_reactivated",
      productId: input.productId,
      actorRole: "admin",
      metadata: {
        via: "product_reactivate",
        batchId: input.batchId,
        qualityGrade: input.qualityGrade,
        verifiedOfferCount: verifiedInStock.length,
        unmatchedIngredientCount: input.unmatchedIngredientCount,
      },
      oldValue: { active: false, verified_at: row.verified_at },
    });
  }

  return {
    productId: input.productId,
    reactivated,
    skippedReason: reactivated ? null : "race_or_no_row",
    gateBlockers: [],
    verifiedOfferCount: verifiedInStock.length,
  };
}
