import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/auth/admin";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { DISCOVERY_SOURCE_TYPES } from "@/lib/admin/discovery";
import { findImportDuplicate } from "@/lib/admin/import/duplicate-check";
import {
  canonicalizeProductUrl,
  extractDomain,
} from "@/lib/admin/import/normalize";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import {
  AdminWriteError,
  invalidInput,
} from "@/lib/admin/write-errors";
import {
  normalizeOptionalText,
  stripControlAndHtml,
} from "@/lib/admin/sanitize";

const SOURCE_SET = new Set<string>(DISCOVERY_SOURCE_TYPES);
const MAX_COMMIT = 50;
const NAME_MAX = 200;
const BRAND_MAX = 120;
const COUNTRY_MAX = 8;
const NOTES_MAX = 2000;

export type ImportCommitItemInput = {
  canonicalUrl?: unknown;
  productName?: unknown;
  brandName?: unknown;
  detectedCountry?: unknown;
  sourceType?: unknown;
  notes?: unknown;
};

export type ImportCommitResult = {
  created: Array<{
    id: string;
    productName: string;
    brandName: string | null;
    canonicalUrl: string;
    queueId: string | null;
  }>;
  duplicates: Array<{
    productName: string | null;
    canonicalUrl: string | null;
    duplicateCandidateId: string | null;
    duplicateProductId: number | null;
    code: string;
  }>;
  failed: Array<{
    productName: string | null;
    canonicalUrl: string | null;
    code: string;
    message: string;
  }>;
  summary: {
    requested: number;
    created: number;
    duplicates: number;
    failed: number;
  };
};

function parseCommitItem(raw: ImportCommitItemInput): {
  ok: true;
  value: {
    canonicalUrl: string;
    productName: string;
    brandName: string | null;
    detectedCountry: string | null;
    sourceType: string;
    notes: string | null;
  };
} | {
  ok: false;
  code: string;
  message: string;
  productName: string | null;
  canonicalUrl: string | null;
} {
  const productName =
    typeof raw.productName === "string"
      ? stripControlAndHtml(raw.productName).slice(0, NAME_MAX)
      : "";
  const urlRaw =
    typeof raw.canonicalUrl === "string" ? raw.canonicalUrl.trim() : "";
  const canonicalUrl = canonicalizeProductUrl(urlRaw);

  if (!productName) {
    return {
      ok: false,
      code: "PRODUCT_INFO_INCOMPLETE",
      message: "제품명이 필요합니다.",
      productName: null,
      canonicalUrl,
    };
  }
  if (!canonicalUrl) {
    return {
      ok: false,
      code: "INVALID_URL",
      message: "canonicalUrl이 올바르지 않습니다.",
      productName,
      canonicalUrl: null,
    };
  }

  const sourceType =
    typeof raw.sourceType === "string" && raw.sourceType.trim()
      ? raw.sourceType.trim()
      : "search_result";
  if (!SOURCE_SET.has(sourceType)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "source_type이 올바르지 않습니다.",
      productName,
      canonicalUrl,
    };
  }

  return {
    ok: true,
    value: {
      canonicalUrl,
      productName,
      brandName: normalizeOptionalText(raw.brandName, BRAND_MAX),
      detectedCountry: normalizeOptionalText(raw.detectedCountry, COUNTRY_MAX),
      sourceType,
      notes: normalizeOptionalText(raw.notes, NOTES_MAX),
    },
  };
}

/**
 * Commit selected import items. Re-validates everything server-side.
 * Partial success — one failure does not abort the batch.
 */
