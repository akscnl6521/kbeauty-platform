import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/auth/admin";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import {
  DISCOVERY_SOURCE_TYPES,
  type DiscoverySourceType,
} from "@/lib/admin/discovery";
import {
  conflict,
  internalWriteError,
  invalidInput,
  notFound,
} from "@/lib/admin/write-errors";
import {
  isSafeHttpsUrl,
  normalizeOptionalText,
  stripControlAndHtml,
} from "@/lib/admin/sanitize";
import { parsePositiveBigIntId, parseUuid } from "@/lib/admin/query";

const NAME_MAX = 200;
const BRAND_MAX = 120;
const COUNTRY_MAX = 8;
const NOTES_MAX = 2000;
const URL_MAX = 2000;

const SOURCE_SET = new Set<string>(DISCOVERY_SOURCE_TYPES);

export type CreateDiscoveryCandidateInput = {
  discoveredName?: unknown;
  discoveredBrand?: unknown;
  discoveredUrl?: unknown;
  discoveredCountry?: unknown;
  sourceType?: unknown;
  notes?: unknown;
};

export type CreatedDiscoveryCandidate = {
  id: string;
  discoveredName: string;
  discoveredBrand: string | null;
  discoveredUrl: string | null;
  discoveredCountry: string | null;
  sourceType: string | null;
  workflowStatus: string;
  duplicateCheckStatus: string;
  linkedProductId: null;
  notes: string | null;
  createdAt: string;
};

export type UpdateDiscoveryCandidateInput = {
  discoveredName?: unknown;
  discoveredBrand?: unknown;
  discoveredUrl?: unknown;
  discoveredCountry?: unknown;
  sourceType?: unknown;
  notes?: unknown;
  linkedProductId?: unknown;
  duplicateCheckStatus?: unknown;
};

function parseSourceType(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw invalidInput("source_type이 올바르지 않습니다.");
  }
  const trimmed = value.trim();
  if (!SOURCE_SET.has(trimmed)) {
    throw invalidInput("허용되지 않은 source_type입니다.");
  }
  return trimmed;
}

function parseName(value: unknown): string {
  if (typeof value !== "string") {
    throw invalidInput("discovered_name은 필수입니다.");
  }
  const cleaned = stripControlAndHtml(value);
  if (!cleaned) throw invalidInput("discovered_name은 필수입니다.");
  if (cleaned.length > NAME_MAX) {
    throw invalidInput("discovered_name이 너무 깁니다.");
  }
  return cleaned;
}

function parseUrl(value: unknown): string | null {
  const url = normalizeOptionalText(value, URL_MAX);
  if (!url) return null;
  if (!isSafeHttpsUrl(url)) {
    throw invalidInput("discovered_url은 https URL만 허용됩니다.");
  }
  return url;
}

async function findDuplicate(
  client: SupabaseClient,
  input: {
    name: string;
    brand: string | null;
    url: string | null;
    excludeId?: string;
  }
): Promise<{ id: string; workflowStatus: string } | null> {
  if (input.url) {
    let q = client
      .from("product_discovery_candidates")
      .select("id, workflow_status")
      .eq("discovered_url", input.url)
      .limit(1);
    if (input.excludeId) q = q.neq("id", input.excludeId);
    const { data, error } = await q;
    if (error) throw internalWriteError();
    const first = (data ?? [])[0] as
      | { id: string; workflow_status: string }
      | undefined;
    if (first) {
      return { id: first.id, workflowStatus: first.workflow_status };
    }
  }

  let nameQuery = client
    .from("product_discovery_candidates")
    .select("id, workflow_status, discovered_brand, linked_product_id")
    .ilike("discovered_name", input.name)
    .limit(20);
  if (input.excludeId) nameQuery = nameQuery.neq("id", input.excludeId);

  const { data: rows, error: nameError } = await nameQuery;
  if (nameError) throw internalWriteError();

  const brandNorm = (input.brand ?? "").toLowerCase();
  for (const raw of rows ?? []) {
    const row = raw as {
      id: string;
      workflow_status: string;
      discovered_brand: string | null;
      linked_product_id: number | null;
    };
    const rowBrand = (row.discovered_brand ?? "").toLowerCase();
    if (rowBrand === brandNorm) {
      return { id: row.id, workflowStatus: row.workflow_status };
    }
  }

  return null;
}

