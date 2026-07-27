import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import type { AdminSession } from "@/lib/auth/admin";
import {
  internalWriteError,
  invalidInput,
  notFound,
  preconditionFailed,
} from "@/lib/admin/write-errors";
import { normalizeText, parsePositiveInt, parseUuid } from "@/lib/admin/query";
import { normalizeOptionalText, stripControlAndHtml } from "@/lib/admin/sanitize";

const DEFAULT_PAGE_SIZE = 20;
const NOTE_MAX = 2000;

export const USAGE_GUIDE_MIGRATION =
  "supabase/migrations/20260727150000_create_product_usage_guides.sql";

function isMissingRelation(message: string): boolean {
  return /does not exist|PGRST205|schema cache/i.test(message);
}

const GUIDE_COLUMNS = [
  "id",
  "product_id",
  "variant_id",
  "locale",
  "amount_label",
  "order_index",
  "order_hints",
  "frequency",
  "time_of_day",
  "application_area",
  "method_steps",
  "caution_text",
  "statutory_notices",
  "combination_cautions",
  "patch_test_recommended",
  "patch_test_wait_hours",
  "patch_test_steps",
  "source_type",
  "source_url",
  "source_domain",
  "source_excerpt",
  "extraction_method",
  "content_hash",
  "contains_medical_claim",
  "verification_status",
  "verified_at",
  "review_note",
  "missing_fields",
  "last_checked_at",
  "next_check_due_at",
  "created_at",
].join(", ");

type Row = Record<string, unknown>;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export type UsageGuideRecord = {
  id: string;
  productId: number;
  productName: string | null;
  brand: string | null;
  locale: string;
  amountLabel: string | null;
  orderIndex: number;
  orderHints: string[];
  frequency: string | null;
  timeOfDay: string | null;
  applicationArea: string[];
  methodSteps: string[];
  cautionText: string[];
  statutoryNotices: string[];
  combinationCautions: string[];
  patchTestRecommended: boolean;
  patchTestWaitHours: number | null;
  patchTestSteps: string[];
  sourceType: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  sourceExcerpt: string | null;
  extractionMethod: string;
  containsMedicalClaim: boolean;
  verificationStatus: string;
  verifiedAt: string | null;
  reviewNote: string | null;
  missingFields: string[];
  lastCheckedAt: string | null;
  nextCheckDueAt: string | null;
};

function mapGuide(row: Row): UsageGuideRecord {
  return {
    id: String(row.id),
    productId: Number(row.product_id),
    productName: null,
    brand: null,
    locale: String(row.locale ?? "ko"),
    amountLabel: (row.amount_label as string | null) ?? null,
    orderIndex: Number(row.order_index ?? 1),
    orderHints: toStringArray(row.order_hints),
    frequency: (row.frequency as string | null) ?? null,
    timeOfDay: (row.time_of_day as string | null) ?? null,
    applicationArea: toStringArray(row.application_area),
    methodSteps: toStringArray(row.method_steps),
    cautionText: toStringArray(row.caution_text),
    statutoryNotices: toStringArray(row.statutory_notices),
    combinationCautions: toStringArray(row.combination_cautions),
    patchTestRecommended: Boolean(row.patch_test_recommended),
    patchTestWaitHours: (row.patch_test_wait_hours as number | null) ?? null,
    patchTestSteps: toStringArray(row.patch_test_steps),
    sourceType: String(row.source_type ?? ""),
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceDomain: (row.source_domain as string | null) ?? null,
    sourceExcerpt: (row.source_excerpt as string | null) ?? null,
    extractionMethod: String(row.extraction_method ?? ""),
    containsMedicalClaim: Boolean(row.contains_medical_claim),
    verificationStatus: String(row.verification_status ?? "draft"),
    verifiedAt: (row.verified_at as string | null) ?? null,
    reviewNote: (row.review_note as string | null) ?? null,
    missingFields: toStringArray(row.missing_fields),
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    nextCheckDueAt: (row.next_check_due_at as string | null) ?? null,
  };
}

/**
 * What stops this guide from being approved.
 *
 * Mirrors product_usage_guides_approved_requires_evidence_chk plus the checks a
 * CHECK constraint cannot express (does every extracted claim appear in the
 * excerpt the reviewer is looking at?).
 */
