/**
 * Admin Staging apply for curated INCI label sheet entries.
 * Does not invent ingredients. Never writes Production.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { AdminConfigurationError } from "@/lib/auth/errors";
import type { OfficialInciLabelEntry } from "@/lib/catalog/labels";
import { resolveEntryTokens } from "@/lib/catalog/labels";
import { evidenceSlugsFromIngredients } from "@/lib/catalog/labels/evidenceFromIngredients";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";
import {
  entryHasTokens,
  loadOfficialInciSheetFromDisk,
} from "@/lib/admin/catalogLabelSheetDisk";

export { entryHasTokens, loadOfficialInciSheetFromDisk };

export type LabelApplyItemResult = {
  externalProductId: string;
  status: "would_apply" | "applied" | "skipped" | "error";
  reason?: string;
  tokenCount?: number;
};

export type LabelApplyResult = {
  dryRun: boolean;
  sprintTag: string;
  expectedCount: number;
  appliedCount: number;
  items: LabelApplyItemResult[];
};

function resolveTokens(entry: OfficialInciLabelEntry): string[] {
  const parsed = parseOfficialIngredientsRaw({
    ingredientsRaw: entry.fullIngredientsRaw,
    sourceUrl: entry.sourceUrl,
    sourceType: entry.sourceType,
    sourceTier: entry.sourceType === "open_beauty_facts" ? 3 : 1,
    sourceVerified: entry.sourceType !== "open_beauty_facts",
  });
  if (parsed.tokens.length >= 3) {
    return parsed.tokens.map((t) => t.inciName || t.ingredientRaw);
  }
  return resolveEntryTokens(entry);
}

export async function applyLabelSheetInci(input: {
  externalProductIds: string[];
  dryRun?: boolean;
  force?: boolean;
  /** Allow applying entries with applyReady=false after explicit admin review */
  allowNotReady?: boolean;
  actor?: string | null;
}): Promise<LabelApplyResult> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new AdminConfigurationError(gate.message);

  const ids = Array.from(
    new Set(input.externalProductIds.map((x) => x.trim()).filter(Boolean))
  );
  if (ids.length === 0) {
    throw new AdminConfigurationError("externalProductIds required");
  }

  const sheet = loadOfficialInciSheetFromDisk();
  const sprintTag = sheet._meta.sprintTagDefault;
  const byId = new Map(sheet.entries.map((e) => [e.externalProductId, e]));
  const dryRun = input.dryRun !== false;
  const client = createSupabaseAdminClient();
  const items: LabelApplyItemResult[] = [];
  let appliedCount = 0;

  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) {
      items.push({
        externalProductId: id,
        status: "skipped",
        reason: "not_in_sheet",
      });
      continue;
    }
    if (!entry.applyReady && !input.allowNotReady) {
      items.push({
        externalProductId: id,
        status: "skipped",
        reason: "applyReady_false",
      });
      continue;
    }
    const tokens = resolveTokens(entry);
    if (tokens.length < 3) {
      items.push({
        externalProductId: id,
        status: "skipped",
        reason: "tokens_lt_3",
      });
      continue;
    }

    const { data: row, error } = await client
      .from("catalog_staging_products")
      .select(
        "id, external_product_id, product_attributes, enrichment_reasons, ingredients_status"
      )
      .eq("sprint_tag", sprintTag)
      .eq("external_product_id", id)
      .maybeSingle();
    if (error) {
      items.push({
        externalProductId: id,
        status: "error",
        reason: error.message,
      });
      continue;
    }
    if (!row) {
      items.push({
        externalProductId: id,
        status: "skipped",
        reason: "staging_row_missing",
      });
      continue;
    }

    const attrs = (row.product_attributes ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(attrs.fullIngredients)
      ? (attrs.fullIngredients as unknown[]).filter((x) => typeof x === "string")
      : [];
    if (existing.length > 0 && !input.force) {
      items.push({
        externalProductId: id,
        status: "skipped",
        reason: "existing_inci",
        tokenCount: existing.length,
      });
      continue;
    }

    if (dryRun) {
      items.push({
        externalProductId: id,
        status: "would_apply",
        tokenCount: tokens.length,
      });
      appliedCount += 1;
      continue;
    }

    const evidence = evidenceSlugsFromIngredients(tokens);
    const reasonsPrev = Array.isArray(row.enrichment_reasons)
      ? row.enrichment_reasons.map(String)
      : [];
    const reasons = [
      ...reasonsPrev.filter((r) => !r.startsWith("inci_from_curated")),
      `inci_from_curated_label_sheet:${entry.sourceType}`,
      ...(input.allowNotReady && !entry.applyReady
        ? ["inci_admin_reviewed_not_ready"]
        : []),
    ];
    const nextAttrs = {
      ...attrs,
      fullIngredients: tokens,
      keyIngredients: tokens.slice(0, 8),
      curatedLabelSource: {
        sourceType: entry.sourceType,
        sourceUrl: entry.sourceUrl,
        labelCheckedAt: entry.labelCheckedAt,
        sheetVersion: sheet._meta.sheetVersion,
        adminApply: true,
      },
      enrichmentReasons: reasons,
    };

    const { error: updErr } = await client
      .from("catalog_staging_products")
      .update({
        ingredients_status: "raw_collected",
        product_attributes: nextAttrs,
        evidence_ingredient_slugs: evidence,
        enrichment_reasons: reasons,
        last_enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updErr) {
      items.push({
        externalProductId: id,
        status: "error",
        reason: updErr.message,
      });
      continue;
    }

    await client
      .from("catalog_staging_ingredients")
      .delete()
      .eq("staging_product_id", row.id);

    const parsed = parseOfficialIngredientsRaw({
      ingredientsRaw: entry.fullIngredientsRaw,
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      sourceTier: entry.sourceType === "open_beauty_facts" ? 3 : 1,
      sourceVerified: entry.sourceType !== "open_beauty_facts",
    });
    if (parsed.tokens.length > 0) {
      const { error: insErr } = await client
        .from("catalog_staging_ingredients")
        .insert(
          parsed.tokens.map((t, i) => ({
            staging_product_id: row.id,
            display_order: i,
            ingredient_raw: t.ingredientRaw,
            inci_name: t.inciName ?? null,
            canonical_key: t.canonicalKey ?? null,
            normalization_status: t.normalizationStatus,
            confidence: t.confidence,
            source_url: entry.sourceUrl,
            source_type: entry.sourceType,
            source_verified: entry.sourceType !== "open_beauty_facts",
          }))
        );
      if (insErr) {
        items.push({
          externalProductId: id,
          status: "error",
          reason: `ingredients_insert:${insErr.message}`,
        });
        continue;
      }
    }

    items.push({
      externalProductId: id,
      status: "applied",
      tokenCount: tokens.length,
    });
    appliedCount += 1;
  }

  await client.from("catalog_bulk_audit").insert({
    action: "apply_curated_inci",
    filter_snapshot: {
      externalProductIds: ids,
      force: !!input.force,
      allowNotReady: !!input.allowNotReady,
    },
    expected_count: items.filter((i) =>
      ["would_apply", "applied"].includes(i.status)
    ).length,
    applied_count: dryRun ? 0 : appliedCount,
    dry_run: dryRun,
    actor: input.actor ?? null,
    notes: "label_sheet_admin_apply",
  });

  return {
    dryRun,
    sprintTag,
    expectedCount: items.filter((i) =>
      ["would_apply", "applied"].includes(i.status)
    ).length,
    appliedCount: dryRun ? 0 : appliedCount,
    items,
  };
}