/**
 * Create a discovery candidate. SELECT/INSERT only on candidates + audit.
 */
export async function createDiscoveryCandidate(
  session: AdminSession,
  raw: CreateDiscoveryCandidateInput
): Promise<CreatedDiscoveryCandidate> {
  assertAdminPermission(session, "discovery.create");

  const discoveredName = parseName(raw.discoveredName);
  const discoveredBrand = normalizeOptionalText(raw.discoveredBrand, BRAND_MAX);
  const discoveredUrl = parseUrl(raw.discoveredUrl);
  const discoveredCountry = normalizeOptionalText(
    raw.discoveredCountry,
    COUNTRY_MAX
  );
  const sourceType = parseSourceType(raw.sourceType) as DiscoverySourceType | null;
  const notes = normalizeOptionalText(raw.notes, NOTES_MAX);

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  const dup = await findDuplicate(client, {
    name: discoveredName,
    brand: discoveredBrand,
    url: discoveredUrl,
  });
  if (dup) {
    throw conflict(
      "DUPLICATE_CANDIDATE",
      "동일한 후보가 이미 존재합니다.",
      {
        existingId: dup.id,
        workflowStatus: dup.workflowStatus,
      }
    );
  }

  const insertRow = {
    discovered_name: discoveredName,
    discovered_brand: discoveredBrand,
    discovered_url: discoveredUrl,
    discovered_country: discoveredCountry,
    source_type: sourceType,
    notes,
    workflow_status: "discovered",
    duplicate_check_status: "pending",
    sale_check_status: "pending",
    ingredient_check_status: "pending",
    evidence_check_status: "pending",
    safety_check_status: "pending",
    linked_product_id: null,
    assigned_to: null,
    search_query: null,
  };

  const { data, error } = await client
    .from("product_discovery_candidates")
    .insert(insertRow)
    .select(
      "id, discovered_name, discovered_brand, discovered_url, discovered_country, source_type, workflow_status, duplicate_check_status, notes, created_at"
    )
    .single();

  if (error || !data) {
    throw internalWriteError();
  }

  const row = data as {
    id: string;
    discovered_name: string;
    discovered_brand: string | null;
    discovered_url: string | null;
    discovered_country: string | null;
    source_type: string | null;
    workflow_status: string;
    duplicate_check_status: string;
    notes: string | null;
    created_at: string;
  };

  await tryInsertWriteAudit(client, {
    action: "discovery_candidate_created",
    productId: null,
    sourceUrl: row.discovered_url,
    actorRole: session.role,
    metadata: {
      candidateId: row.id,
      workflowStatus: row.workflow_status,
      sourceType: row.source_type,
    },
  });

  return {
    id: row.id,
    discoveredName: row.discovered_name,
    discoveredBrand: row.discovered_brand,
    discoveredUrl: row.discovered_url,
    discoveredCountry: row.discovered_country,
    sourceType: row.source_type,
    workflowStatus: row.workflow_status,
    duplicateCheckStatus: row.duplicate_check_status,
    linkedProductId: null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

type CandidateRow = {
  id: string;
  discovered_name: string;
  discovered_brand: string | null;
  discovered_url: string | null;
  discovered_country: string | null;
  source_type: string | null;
  notes: string | null;
  workflow_status: string;
  duplicate_check_status: string;
  linked_product_id: number | string | null;
};

/**
 * Patch discovery candidate with whitelist fields only.
 */
export async function updateDiscoveryCandidate(
  session: AdminSession,
  candidateIdRaw: string,
  raw: UpdateDiscoveryCandidateInput
): Promise<{
  id: string;
  discoveredName: string;
  discoveredBrand: string | null;
  discoveredUrl: string | null;
  discoveredCountry: string | null;
  sourceType: string | null;
  notes: string | null;
  workflowStatus: string;
  duplicateCheckStatus: string;
  linkedProductId: number | null;
}> {
  const candidateId = parseUuid(candidateIdRaw);
  if (!candidateId) throw invalidInput("후보 ID가 올바르지 않습니다.");

  const hasBasic =
    raw.discoveredName !== undefined ||
    raw.discoveredBrand !== undefined ||
    raw.discoveredUrl !== undefined ||
    raw.discoveredCountry !== undefined ||
    raw.sourceType !== undefined ||
    raw.notes !== undefined ||
    raw.duplicateCheckStatus !== undefined;

  const hasLink = raw.linkedProductId !== undefined;

  if (!hasBasic && !hasLink) {
    throw invalidInput("수정할 필드가 없습니다.");
  }

  if (hasBasic) {
    assertAdminPermission(session, "discovery.update_basic");
  }
  if (hasLink) {
    assertAdminPermission(session, "discovery.link_product");
  }

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  const { data: existing, error: loadError } = await client
    .from("product_discovery_candidates")
    .select(
      "id, discovered_name, discovered_brand, discovered_url, discovered_country, source_type, notes, workflow_status, duplicate_check_status, linked_product_id"
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (loadError) throw internalWriteError();
  if (!existing) throw notFound("후보를 찾을 수 없습니다.");

  const current = existing as CandidateRow;
  const currentLinked =
    current.linked_product_id == null
      ? null
      : Number(current.linked_product_id);

  if (
    current.workflow_status === "published" ||
    current.workflow_status === "rejected"
  ) {
    throw conflict(
      "CONFLICT",
      "published/rejected 후보는 이 경로로 수정할 수 없습니다."
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const changed: Record<string, { from: unknown; to: unknown }> = {};

  if (raw.discoveredName !== undefined) {
    const next = parseName(raw.discoveredName);
    if (next !== current.discovered_name) {
      patch.discovered_name = next;
      changed.discovered_name = { from: current.discovered_name, to: next };
    }
  }
  if (raw.discoveredBrand !== undefined) {
    const next = normalizeOptionalText(raw.discoveredBrand, BRAND_MAX);
    if (next !== current.discovered_brand) {
      patch.discovered_brand = next;
      changed.discovered_brand = { from: current.discovered_brand, to: next };
    }
  }
  if (raw.discoveredUrl !== undefined) {
    const next = parseUrl(raw.discoveredUrl);
    if (next !== current.discovered_url) {
      patch.discovered_url = next;
      changed.discovered_url = { from: current.discovered_url, to: next };
    }
  }
  if (raw.discoveredCountry !== undefined) {
    const next = normalizeOptionalText(raw.discoveredCountry, COUNTRY_MAX);
    if (next !== current.discovered_country) {
      patch.discovered_country = next;
      changed.discovered_country = {
        from: current.discovered_country,
        to: next,
      };
    }
  }
  if (raw.sourceType !== undefined) {
    const next = parseSourceType(raw.sourceType);
    if (next !== current.source_type) {
      patch.source_type = next;
      changed.source_type = { from: current.source_type, to: next };
    }
  }
  if (raw.notes !== undefined) {
    const next = normalizeOptionalText(raw.notes, NOTES_MAX);
    if (next !== current.notes) {
      patch.notes = next;
      changed.notes = { from: "(redacted)", to: "(updated)" };
    }
  }
  if (raw.duplicateCheckStatus !== undefined) {
    const next =
      typeof raw.duplicateCheckStatus === "string"
        ? raw.duplicateCheckStatus.trim()
        : "";
    if (!["pending", "pass", "fail"].includes(next)) {
      throw invalidInput("duplicate_check_status가 올바르지 않습니다.");
    }
    if (next !== current.duplicate_check_status) {
      patch.duplicate_check_status = next;
      changed.duplicate_check_status = {
        from: current.duplicate_check_status,
        to: next,
      };
    }
  }

  if (hasLink) {
    if (raw.linkedProductId === null || raw.linkedProductId === "") {
      throw conflict(
        "CONFLICT",
        "이번 버전에서는 제품 연결 해제를 지원하지 않습니다."
      );
    }
    const productId = parsePositiveBigIntId(
      typeof raw.linkedProductId === "number" ||
        typeof raw.linkedProductId === "string"
        ? raw.linkedProductId
        : String(raw.linkedProductId)
    );
    if (productId == null) {
      throw invalidInput("linked_product_id가 올바르지 않습니다.");
    }

    if (currentLinked != null && currentLinked !== productId) {
      assertAdminPermission(session, "discovery.replace_link");
    }

    const { data: product, error: productError } = await client
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();
    if (productError) throw internalWriteError();
    if (!product) throw notFound("연결할 제품을 찾을 수 없습니다.");

    if (currentLinked !== productId) {
      patch.linked_product_id = productId;
      changed.linked_product_id = { from: currentLinked, to: productId };
    }
  }

  // Duplicate check after potential name/brand/url change
  const nextName =
    (patch.discovered_name as string | undefined) ?? current.discovered_name;
  const nextBrand =
    patch.discovered_brand !== undefined
      ? (patch.discovered_brand as string | null)
      : current.discovered_brand;
  const nextUrl =
    patch.discovered_url !== undefined
      ? (patch.discovered_url as string | null)
      : current.discovered_url;

  if (
    patch.discovered_name !== undefined ||
    patch.discovered_brand !== undefined ||
    patch.discovered_url !== undefined
  ) {
    const dup = await findDuplicate(client, {
      name: nextName,
      brand: nextBrand,
      url: nextUrl,
      excludeId: candidateId,
    });
    if (dup) {
      throw conflict(
        "DUPLICATE_CANDIDATE",
        "동일한 후보가 이미 존재합니다.",
        { existingId: dup.id, workflowStatus: dup.workflowStatus }
      );
    }
  }

  if (Object.keys(changed).length === 0) {
    return {
      id: current.id,
      discoveredName: current.discovered_name,
      discoveredBrand: current.discovered_brand,
      discoveredUrl: current.discovered_url,
      discoveredCountry: current.discovered_country,
      sourceType: current.source_type,
      notes: current.notes,
      workflowStatus: current.workflow_status,
      duplicateCheckStatus: current.duplicate_check_status,
      linkedProductId: currentLinked,
    };
  }

  const { data: updated, error: updateError } = await client
    .from("product_discovery_candidates")
    .update(patch)
    .eq("id", candidateId)
    .select(
      "id, discovered_name, discovered_brand, discovered_url, discovered_country, source_type, notes, workflow_status, duplicate_check_status, linked_product_id"
    )
    .single();

  if (updateError || !updated) throw internalWriteError();

  const row = updated as CandidateRow;
  const linked =
    row.linked_product_id == null ? null : Number(row.linked_product_id);

  const linkedChanged = Boolean(changed.linked_product_id);
  await tryInsertWriteAudit(client, {
    action: linkedChanged
      ? "candidate_linked_to_product"
      : "discovery_candidate_updated",
    productId: linked,
    sourceUrl: row.discovered_url,
    actorRole: session.role,
    oldValue: { fields: Object.fromEntries(
      Object.entries(changed).map(([k, v]) => [k, v.from])
    ) },
    metadata: {
      candidateId: row.id,
      changedFields: Object.keys(changed),
      workflowStatus: row.workflow_status,
    },
  });

  return {
    id: row.id,
    discoveredName: row.discovered_name,
    discoveredBrand: row.discovered_brand,
    discoveredUrl: row.discovered_url,
    discoveredCountry: row.discovered_country,
    sourceType: row.source_type,
    notes: row.notes,
    workflowStatus: row.workflow_status,
    duplicateCheckStatus: row.duplicate_check_status,
    linkedProductId: linked,
  };
}
