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
import {
  buildMediaReviewChecklist,
  decideMediaAssetPublication,
  evaluateRightsWindow,
  isMediaVerificationStatus,
  type MediaAssetRecord,
  type MediaReviewChecklist,
  type MediaRightsRecord,
  type MediaVerificationStatus,
} from "@/lib/media/mediaAssetLibrary";

const DEFAULT_PAGE_SIZE = 20;
const NOTE_MAX = 2000;

/** The library tables ship in migration 20260727120000; Staging may not have it yet. */
export const MEDIA_LIBRARY_MIGRATION =
  "supabase/migrations/20260727120000_create_media_asset_library.sql";

function isMissingRelation(message: string): boolean {
  return /does not exist|PGRST205|schema cache|relation .* does not exist/i.test(
    message
  );
}

const ASSET_COLUMNS = [
  "id",
  "asset_type",
  "media_type",
  "scope",
  "source_type",
  "source_url",
  "source_page_url",
  "storage_url",
  "embed_provider",
  "embed_id",
  "channel_name",
  "channel_url",
  "title",
  "summary",
  "language",
  "country",
  "duration_seconds",
  "routine_step",
  "time_of_day",
  "category_slug",
  "concern_tags",
  "body_area_tags",
  "content_relationship",
  "disclosure",
  "is_sponsored",
  "sponsor_name",
  "is_ai_generated",
  "contains_medical_claim",
  "contains_before_after",
  "shows_product_name",
  "verification_status",
  "verified_at",
  "review_note",
  "last_checked_at",
  "is_accessible",
  "next_check_due_at",
  "created_at",
].join(", ");

const RIGHTS_COLUMNS = [
  "id",
  "media_asset_id",
  "rights_status",
  "rights_basis",
  "rights_holder",
  "allows_embed",
  "allows_copy",
  "allows_download",
  "allows_modification",
  "rights_start_at",
  "rights_end_at",
  "is_worldwide",
  "territory_codes",
  "evidence_url",
  "evidence_note",
  "review_due_at",
].join(", ");

type AssetRow = Record<string, unknown>;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapAsset(row: AssetRow): MediaAssetRecord {
  return {
    id: String(row.id),
    assetType: row.asset_type as MediaAssetRecord["assetType"],
    mediaType: row.media_type as MediaAssetRecord["mediaType"],
    scope: row.scope as MediaAssetRecord["scope"],
    sourceType: row.source_type as MediaAssetRecord["sourceType"],
    sourceUrl: (row.source_url as string | null) ?? null,
    sourcePageUrl: (row.source_page_url as string | null) ?? null,
    storageUrl: (row.storage_url as string | null) ?? null,
    embedProvider: row.embed_provider as MediaAssetRecord["embedProvider"],
    embedId: (row.embed_id as string | null) ?? null,
    title: String(row.title ?? ""),
    language: String(row.language ?? "ko"),
    country: (row.country as string | null) ?? null,
    durationSeconds: (row.duration_seconds as number | null) ?? null,
    routineStep: (row.routine_step as string | null) ?? null,
    timeOfDay: (row.time_of_day as MediaAssetRecord["timeOfDay"]) ?? null,
    categorySlug: (row.category_slug as string | null) ?? null,
    concernTags: toStringArray(row.concern_tags),
    bodyAreaTags: toStringArray(row.body_area_tags),
    contentRelationship:
      row.content_relationship as MediaAssetRecord["contentRelationship"],
    disclosure: (row.disclosure as string | null) ?? null,
    isSponsored: Boolean(row.is_sponsored),
    sponsorName: (row.sponsor_name as string | null) ?? null,
    isAiGenerated: Boolean(row.is_ai_generated),
    containsMedicalClaim: Boolean(row.contains_medical_claim),
    containsBeforeAfter: Boolean(row.contains_before_after),
    showsProductName: Boolean(row.shows_product_name),
    verificationStatus:
      row.verification_status as MediaAssetRecord["verificationStatus"],
    verifiedAt: (row.verified_at as string | null) ?? null,
    isAccessible: Boolean(row.is_accessible),
  };
}

