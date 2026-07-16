import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  isSafeHttpsUrl,
  parsePositiveBigIntId,
} from "@/lib/admin/query";

export type AdminIngredientAliasItem = {
  id: string;
  alias: string;
  languageCode: string | null;
  aliasType: string;
  normalizedAlias: string;
  active: boolean;
  reviewStatus: string;
  createdAt: string;
};

export type AdminIngredientEvidenceItem = {
  id: string;
  concernId: string | null;
  evidenceType: string;
  evidenceLevel: string;
  studyDesign: string | null;
  population: string | null;
  outcomeSummary: string | null;
  pmid: string | null;
  doi: string | null;
  journal: string | null;
  publicationYear: number | null;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
  reviewStatus: string;
  reviewedAt: string | null;
  isReviewed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminIngredientCautionItem = {
  id: string;
  cautionType: string;
  severity: string;
  condition: string | null;
  description: string;
  evidenceSource: string | null;
  reviewStatus: string;
  reviewedAt: string | null;
  active: boolean;
  createdAt: string;
};

export type AdminIngredientLinkedProduct = {
  productId: number;
  productName: string | null;
  productBrand: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  isKeyIngredient: boolean;
  ingredientOrder: number;
};

export type AdminIngredientStatusSummary = {
  /** ingredients 테이블에 verified_at 없음 → 항상 false */
  ingredientVerified: false;
  hasAlias: boolean;
  hasEvidence: boolean;
  hasCaution: boolean;
  hasLinkedProduct: boolean;
  aliasCount: number;
  evidenceCount: number;
  cautionCount: number;
  linkedProductCount: number;
  approvedEvidenceCount: number;
  approvedCautionCount: number;
};

export type AdminIngredientDetail = {
  id: number;
  slug: string;
  nameEn: string;
  nameKo: string | null;
  nameJa: string | null;
  effects: string[];
  effectsKo: string[];
  mechanism: string | null;
  mechanismKo: string | null;
  caution: string | null;
  cautionKo: string | null;
  paper1: {
    title: string | null;
    year: string | null;
    journal: string | null;
    url: string | null;
    urlSafeHttps: boolean;
  };
  paper2: {
    title: string | null;
    year: string | null;
    journal: string | null;
    url: string | null;
    urlSafeHttps: boolean;
  };
  createdAt: string | null;
  /** schema: no active column */
  active: null;
  /** schema: no verified_at column */
  verifiedAt: null;
};

export type AdminIngredientDetailPayload = {
  ingredient: AdminIngredientDetail;
  aliases: AdminIngredientAliasItem[];
  evidence: AdminIngredientEvidenceItem[];
  cautions: AdminIngredientCautionItem[];
  linkedProducts: AdminIngredientLinkedProduct[];
  statusSummary: AdminIngredientStatusSummary;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Read-only ingredient detail. SELECT only.
 * Does not return reviewed_by (possible PII).
 */
export async function getAdminIngredientDetail(
  ingredientId: number
): Promise<AdminIngredientDetailPayload | null> {
  if (!Number.isSafeInteger(ingredientId) || ingredientId < 1) return null;

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin ingredient detail.");
  }

  try {
    const { data: row, error } = await client
      .from("ingredients")
      .select(
        [
          "id",
          "slug",
          "name_en",
          "name_ko",
          "name_ja",
          "effects",
          "effects_ko",
          "mechanism",
          "mechanism_ko",
          "caution",
          "caution_ko",
          "paper_1_title",
          "paper_1_year",
          "paper_1_journal",
          "paper_1_url",
          "paper_2_title",
          "paper_2_year",
          "paper_2_journal",
          "paper_2_url",
          "created_at",
        ].join(", ")
      )
      .eq("id", ingredientId)
      .maybeSingle();

    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin ingredient detail."
      );
    }
    if (!row) return null;

    const record = row as unknown as Record<string, unknown>;

    const [aliasesRes, evidenceRes, cautionsRes, linksRes] = await Promise.all([
      client
        .from("ingredient_aliases")
        .select(
          "id, alias, language_code, alias_type, normalized_alias, active, review_status, created_at"
        )
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: false }),
      client
        .from("ingredient_evidence")
        .select(
          "id, concern_id, evidence_type, evidence_level, study_design, population, outcome_summary, pmid, doi, journal, publication_year, source_url, reviewed_at, review_status, created_at, updated_at"
        )
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: false }),
      client
        .from("ingredient_cautions")
        .select(
          "id, caution_type, severity, condition, description, evidence_source, review_status, reviewed_at, active, created_at"
        )
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: false }),
      client
        .from("product_ingredients")
        .select(
          "product_id, verification_status, verified_at, is_key_ingredient, ingredient_order"
        )
        .eq("ingredient_id", ingredientId)
        .order("ingredient_order", { ascending: true }),
    ]);

    if (
      aliasesRes.error ||
      evidenceRes.error ||
      cautionsRes.error ||
      linksRes.error
    ) {
      throw new AdminConfigurationError(
        "Unable to load admin ingredient detail."
      );
    }

    const linkRows = (linksRes.data ?? []) as unknown as Array<{
      product_id: number | string;
      verification_status: string;
      verified_at: string | null;
      is_key_ingredient: boolean;
      ingredient_order: number;
    }>;

    const productIds = [
      ...new Set(
        linkRows
          .map((item) => Number(item.product_id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      ),
    ];

    const productNameById = new Map<
      number,
      { name: string; brand: string }
    >();

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await client
        .from("products")
        .select("id, name, brand")
        .in("id", productIds);

      if (productsError) {
        throw new AdminConfigurationError(
          "Unable to load admin ingredient detail."
        );
      }

      for (const product of products ?? []) {
        const p = product as unknown as {
          id: number | string;
          name: string;
          brand: string;
        };
        const id = Number(p.id);
        if (!Number.isSafeInteger(id)) continue;
        productNameById.set(id, { name: p.name, brand: p.brand });
      }
    }

    const aliases: AdminIngredientAliasItem[] = (
      (aliasesRes.data ?? []) as unknown as Array<{
        id: string;
        alias: string;
        language_code: string | null;
        alias_type: string;
        normalized_alias: string;
        active: boolean;
        review_status: string;
        created_at: string;
      }>
    ).map((item) => ({
      id: item.id,
      alias: item.alias,
      languageCode: item.language_code,
      aliasType: item.alias_type,
      normalizedAlias: item.normalized_alias,
      active: item.active,
      reviewStatus: item.review_status,
      createdAt: item.created_at,
    }));

    const evidence: AdminIngredientEvidenceItem[] = (
      (evidenceRes.data ?? []) as unknown as Array<{
        id: string;
        concern_id: string | null;
        evidence_type: string;
        evidence_level: string;
        study_design: string | null;
        population: string | null;
        outcome_summary: string | null;
        pmid: string | null;
        doi: string | null;
        journal: string | null;
        publication_year: number | null;
        source_url: string | null;
        reviewed_at: string | null;
        review_status: string;
        created_at: string;
        updated_at: string;
      }>
    ).map((item) => ({
      id: item.id,
      concernId: item.concern_id,
      evidenceType: item.evidence_type,
      evidenceLevel: item.evidence_level,
      studyDesign: item.study_design,
      population: item.population,
      outcomeSummary: item.outcome_summary,
      pmid: item.pmid,
      doi: item.doi,
      journal: item.journal,
      publicationYear: item.publication_year,
      sourceUrl: item.source_url,
      sourceUrlSafeHttps: isSafeHttpsUrl(item.source_url),
      reviewStatus: item.review_status,
      reviewedAt: item.reviewed_at,
      isReviewed: Boolean(item.reviewed_at),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    const cautions: AdminIngredientCautionItem[] = (
      (cautionsRes.data ?? []) as unknown as Array<{
        id: string;
        caution_type: string;
        severity: string;
        condition: string | null;
        description: string;
        evidence_source: string | null;
        review_status: string;
        reviewed_at: string | null;
        active: boolean;
        created_at: string;
      }>
    ).map((item) => ({
      id: item.id,
      cautionType: item.caution_type,
      severity: item.severity,
      condition: item.condition,
      description: item.description,
      evidenceSource: item.evidence_source,
      reviewStatus: item.review_status,
      reviewedAt: item.reviewed_at,
      active: item.active,
      createdAt: item.created_at,
    }));

    const linkedProducts: AdminIngredientLinkedProduct[] = linkRows.map(
      (item) => {
        const productId = Number(item.product_id);
        const meta = productNameById.get(productId);
        return {
          productId,
          productName: meta?.name ?? null,
          productBrand: meta?.brand ?? null,
          verificationStatus: item.verification_status,
          verifiedAt: item.verified_at,
          isKeyIngredient: item.is_key_ingredient,
          ingredientOrder: item.ingredient_order,
        };
      }
    );

    const paper1Url =
      typeof record.paper_1_url === "string" ? record.paper_1_url : null;
    const paper2Url =
      typeof record.paper_2_url === "string" ? record.paper_2_url : null;

    const ingredient: AdminIngredientDetail = {
      id: Number(record.id),
      slug: String(record.slug),
      nameEn: String(record.name_en),
      nameKo: typeof record.name_ko === "string" ? record.name_ko : null,
      nameJa: typeof record.name_ja === "string" ? record.name_ja : null,
      effects: asStringArray(record.effects),
      effectsKo: asStringArray(record.effects_ko),
      mechanism:
        typeof record.mechanism === "string" ? record.mechanism : null,
      mechanismKo:
        typeof record.mechanism_ko === "string" ? record.mechanism_ko : null,
      caution: typeof record.caution === "string" ? record.caution : null,
      cautionKo:
        typeof record.caution_ko === "string" ? record.caution_ko : null,
      paper1: {
        title:
          typeof record.paper_1_title === "string"
            ? record.paper_1_title
            : null,
        year:
          typeof record.paper_1_year === "string" ? record.paper_1_year : null,
        journal:
          typeof record.paper_1_journal === "string"
            ? record.paper_1_journal
            : null,
        url: paper1Url,
        urlSafeHttps: isSafeHttpsUrl(paper1Url),
      },
      paper2: {
        title:
          typeof record.paper_2_title === "string"
            ? record.paper_2_title
            : null,
        year:
          typeof record.paper_2_year === "string" ? record.paper_2_year : null,
        journal:
          typeof record.paper_2_journal === "string"
            ? record.paper_2_journal
            : null,
        url: paper2Url,
        urlSafeHttps: isSafeHttpsUrl(paper2Url),
      },
      createdAt:
        typeof record.created_at === "string" ? record.created_at : null,
      active: null,
      verifiedAt: null,
    };

    return {
      ingredient,
      aliases,
      evidence,
      cautions,
      linkedProducts,
      statusSummary: {
        ingredientVerified: false,
        hasAlias: aliases.length > 0,
        hasEvidence: evidence.length > 0,
        hasCaution: cautions.length > 0,
        hasLinkedProduct: linkedProducts.length > 0,
        aliasCount: aliases.length,
        evidenceCount: evidence.length,
        cautionCount: cautions.length,
        linkedProductCount: new Set(linkedProducts.map((p) => p.productId))
          .size,
        approvedEvidenceCount: evidence.filter(
          (item) => item.reviewStatus === "approved"
        ).length,
        approvedCautionCount: cautions.filter(
          (item) => item.reviewStatus === "approved"
        ).length,
      },
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin ingredient detail.");
  }
}

export { parsePositiveBigIntId as parseAdminIngredientId };
