import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  isSafeHttpsUrl,
  parsePositiveBigIntId,
  parseUuid,
} from "@/lib/admin/query";

export type AdminVerificationQueueDetail = {
  id: string;
  entityType: string;
  entityId: string;
  reviewType: string;
  status: string;
  priority: number;
  isAssigned: boolean;
  reason: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminVerificationLinkedCandidate = {
  id: string;
  candidateName: string;
  brandName: string | null;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
  workflowStatus: string;
  linkedProductId: number | null;
};

export type AdminVerificationLinkedProduct = {
  id: number;
  name: string;
  brand: string;
  slug: string | null;
  category: string | null;
  active: boolean | null;
};

export type AdminVerificationLinkedIngredient = {
  id: number;
  slug: string;
  nameEn: string;
  nameKo: string | null;
};

export type AdminVerificationLinkedOffer = {
  id: string;
  productId: number;
  retailerName: string;
  purchaseUrl: string | null;
  purchaseUrlSafeHttps: boolean;
  verificationStatus: string;
  active: boolean;
};

export type AdminVerificationLinkedVariant = {
  id: string;
  productId: number;
  variantName: string | null;
  countryCode: string;
  verificationStatus: string;
  active: boolean;
};

export type AdminVerificationLinkedBrand = {
  id: string;
  canonicalName: string;
  nameEn: string | null;
  nameKo: string | null;
  verificationStatus: string;
  active: boolean;
};

export type AdminVerificationLinkedEvidence = {
  id: string;
  ingredientId: number;
  evidenceType: string;
  evidenceLevel: string;
  reviewStatus: string;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
};

export type AdminVerificationLinkedEntity = {
  kind: string;
  found: boolean;
  candidate: AdminVerificationLinkedCandidate | null;
  product: AdminVerificationLinkedProduct | null;
  ingredient: AdminVerificationLinkedIngredient | null;
  offer: AdminVerificationLinkedOffer | null;
  variant: AdminVerificationLinkedVariant | null;
  brand: AdminVerificationLinkedBrand | null;
  evidence: AdminVerificationLinkedEvidence | null;
  detailHref: string | null;
};

export type AdminVerificationDetailPayload = {
  queue: AdminVerificationQueueDetail;
  linked: AdminVerificationLinkedEntity;
};

/**
 * Parse verification_queue UUID. Invalid → null.
 */
export function parseAdminVerificationId(
  raw: string | null | undefined
): string | null {
  return parseUuid(raw);
}

async function loadLinkedEntity(
  client: SupabaseClient,
  entityType: string,
  entityId: string
): Promise<AdminVerificationLinkedEntity> {
  const empty: AdminVerificationLinkedEntity = {
    kind: entityType,
    found: false,
    candidate: null,
    product: null,
    ingredient: null,
    offer: null,
    variant: null,
    brand: null,
    evidence: null,
    detailHref: null,
  };

  if (entityType === "candidate") {
    const id = parseUuid(entityId);
    if (!id) return empty;
    const { data, error } = await client
      .from("product_discovery_candidates")
      .select(
        "id, discovered_name, discovered_brand, discovered_url, workflow_status, linked_product_id"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: string;
      discovered_name: string;
      discovered_brand: string | null;
      discovered_url: string | null;
      workflow_status: string;
      linked_product_id: number | string | null;
    };
    const linkedProductId =
      row.linked_product_id == null
        ? null
        : Number(row.linked_product_id);
    return {
      ...empty,
      found: true,
      candidate: {
        id: row.id,
        candidateName: row.discovered_name,
        brandName: row.discovered_brand,
        sourceUrl: row.discovered_url,
        sourceUrlSafeHttps: isSafeHttpsUrl(row.discovered_url),
        workflowStatus: row.workflow_status,
        linkedProductId:
          linkedProductId != null && Number.isSafeInteger(linkedProductId)
            ? linkedProductId
            : null,
      },
      detailHref: `/admin/discovery/${row.id}`,
    };
  }

  if (entityType === "product") {
    const id = parsePositiveBigIntId(entityId);
    if (id == null) return empty;
    const { data, error } = await client
      .from("products")
      .select("id, name, brand, slug, category, active")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: number | string;
      name: string;
      brand: string;
      slug: string | null;
      category: string | null;
      active: boolean | null;
    };
    const productId = Number(row.id);
    return {
      ...empty,
      found: true,
      product: {
        id: productId,
        name: row.name,
        brand: row.brand,
        slug: row.slug,
        category: row.category,
        active: row.active,
      },
      detailHref: `/admin/products/${productId}`,
    };
  }

  if (entityType === "ingredient") {
    const id = parsePositiveBigIntId(entityId);
    if (id == null) return empty;
    const { data, error } = await client
      .from("ingredients")
      .select("id, slug, name_en, name_ko")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: number | string;
      slug: string;
      name_en: string;
      name_ko: string | null;
    };
    const ingredientId = Number(row.id);
    return {
      ...empty,
      found: true,
      ingredient: {
        id: ingredientId,
        slug: row.slug,
        nameEn: row.name_en,
        nameKo: row.name_ko,
      },
      detailHref: `/admin/ingredients/${ingredientId}`,
    };
  }

  if (entityType === "offer") {
    const id = parseUuid(entityId);
    if (!id) return empty;
    const { data, error } = await client
      .from("product_offers")
      .select(
        "id, product_id, retailer_name, purchase_url, verification_status, active"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: string;
      product_id: number | string;
      retailer_name: string;
      purchase_url: string | null;
      verification_status: string;
      active: boolean;
    };
    const productId = Number(row.product_id);
    return {
      ...empty,
      found: true,
      offer: {
        id: row.id,
        productId,
        retailerName: row.retailer_name,
        purchaseUrl: row.purchase_url,
        purchaseUrlSafeHttps: isSafeHttpsUrl(row.purchase_url),
        verificationStatus: row.verification_status,
        active: row.active,
      },
      detailHref: Number.isSafeInteger(productId)
        ? `/admin/products/${productId}`
        : null,
    };
  }

  if (entityType === "variant") {
    const id = parseUuid(entityId);
    if (!id) return empty;
    const { data, error } = await client
      .from("product_variants")
      .select(
        "id, product_id, variant_name, country_code, verification_status, active"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: string;
      product_id: number | string;
      variant_name: string | null;
      country_code: string;
      verification_status: string;
      active: boolean;
    };
    const productId = Number(row.product_id);
    return {
      ...empty,
      found: true,
      variant: {
        id: row.id,
        productId,
        variantName: row.variant_name,
        countryCode: row.country_code,
        verificationStatus: row.verification_status,
        active: row.active,
      },
      detailHref: Number.isSafeInteger(productId)
        ? `/admin/products/${productId}`
        : null,
    };
  }

  if (entityType === "brand") {
    const id = parseUuid(entityId);
    if (!id) return empty;
    const { data, error } = await client
      .from("brands")
      .select(
        "id, canonical_name, name_en, name_ko, verification_status, active"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: string;
      canonical_name: string;
      name_en: string | null;
      name_ko: string | null;
      verification_status: string;
      active: boolean;
    };
    return {
      ...empty,
      found: true,
      brand: {
        id: row.id,
        canonicalName: row.canonical_name,
        nameEn: row.name_en,
        nameKo: row.name_ko,
        verificationStatus: row.verification_status,
        active: row.active,
      },
      detailHref: null,
    };
  }

  if (entityType === "evidence") {
    const id = parseUuid(entityId);
    if (!id) return empty;
    const { data, error } = await client
      .from("ingredient_evidence")
      .select(
        "id, ingredient_id, evidence_type, evidence_level, review_status, source_url"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return empty;
    const row = data as unknown as {
      id: string;
      ingredient_id: number | string;
      evidence_type: string;
      evidence_level: string;
      review_status: string;
      source_url: string | null;
    };
    const ingredientId = Number(row.ingredient_id);
    return {
      ...empty,
      found: true,
      evidence: {
        id: row.id,
        ingredientId,
        evidenceType: row.evidence_type,
        evidenceLevel: row.evidence_level,
        reviewStatus: row.review_status,
        sourceUrl: row.source_url,
        sourceUrlSafeHttps: isSafeHttpsUrl(row.source_url),
      },
      detailHref: Number.isSafeInteger(ingredientId)
        ? `/admin/ingredients/${ingredientId}`
        : null,
    };
  }

  return empty;
}