export async function commitDiscoveryImport(
  session: AdminSession,
  input: {
    items?: unknown;
    createDuplicateQueue?: unknown;
  }
): Promise<ImportCommitResult> {
  assertAdminPermission(session, "discovery.create");

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw invalidInput("등록할 항목이 없습니다.");
  }
  if (input.items.length > MAX_COMMIT) {
    throw new AdminWriteError(
      "BATCH_LIMIT_EXCEEDED",
      400,
      "한 번에 최대 50건까지 등록할 수 있습니다."
    );
  }

  const createDuplicateQueue = input.createDuplicateQueue === true;
  if (createDuplicateQueue) {
    assertAdminPermission(session, "verification.create");
  }

  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  const result: ImportCommitResult = {
    created: [],
    duplicates: [],
    failed: [],
    summary: { requested: input.items.length, created: 0, duplicates: 0, failed: 0 },
  };

  const seenInBatch = new Set<string>();

  for (const raw of input.items) {
    const parsed = parseCommitItem((raw ?? {}) as ImportCommitItemInput);
    if (!parsed.ok) {
      result.failed.push({
        productName: parsed.productName,
        canonicalUrl: parsed.canonicalUrl,
        code: parsed.code,
        message: parsed.message,
      });
      result.summary.failed += 1;
      continue;
    }

    const item = parsed.value;
    const batchKey = `${item.canonicalUrl}||${item.productName.toLowerCase()}`;
    if (seenInBatch.has(batchKey)) {
      result.duplicates.push({
        productName: item.productName,
        canonicalUrl: item.canonicalUrl,
        duplicateCandidateId: null,
        duplicateProductId: null,
        code: "DUPLICATE_CANDIDATE",
      });
      result.summary.duplicates += 1;
      continue;
    }
    seenInBatch.add(batchKey);

    const safe = await assertSafePublicHttpsUrl(item.canonicalUrl);
    if (!safe.ok) {
      result.failed.push({
        productName: item.productName,
        canonicalUrl: item.canonicalUrl,
        code: safe.code,
        message: safe.message,
      });
      result.summary.failed += 1;
      continue;
    }

    try {
      const dup = await findImportDuplicate(client, {
        canonicalUrl: item.canonicalUrl,
        productName: item.productName,
        brandName: item.brandName,
      });
      if (dup?.kind === "candidate") {
        result.duplicates.push({
          productName: item.productName,
          canonicalUrl: item.canonicalUrl,
          duplicateCandidateId: dup.candidateId,
          duplicateProductId: null,
          code: "DUPLICATE_CANDIDATE",
        });
        result.summary.duplicates += 1;
        continue;
      }
      if (dup?.kind === "product") {
        result.duplicates.push({
          productName: item.productName,
          canonicalUrl: item.canonicalUrl,
          duplicateCandidateId: null,
          duplicateProductId: dup.productId,
          code: "DUPLICATE_PRODUCT",
        });
        result.summary.duplicates += 1;
        continue;
      }

      const { data, error } = await client
        .from("product_discovery_candidates")
        .insert({
          discovered_name: item.productName,
          discovered_brand: item.brandName,
          discovered_url: item.canonicalUrl,
          discovered_country: item.detectedCountry,
          source_type: item.sourceType,
          notes: item.notes,
          workflow_status: "discovered",
          duplicate_check_status: "pending",
          sale_check_status: "pending",
          ingredient_check_status: "pending",
          evidence_check_status: "pending",
          safety_check_status: "pending",
          linked_product_id: null,
          assigned_to: null,
          search_query: null,
        })
        .select("id, discovered_name, discovered_brand, discovered_url")
        .single();

      if (error || !data) {
        result.failed.push({
          productName: item.productName,
          canonicalUrl: item.canonicalUrl,
          code: "INTERNAL_ERROR",
          message: "후보 등록에 실패했습니다.",
        });
        result.summary.failed += 1;
        continue;
      }

      const row = data as {
        id: string;
        discovered_name: string;
        discovered_brand: string | null;
        discovered_url: string;
      };

      await tryInsertWriteAudit(client, {
        action: "candidate_imported_from_url",
        productId: null,
        sourceUrl: null,
        actorRole: session.role,
        metadata: {
          candidateId: row.id,
          domain: extractDomain(row.discovered_url),
          sourceType: item.sourceType,
        },
      });

      let queueId: string | null = null;
      if (createDuplicateQueue) {
        const { data: openRows } = await client
          .from("verification_queue")
          .select("id")
          .eq("entity_type", "candidate")
          .eq("entity_id", row.id)
          .eq("review_type", "duplicate")
          .in("status", ["pending", "in_review"])
          .limit(1);

        const existing = (openRows ?? [])[0] as { id: string } | undefined;
        if (existing) {
          queueId = existing.id;
        } else {
          const { data: queue, error: qErr } = await client
            .from("verification_queue")
            .insert({
              entity_type: "candidate",
              entity_id: row.id,
              review_type: "duplicate",
              priority: 100,
              status: "pending",
              reason: "URL import auto queue",
              reviewer_notes: null,
              reviewed_at: null,
              assigned_to: null,
            })
            .select("id")
            .single();

          if (!qErr && queue) {
            queueId = (queue as { id: string }).id;
            await tryInsertWriteAudit(client, {
              action: "verification_queue_created",
              productId: null,
              actorRole: session.role,
              metadata: {
                queueId,
                entityType: "candidate",
                entityId: row.id,
                reviewType: "duplicate",
                via: "url_import",
              },
            });
          }
        }
      }

      result.created.push({
        id: row.id,
        productName: row.discovered_name,
        brandName: row.discovered_brand,
        canonicalUrl: row.discovered_url,
        queueId,
      });
      result.summary.created += 1;
    } catch {
      result.failed.push({
        productName: item.productName,
        canonicalUrl: item.canonicalUrl,
        code: "INTERNAL_ERROR",
        message: "후보 등록에 실패했습니다.",
      });
      result.summary.failed += 1;
    }
  }

  return result;
}
