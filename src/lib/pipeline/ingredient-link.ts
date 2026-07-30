import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import {
  attachIngredientMatches,
  buildIngredientLookupMaps,
  type IngredientAliasRow,
  type IngredientDictionaryRow,
  type IngredientLookupMaps,
} from "@/lib/pipeline/ingredient-normalize";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import type { IngredientParseResult } from "@/lib/pipeline/types";

export type IngredientLinkResult = {
  linked: number;
  unmatched: number;
  ambiguous: number;
  queueCreated: boolean;
  skippedReason: string | null;
};

async function loadIngredientMaps(
  client: SupabaseClient
): Promise<IngredientLookupMaps> {
  const { data: ingredients } = await client
    .from("ingredients")
    .select("id, slug, name_en, name_ko")
    .limit(5000);

  const { data: aliases } = await client
    .from("ingredient_aliases")
    .select("ingredient_id, normalized_alias, alias, active")
    .eq("active", true)
    .limit(8000);

  // 키 생성 규칙은 토큰 쪽과 공유한다. 여기서 소문자화만 하면
  // `Polyquaternium-10` 과 토큰 `폴리쿼터늄 10` 이 영영 만나지 못한다.
  const maps = buildIngredientLookupMaps(
    (ingredients ?? []) as IngredientDictionaryRow[],
    (aliases ?? []) as IngredientAliasRow[]
  );

  if (maps.collisions.length > 0) {
    // 중복 행은 해당 키를 통째로 버려 미매칭으로 보낸다. 조용히 한쪽을
    // 고르는 것보다 낫지만, 사전에 정리할 중복이 남았다는 신호이기도 하다.
    console.warn(
      `[ingredient dictionary] 중복 키 ${maps.collisions.length}건을 매칭에서 제외했다:`,
      maps.collisions.slice(0, 20)
    );
  }

  const { bySlug, byNameEn, byNameKo, byAlias } = maps;
  return { bySlug, byNameEn, byNameKo, byAlias };
}

/**
 * Link parsed ingredients to product_ingredients (idempotent).
 * Never creates unverified ingredients unless explicitly allowed (default false).
 */
export async function linkProductIngredients(
  client: SupabaseClient,
  input: {
    productId: number;
    variantId?: string | null;
    parsed: IngredientParseResult;
    sourceUrl: string;
    batchId: string;
  }
): Promise<IngredientLinkResult> {
  const op = loadPipelineOperationConfig();
  if (!op.allowProductIngredientInsert) {
    return {
      linked: 0,
      unmatched: 0,
      ambiguous: 0,
      queueCreated: false,
      skippedReason: "allowProductIngredientInsert=false",
    };
  }

  const maps = await loadIngredientMaps(client);
  const matched = attachIngredientMatches(input.parsed, maps);
  const threshold = op.ingredientMatchThreshold;

  let linked = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (const item of matched.normalized) {
    if (item.matchKind === "ambiguous") {
      ambiguous += 1;
      continue;
    }
    if (
      item.matchedIngredientId == null ||
      item.confidence < threshold ||
      (item.matchKind !== "exact" &&
        item.matchKind !== "alias" &&
        item.matchKind !== "normalized")
    ) {
      unmatched += 1;
      continue;
    }

    const order = item.order ?? linked + 1;
    const { data: existing } = await client
      .from("product_ingredients")
      .select("id")
      .eq("product_id", input.productId)
      .eq("ingredient_id", item.matchedIngredientId)
      .limit(1);

    if ((existing ?? []).length) continue;

    const { error } = await client.from("product_ingredients").insert({
      product_id: input.productId,
      ingredient_id: item.matchedIngredientId,
      ingredient_order: order,
      is_key_ingredient: false,
      source_url: input.sourceUrl,
      source_type: "official_brand_page",
      verification_status: "pending",
      verified_at: null,
    });
    if (!error) linked += 1;
  }

  let queueCreated = false;
  if (
    op.allowQueueInsert &&
    (unmatched > 0 || ambiguous > 0) &&
    matched.normalized.length > 0
  ) {
    const { data: open } = await client
      .from("verification_queue")
      .select("id")
      .eq("entity_type", "product")
      .eq("entity_id", String(input.productId))
      .eq("review_type", "ingredients")
      .in("status", ["pending", "in_review"])
      .limit(1);

    if (!(open ?? []).length) {
      const { data: q } = await client
        .from("verification_queue")
        .insert({
          entity_type: "product",
          entity_id: String(input.productId),
          review_type: "ingredients",
          priority: 80,
          status: "pending",
          reason: `unmatched=${unmatched} ambiguous=${ambiguous} batch=${input.batchId}`,
          assigned_to: null,
          reviewer_notes: null,
        })
        .select("id")
        .single();
      queueCreated = Boolean((q as { id?: string } | null)?.id);
      if (queueCreated && op.allowAuditInsert) {
        await tryInsertWriteAudit(client, {
          action: "verification_queue_created",
          productId: input.productId,
          actorRole: "admin",
          metadata: {
            via: "ingredient_link",
            unmatched,
            ambiguous,
          },
        });
      }
    }
  }

  return {
    linked,
    unmatched,
    ambiguous,
    queueCreated,
    skippedReason: null,
  };
}