function mapRights(row: AssetRow): MediaRightsRecord {
  return {
    id: String(row.id),
    mediaAssetId: String(row.media_asset_id),
    rightsStatus: row.rights_status as MediaRightsRecord["rightsStatus"],
    rightsBasis: String(row.rights_basis ?? ""),
    rightsHolder: String(row.rights_holder ?? ""),
    allowsEmbed: Boolean(row.allows_embed),
    allowsCopy: Boolean(row.allows_copy),
    allowsDownload: Boolean(row.allows_download),
    allowsModification: Boolean(row.allows_modification),
    rightsStartAt: (row.rights_start_at as string | null) ?? null,
    rightsEndAt: (row.rights_end_at as string | null) ?? null,
    isWorldwide: Boolean(row.is_worldwide),
    territoryCodes: toStringArray(row.territory_codes),
    evidenceUrl: (row.evidence_url as string | null) ?? null,
    reviewDueAt: (row.review_due_at as string | null) ?? null,
  };
}

export type MediaReviewItem = {
  asset: MediaAssetRecord;
  rights: MediaRightsRecord[];
  checklist: MediaReviewChecklist;
  publishable: boolean;
  blockingReasons: string[];
  rightsWindow: string;
  /** Extra rights fields the checklist does not carry, for display only. */
  rightsNotes: Array<{ id: string; evidenceNote: string | null }>;
};

export type MediaReviewFilters = {
  status: "" | MediaVerificationStatus;
  scope: "" | "category_common" | "product_specific" | "brand_general";
  statuses: MediaVerificationStatus[];
};

export type MediaReviewListResult = {
  schemaReady: true;
  items: MediaReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: MediaReviewFilters;
  counts: Record<string, number>;
};

export type MediaReviewSchemaMissing = {
  schemaReady: false;
  migrationPath: string;
};

export type MediaReviewListParams = {
  page?: string | string[] | null;
  status?: string | string[] | null;
  scope?: string | string[] | null;
};

function firstParam(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
}

export function parseMediaReviewListParams(
  raw: Record<string, string | string[] | undefined> | URLSearchParams
): { page: number; status: string; scope: string } {
  const read = (key: string): string =>
    raw instanceof URLSearchParams
      ? normalizeText(raw.get(key))
      : firstParam((raw as Record<string, string | string[] | undefined>)[key]);

  return {
    page: parsePositiveInt(read("page"), 1, 10_000),
    status: read("status"),
    scope: read("scope"),
  };
}

const SCOPES = new Set(["category_common", "product_specific", "brand_general"]);

/**
 * Review queue. Returns `schemaReady: false` instead of throwing when the media
 * library migration has not been applied — a Staging DB without it is an expected
 * state in this track, not an error the reviewer should see as a crash.
 */