export function blockingReasonsForApproval(guide: UsageGuideRecord): string[] {
  const reasons: string[] = [];
  if (guide.methodSteps.length === 0) reasons.push("method_steps_missing");
  if (guide.containsMedicalClaim) reasons.push("medical_claim_present");
  if (!guide.sourceUrl && !guide.reviewNote) reasons.push("source_missing");
  if (
    guide.extractionMethod === "automated_extraction" &&
    !guide.sourceExcerpt
  ) {
    reasons.push("source_excerpt_missing");
  }
  if (guide.patchTestRecommended && guide.patchTestSteps.length === 0) {
    reasons.push("patch_test_steps_missing");
  }
  return reasons;
}

/**
 * Does each extracted value actually occur in the stored source excerpt?
 * A field the excerpt does not contain is the signature of an extraction bug —
 * exactly what a reviewer needs pointed out.
 */
export function fieldsNotFoundInSource(guide: UsageGuideRecord): string[] {
  if (!guide.sourceExcerpt) return [];
  const excerpt = guide.sourceExcerpt.replace(/\s+/g, " ");
  const unmatched: string[] = [];
  if (guide.amountLabel && !excerpt.includes(guide.amountLabel)) {
    unmatched.push(`도포량: ${guide.amountLabel}`);
  }
  for (const step of guide.methodSteps) {
    const head = step.slice(0, 12);
    if (head && !excerpt.includes(head)) unmatched.push(`단계: ${head}…`);
  }
  return unmatched;
}

export type UsageGuideReviewItem = {
  guide: UsageGuideRecord;
  blockingReasons: string[];
  unmatchedFields: string[];
  approvable: boolean;
};

export type UsageGuideListResult = {
  schemaReady: true;
  items: UsageGuideReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: { status: string; locale: string };
  counts: Record<string, number>;
};

export type UsageGuideSchemaMissing = {
  schemaReady: false;
  migrationPath: string;
};

const STATUSES = new Set([
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "expired",
  "superseded",
]);

function firstParam(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
}

export function parseUsageGuideListParams(
  raw: Record<string, string | string[] | undefined> | URLSearchParams
): { page: number; status: string; locale: string } {
  const read = (key: string): string =>
    raw instanceof URLSearchParams
      ? normalizeText(raw.get(key))
      : firstParam((raw as Record<string, string | string[] | undefined>)[key]);
  return {
    page: parsePositiveInt(read("page"), 1, 10_000),
    status: read("status"),
    locale: read("locale"),
  };
}

async function attachProductNames(
  client: ReturnType<typeof createSupabaseAdminClient>,
  guides: UsageGuideRecord[]
): Promise<void> {
  if (!client || guides.length === 0) return;
  const ids = [...new Set(guides.map((guide) => guide.productId))];
  const { data } = await client
    .from("products")
    .select("id, name, brand")
    .in("id", ids);
  const byId = new Map(
    ((data ?? []) as unknown as Row[]).map((row) => [Number(row.id), row])
  );
  for (const guide of guides) {
    const product = byId.get(guide.productId);
    if (!product) continue;
    guide.productName = (product.name as string | null) ?? null;
    guide.brand = (product.brand as string | null) ?? null;
  }
}

function buildItem(guide: UsageGuideRecord): UsageGuideReviewItem {
  const blockingReasons = blockingReasonsForApproval(guide);
  return {
    guide,
    blockingReasons,
    unmatchedFields: fieldsNotFoundInSource(guide),
    approvable: blockingReasons.length === 0,
  };
}