/**
 * Read-only verification queue detail. SELECT only.
 * Never returns assigned_to raw value.
 */
export async function getAdminVerificationDetail(
  queueId: string
): Promise<AdminVerificationDetailPayload | null> {
  const id = parseAdminVerificationId(queueId);
  if (!id) return null;

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError(
      "Unable to load admin verification detail."
    );
  }

  try {
    const { data, error } = await client
      .from("verification_queue")
      .select(
        "id, entity_type, entity_id, review_type, priority, status, assigned_to, reason, reviewer_notes, created_at, reviewed_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification detail."
      );
    }
    if (!data) return null;

    const row = data as unknown as {
      id: string;
      entity_type: string;
      entity_id: string;
      review_type: string;
      priority: number;
      status: string;
      assigned_to: string | null;
      reason: string | null;
      reviewer_notes: string | null;
      created_at: string;
      reviewed_at: string | null;
    };

    const linked = await loadLinkedEntity(
      client,
      row.entity_type,
      row.entity_id
    );

    return {
      queue: {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        reviewType: row.review_type,
        status: row.status,
        priority: row.priority,
        isAssigned:
          row.assigned_to != null && String(row.assigned_to).length > 0,
        reason: row.reason,
        reviewerNotes: row.reviewer_notes,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
      },
      linked,
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError(
      "Unable to load admin verification detail."
    );
  }
}