export async function getMediaReviewQueue(
  params: MediaReviewListParams = {}
): Promise<MediaReviewListResult | MediaReviewSchemaMissing> {
  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const parsed = parseMediaReviewListParams(
    params as Record<string, string | string[] | undefined>
  );
  const status = isMediaVerificationStatus(parsed.status) ? parsed.status : "";
  const scope = SCOPES.has(parsed.scope)
    ? (parsed.scope as MediaReviewFilters["scope"])
    : "";
  const pageSize = DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.min(parsed.page, 10_000));

  let query = client
    .from("media_assets")
    .select(ASSET_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("verification_status", status);
  if (scope) query = query.eq("scope", scope);

  const { data, error, count } = await query;
  if (error) {
    if (isMissingRelation(error.message)) {
      return { schemaReady: false, migrationPath: MEDIA_LIBRARY_MIGRATION };
    }
    throw new AdminConfigurationError();
  }

  const assets = ((data ?? []) as unknown as AssetRow[]).map(mapAsset);
  const assetIds = assets.map((asset) => asset.id);

  let rightsRows: AssetRow[] = [];
  if (assetIds.length > 0) {
    const { data: rights, error: rightsError } = await client
      .from("media_rights")
      .select(RIGHTS_COLUMNS)
      .in("media_asset_id", assetIds);
    if (rightsError && !isMissingRelation(rightsError.message)) {
      throw new AdminConfigurationError();
    }
    rightsRows = (rights ?? []) as unknown as AssetRow[];
  }

  const rightsByAsset = new Map<string, AssetRow[]>();
  for (const row of rightsRows) {
    const key = String(row.media_asset_id);
    const list = rightsByAsset.get(key) ?? [];
    list.push(row);
    rightsByAsset.set(key, list);
  }

  const now = new Date();
  const items: MediaReviewItem[] = assets.map((asset) => {
    const rawRights = rightsByAsset.get(asset.id) ?? [];
    const rights = rawRights.map(mapRights);
    const decision = decideMediaAssetPublication(asset, rights, {
      now,
      countryCode: asset.country,
    });
    return {
      asset,
      rights,
      checklist: buildMediaReviewChecklist(asset, rights, now),
      publishable: decision.publishable,
      blockingReasons: decision.reasonCodes,
      rightsWindow: decision.rightsWindow,
      rightsNotes: rawRights.map((row) => ({
        id: String(row.id),
        evidenceNote: (row.evidence_note as string | null) ?? null,
      })),
    };
  });

  // status tallies for the header, independent of the current filter
  const counts: Record<string, number> = {};
  const { data: allStatuses } = await client
    .from("media_assets")
    .select("verification_status")
    .limit(5000);
  for (const row of allStatuses ?? []) {
    const key = String((row as unknown as AssetRow).verification_status);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const total = count ?? items.length;
  return {
    schemaReady: true,
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: {
      status,
      scope,
      statuses: [
        "draft",
        "needs_review",
        "approved",
        "rejected",
        "expired",
        "revoked",
      ],
    },
    counts,
  };
}

export async function getMediaReviewItem(
  id: string
): Promise<MediaReviewItem | null | MediaReviewSchemaMissing> {
  const assetId = parseUuid(id);
  if (!assetId) return null;

  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const { data, error } = await client
    .from("media_assets")
    .select(ASSET_COLUMNS)
    .eq("id", assetId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) {
      return { schemaReady: false, migrationPath: MEDIA_LIBRARY_MIGRATION };
    }
    throw new AdminConfigurationError();
  }
  if (!data) return null;

  const asset = mapAsset(data as unknown as AssetRow);
  const { data: rightsData } = await client
    .from("media_rights")
    .select(RIGHTS_COLUMNS)
    .eq("media_asset_id", assetId);
  const rawRights = (rightsData ?? []) as unknown as AssetRow[];
  const rights = rawRights.map(mapRights);

  const now = new Date();
  const decision = decideMediaAssetPublication(asset, rights, {
    now,
    countryCode: asset.country,
  });

  return {
    asset,
    rights,
    checklist: buildMediaReviewChecklist(asset, rights, now),
    publishable: decision.publishable,
    blockingReasons: decision.reasonCodes,
    rightsWindow: decision.rightsWindow,
    rightsNotes: rawRights.map((row) => ({
      id: String(row.id),
      evidenceNote: (row.evidence_note as string | null) ?? null,
    })),
  };
}

export const MEDIA_REVIEW_DECISIONS = [
  "approved",
  "rejected",
  "needs_review",
  "revoked",
] as const;
export type MediaReviewDecision = (typeof MEDIA_REVIEW_DECISIONS)[number];

const DECISION_TO_STATUS: Record<MediaReviewDecision, MediaVerificationStatus> = {
  approved: "approved",
  rejected: "rejected",
  needs_review: "needs_review",
  revoked: "revoked",
};

export type SubmitMediaReviewInput = {
  decision?: unknown;
  note?: unknown;
};

/**
 * Record a review decision.
 *
 * Approval is refused when the asset would not actually be publishable — the
 * reviewer cannot wave through an expired grant, a stored copy of someone else's
 * video, or an undisclosed sponsorship. Everything lands in media_review_events.
 */