export async function getUsageGuideQueue(
  params: Record<string, string | string[] | undefined> = {}
): Promise<UsageGuideListResult | UsageGuideSchemaMissing> {
  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const parsed = parseUsageGuideListParams(params);
  const status = STATUSES.has(parsed.status) ? parsed.status : "";
  const locale = /^[a-z]{2}$/i.test(parsed.locale) ? parsed.locale : "";
  const pageSize = DEFAULT_PAGE_SIZE;
  const page = parsed.page;

  let query = client
    .from("product_usage_guides")
    .select(GUIDE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (status) query = query.eq("verification_status", status);
  if (locale) query = query.eq("locale", locale);

  const { data, error, count } = await query;
  if (error) {
    if (isMissingRelation(error.message)) {
      return { schemaReady: false, migrationPath: USAGE_GUIDE_MIGRATION };
    }
    throw new AdminConfigurationError();
  }

  const guides = ((data ?? []) as unknown as Row[]).map(mapGuide);
  await attachProductNames(client, guides);

  const counts: Record<string, number> = {};
  const { data: statusRows } = await client
    .from("product_usage_guides")
    .select("verification_status")
    .limit(5000);
  for (const row of (statusRows ?? []) as unknown as Row[]) {
    const key = String(row.verification_status);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const total = count ?? guides.length;
  return {
    schemaReady: true,
    items: guides.map(buildItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: { status, locale },
    counts,
  };
}

export async function getUsageGuideItem(
  id: string
): Promise<UsageGuideReviewItem | null | UsageGuideSchemaMissing> {
  const guideId = parseUuid(id);
  if (!guideId) return null;

  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const { data, error } = await client
    .from("product_usage_guides")
    .select(GUIDE_COLUMNS)
    .eq("id", guideId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) {
      return { schemaReady: false, migrationPath: USAGE_GUIDE_MIGRATION };
    }
    throw new AdminConfigurationError();
  }
  if (!data) return null;

  const guide = mapGuide(data as unknown as Row);
  await attachProductNames(client, [guide]);
  return buildItem(guide);
}

export const USAGE_GUIDE_DECISIONS = [
  "approved",
  "rejected",
  "needs_review",
  "superseded",
] as const;
export type UsageGuideDecision = (typeof USAGE_GUIDE_DECISIONS)[number];

/**
 * Record a review decision.
 *
 * Approval is refused when the guide would not satisfy the schema's evidence
 * gate, so a reviewer cannot approve a guide with no steps or no source. The
 * database would reject the write anyway; failing here gives a readable reason.
 */
export async function submitUsageGuideReview(
  session: AdminSession,
  id: string,
  input: { decision?: unknown; note?: unknown }
) {
  const guideId = parseUuid(id);
  if (!guideId) throw invalidInput("가이드 id가 올바르지 않습니다.");

  const decision = String(input.decision ?? "") as UsageGuideDecision;
  if (!(USAGE_GUIDE_DECISIONS as readonly string[]).includes(decision)) {
    throw invalidInput(
      "decision은 approved / rejected / needs_review / superseded 중 하나입니다."
    );
  }

  const note =
    typeof input.note === "string"
      ? normalizeOptionalText(stripControlAndHtml(input.note), NOTE_MAX)
      : null;

  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const { data, error } = await client
    .from("product_usage_guides")
    .select(GUIDE_COLUMNS)
    .eq("id", guideId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) {
      throw preconditionFailed(
        `사용 가이드 스키마가 아직 적용되지 않았습니다. ${USAGE_GUIDE_MIGRATION} 적용 후 다시 시도하세요.`
      );
    }
    throw internalWriteError();
  }
  if (!data) throw notFound("사용 가이드를 찾을 수 없습니다.");

  const guide = mapGuide(data as unknown as Row);
  const blocking = blockingReasonsForApproval(guide);

  if (decision === "approved" && blocking.length > 0) {
    throw preconditionFailed(
      "승인할 수 없습니다. 근거가 되는 원문·단계가 아직 갖춰지지 않았습니다.",
      { reasonCodes: blocking }
    );
  }
  if (decision === "rejected" && !note) {
    throw invalidInput("반려 사유를 입력해야 합니다.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from("product_usage_guides")
    .update({
      verification_status: decision,
      verified_at: decision === "approved" ? now : null,
      verified_by: decision === "approved" ? session.userId : null,
      review_note: note,
      updated_at: now,
    })
    .eq("id", guideId);
  if (updateError) throw internalWriteError();

  const { error: eventError } = await client
    .from("product_usage_guide_review_events")
    .insert({
      usage_guide_id: guideId,
      reviewer_id: session.userId,
      decision,
      previous_status: guide.verificationStatus,
      reason_codes:
        decision === "rejected"
          ? blocking.length > 0
            ? blocking
            : ["reviewer_decision"]
          : [],
      note,
    });
  if (eventError) throw internalWriteError();

  return { id: guideId, decision, verificationStatus: decision };
}