export async function submitMediaReview(
  session: AdminSession,
  id: string,
  input: SubmitMediaReviewInput
) {
  const assetId = parseUuid(id);
  if (!assetId) throw invalidInput("영상 id가 올바르지 않습니다.");

  const decision = String(input.decision ?? "") as MediaReviewDecision;
  if (!(MEDIA_REVIEW_DECISIONS as readonly string[]).includes(decision)) {
    throw invalidInput("decision은 approved / rejected / needs_review / revoked 중 하나입니다.");
  }

  const note =
    typeof input.note === "string"
      ? normalizeOptionalText(stripControlAndHtml(input.note), NOTE_MAX)
      : null;

  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const { data: assetRow, error: loadError } = await client
    .from("media_assets")
    .select(ASSET_COLUMNS)
    .eq("id", assetId)
    .maybeSingle();
  if (loadError) {
    if (isMissingRelation(loadError.message)) {
      throw preconditionFailed(
        `미디어 라이브러리 스키마가 아직 적용되지 않았습니다. ${MEDIA_LIBRARY_MIGRATION} 적용 후 다시 시도하세요.`
      );
    }
    throw internalWriteError();
  }
  if (!assetRow) throw notFound("영상을 찾을 수 없습니다.");

  const asset = mapAsset(assetRow as unknown as AssetRow);
  const { data: rightsData } = await client
    .from("media_rights")
    .select(RIGHTS_COLUMNS)
    .eq("media_asset_id", assetId);
  const rights = ((rightsData ?? []) as unknown as AssetRow[]).map(mapRights);

  const now = new Date();
  const evaluation = decideMediaAssetPublication(asset, rights, {
    now,
    countryCode: asset.country,
  });

  if (decision === "approved" && !evaluation.publishable) {
    throw preconditionFailed(
      "승인할 수 없습니다. 권리·고지·안전 조건이 아직 충족되지 않았습니다.",
      { reasonCodes: evaluation.reasonCodes }
    );
  }
  if (decision === "rejected" && !note) {
    throw invalidInput("반려 사유를 입력해야 합니다.");
  }

  const nextStatus = DECISION_TO_STATUS[decision];
  const { error: updateError } = await client
    .from("media_assets")
    .update({
      verification_status: nextStatus,
      verified_at: decision === "approved" ? now.toISOString() : asset.verifiedAt,
      verified_by: decision === "approved" ? session.userId : null,
      review_note: note,
      updated_at: now.toISOString(),
    })
    .eq("id", assetId);
  if (updateError) throw internalWriteError();

  const { error: eventError } = await client.from("media_review_events").insert({
    media_asset_id: assetId,
    reviewer_id: session.userId,
    decision,
    previous_status: asset.verificationStatus,
    reason_codes:
      decision === "rejected" || decision === "revoked"
        ? evaluation.reasonCodes.length > 0
          ? evaluation.reasonCodes
          : ["reviewer_decision"]
        : [],
    note,
  });
  if (eventError) throw internalWriteError();

  return {
    id: assetId,
    decision,
    verificationStatus: nextStatus,
    rightsWindow: evaluation.rightsWindow,
  };
}

/** Rights that expire within `days` — the §41 re-check worklist. */
export async function getExpiringMediaRights(days = 30) {
  const client = createSupabaseAdminClient();
  if (!client) throw new AdminConfigurationError();

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const { data, error } = await client
    .from("media_rights")
    .select(RIGHTS_COLUMNS)
    .gt("rights_end_at", now.toISOString())
    .lte("rights_end_at", horizon.toISOString())
    .order("rights_end_at", { ascending: true })
    .limit(100);

  if (error) {
    if (isMissingRelation(error.message)) return [];
    throw new AdminConfigurationError();
  }

  return ((data ?? []) as unknown as AssetRow[]).map((row) => {
    const rights = mapRights(row);
    return { ...rights, window: evaluateRightsWindow(rights, now) };
  });
}
