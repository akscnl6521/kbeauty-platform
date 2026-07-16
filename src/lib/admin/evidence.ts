import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/auth/admin";
import { ADMIN_ROLE_CAPABILITIES } from "@/lib/auth/roles";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import {
  escapeIlike,
  isSafeHttpsUrl,
  normalizeText,
  parsePositiveBigIntId,
  parsePositiveInt,
  parseUuid,
} from "@/lib/admin/query";
import {
  AdminWriteError,
  conflict,
  internalWriteError,
  invalidInput,
  notFound,
} from "@/lib/admin/write-errors";

const EVIDENCE_TYPES = new Set([
  "cosmetic_study",
  "drug_study",
  "guideline",
  "claim",
]);

const EVIDENCE_LEVELS = new Set([
  "systematic_review",
  "randomized_controlled_trial",
  "controlled_clinical_study",
  "observational_study",
  "expert_guideline",
  "in_vitro",
  "manufacturer_claim",
  "insufficient",
]);

const REVIEW_STATUSES = new Set([
  "pending",
  "in_review",
  "approved",
  "rejected",
  "needs_review",
]);

export type AdminEvidenceListItem = {
  id: string;
  ingredientId: number;
  ingredientSlug: string | null;
  ingredientNameEn: string | null;
  concernId: string | null;
  concernCode: string | null;
  concernNameKo: string | null;
  evidenceType: string;
  evidenceLevel: string;
  reviewStatus: string;
  pmid: string | null;
  doi: string | null;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
  publicationYear: number | null;
  outcomeSummary: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminEvidenceListResult = {
  items: AdminEvidenceListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    q: string;
    reviewStatus: string;
    evidenceLevel: string;
    ingredientId: string;
  };
};

function getClient(): SupabaseClient {
  try {
    return createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }
}

function forbidden(message: string): AdminWriteError {
  return new AdminWriteError("FORBIDDEN", 403, message);
}

export function parseAdminEvidenceListParams(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  q: string;
  reviewStatus: string;
  evidenceLevel: string;
  ingredientId: string;
} {
  return {
    page: parsePositiveInt(searchParams.get("page"), 1),
    pageSize: parsePositiveInt(searchParams.get("pageSize"), 20, 100),
    q: normalizeText(searchParams.get("q")),
    reviewStatus: normalizeText(searchParams.get("reviewStatus")),
    evidenceLevel: normalizeText(searchParams.get("evidenceLevel")),
    ingredientId: normalizeText(searchParams.get("ingredientId")),
  };
}

export async function listAdminEvidence(params: {
  page: number;
  pageSize: number;
  q: string;
  reviewStatus: string;
  evidenceLevel: string;
  ingredientId: string;
}): Promise<AdminEvidenceListResult> {
  const client = getClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = client
    .from("ingredient_evidence")
    .select(
      "id, ingredient_id, concern_id, evidence_type, evidence_level, review_status, pmid, doi, source_url, publication_year, outcome_summary, reviewed_at, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.reviewStatus && REVIEW_STATUSES.has(params.reviewStatus)) {
    query = query.eq("review_status", params.reviewStatus);
  }
  if (params.evidenceLevel && EVIDENCE_LEVELS.has(params.evidenceLevel)) {
    query = query.eq("evidence_level", params.evidenceLevel);
  }
  const ingredientIdNum = parsePositiveBigIntId(params.ingredientId);
  if (ingredientIdNum != null) {
    query = query.eq("ingredient_id", ingredientIdNum);
  }
  if (params.q) {
    const esc = escapeIlike(params.q);
    query = query.or(
      `pmid.ilike.%${esc}%,doi.ilike.%${esc}%,outcome_summary.ilike.%${esc}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw internalWriteError();

  const rows = data ?? [];
  const ingredientIds = [
    ...new Set(
      rows
        .map((r) => Number((r as { ingredient_id?: unknown }).ingredient_id))
        .filter((n) => Number.isFinite(n))
    ),
  ];
  const concernIds = [
    ...new Set(
      rows
        .map((r) => String((r as { concern_id?: unknown }).concern_id ?? ""))
        .filter(Boolean)
    ),
  ];

  const ingredientMap = new Map<
    number,
    { slug: string | null; nameEn: string | null }
  >();
  if (ingredientIds.length > 0) {
    const { data: ings } = await client
      .from("ingredients")
      .select("id, slug, name_en")
      .in("id", ingredientIds);
    for (const row of ings ?? []) {
      ingredientMap.set(Number(row.id), {
        slug: typeof row.slug === "string" ? row.slug : null,
        nameEn: typeof row.name_en === "string" ? row.name_en : null,
      });
    }
  }

  const concernMap = new Map<
    string,
    { code: string | null; nameKo: string | null }
  >();
  if (concernIds.length > 0) {
    const { data: concerns } = await client
      .from("skin_concerns")
      .select("id, code, name_ko")
      .in("id", concernIds);
    for (const row of concerns ?? []) {
      concernMap.set(String(row.id), {
        code: typeof row.code === "string" ? row.code : null,
        nameKo: typeof row.name_ko === "string" ? row.name_ko : null,
      });
    }
  }

  const items: AdminEvidenceListItem[] = rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    const ingredientId = Number(r.ingredient_id);
    const concernId = typeof r.concern_id === "string" ? r.concern_id : null;
    const ing = ingredientMap.get(ingredientId);
    const concern = concernId ? concernMap.get(concernId) : undefined;
    const sourceUrl =
      typeof r.source_url === "string" ? r.source_url.trim() : null;
    return {
      id: String(r.id),
      ingredientId,
      ingredientSlug: ing?.slug ?? null,
      ingredientNameEn: ing?.nameEn ?? null,
      concernId,
      concernCode: concern?.code ?? null,
      concernNameKo: concern?.nameKo ?? null,
      evidenceType: String(r.evidence_type ?? ""),
      evidenceLevel: String(r.evidence_level ?? ""),
      reviewStatus: String(r.review_status ?? ""),
      pmid: typeof r.pmid === "string" ? r.pmid : null,
      doi: typeof r.doi === "string" ? r.doi : null,
      sourceUrl,
      sourceUrlSafeHttps: isSafeHttpsUrl(sourceUrl),
      publicationYear:
        typeof r.publication_year === "number" ? r.publication_year : null,
      outcomeSummary:
        typeof r.outcome_summary === "string" ? r.outcome_summary : null,
      reviewedAt: typeof r.reviewed_at === "string" ? r.reviewed_at : null,
      createdAt: String(r.created_at ?? ""),
    };
  });

  const total = count ?? items.length;
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    filters: {
      q: params.q,
      reviewStatus: params.reviewStatus,
      evidenceLevel: params.evidenceLevel,
      ingredientId: params.ingredientId,
    },
  };
}

function validateCitation(input: {
  pmid: string | null;
  doi: string | null;
  sourceUrl: string | null;
}): void {
  const has =
    Boolean(input.pmid?.trim()) ||
    Boolean(input.doi?.trim()) ||
    Boolean(input.sourceUrl?.trim());
  if (!has) {
    throw invalidInput("PMID, DOI, sourceUrl 중 하나 이상이 필요합니다.");
  }
  if (input.pmid && !/^\d{5,9}$/.test(input.pmid.trim())) {
    throw invalidInput("PMID 형식이 올바르지 않습니다.");
  }
  if (input.sourceUrl && !isSafeHttpsUrl(input.sourceUrl)) {
    throw invalidInput("sourceUrl은 https URL이어야 합니다.");
  }
  if (input.doi && input.doi.trim().length < 5) {
    throw invalidInput("DOI 형식이 올바르지 않습니다.");
  }
}

export type CreateEvidenceInput = {
  ingredientId?: unknown;
  concernCode?: unknown;
  concernId?: unknown;
  evidenceType?: unknown;
  evidenceLevel?: unknown;
  outcomeSummary?: unknown;
  pmid?: unknown;
  doi?: unknown;
  sourceUrl?: unknown;
  journal?: unknown;
  publicationYear?: unknown;
  studyDesign?: unknown;
  population?: unknown;
  concentration?: unknown;
  formulation?: unknown;
  studyDuration?: unknown;
  conflictOfInterest?: unknown;
  approveNow?: unknown;
};

export async function createAdminEvidence(
  session: AdminSession,
  input: CreateEvidenceInput
): Promise<{ id: string; reviewStatus: string }> {
  if (!ADMIN_ROLE_CAPABILITIES[session.role].canWriteEvidence) {
    throw forbidden("근거 작성 권한이 없습니다.");
  }
  const client = getClient();

  const ingredientId = parsePositiveBigIntId(
    typeof input.ingredientId === "string" ||
      typeof input.ingredientId === "number"
      ? input.ingredientId
      : undefined
  );
  if (ingredientId == null) throw invalidInput("ingredientId가 필요합니다.");

  const evidenceType = normalizeText(String(input.evidenceType ?? ""));
  const evidenceLevel = normalizeText(String(input.evidenceLevel ?? ""));
  if (!EVIDENCE_TYPES.has(evidenceType)) {
    throw invalidInput("evidenceType이 올바르지 않습니다.");
  }
  if (!EVIDENCE_LEVELS.has(evidenceLevel)) {
    throw invalidInput("evidenceLevel이 올바르지 않습니다.");
  }
  if (evidenceLevel === "manufacturer_claim" || evidenceType === "claim") {
    throw invalidInput(
      "manufacturer_claim/claim은 추천 근거로 직접 등록할 수 없습니다."
    );
  }

  const pmid =
    typeof input.pmid === "string" && input.pmid.trim()
      ? input.pmid.trim()
      : null;
  const doi =
    typeof input.doi === "string" && input.doi.trim()
      ? input.doi.trim()
      : null;
  const sourceUrl =
    typeof input.sourceUrl === "string" && input.sourceUrl.trim()
      ? input.sourceUrl.trim()
      : null;
  validateCitation({ pmid, doi, sourceUrl });

  const outcomeSummary = normalizeText(String(input.outcomeSummary ?? ""));
  if (!outcomeSummary || outcomeSummary.length > 2000) {
    throw invalidInput("outcomeSummary가 필요합니다(최대 2000자).");
  }

  let concernId: string | null = parseUuid(
    typeof input.concernId === "string" ? input.concernId : ""
  );
  const concernCode = normalizeText(String(input.concernCode ?? ""));
  if (!concernId && concernCode) {
    const { data: concernRow, error } = await client
      .from("skin_concerns")
      .select("id")
      .eq("code", concernCode)
      .maybeSingle();
    if (error) throw internalWriteError();
    if (!concernRow?.id) throw invalidInput("존재하지 않는 concernCode입니다.");
    concernId = String(concernRow.id);
  }

  const { data: ingredient, error: ingErr } = await client
    .from("ingredients")
    .select("id")
    .eq("id", ingredientId)
    .maybeSingle();
  if (ingErr) throw internalWriteError();
  if (!ingredient) throw notFound("성분을 찾을 수 없습니다.");

  if (pmid) {
    const { data: dup } = await client
      .from("ingredient_evidence")
      .select("id")
      .eq("pmid", pmid)
      .maybeSingle();
    if (dup) throw conflict("DUPLICATE_PMID", "동일한 PMID가 이미 등록되어 있습니다.");
  }
  if (doi) {
    const { data: dup } = await client
      .from("ingredient_evidence")
      .select("id")
      .eq("doi", doi)
      .maybeSingle();
    if (dup) throw conflict("DUPLICATE_DOI", "동일한 DOI가 이미 등록되어 있습니다.");
  }

  const approveNow =
    input.approveNow === true &&
    ADMIN_ROLE_CAPABILITIES[session.role].canReview;
  const now = new Date().toISOString();

  const row = {
    ingredient_id: ingredientId,
    concern_id: concernId,
    evidence_type: evidenceType,
    evidence_level: evidenceLevel,
    outcome_summary: outcomeSummary,
    pmid,
    doi,
    source_url: sourceUrl,
    journal:
      typeof input.journal === "string" && input.journal.trim()
        ? input.journal.trim().slice(0, 300)
        : null,
    publication_year:
      typeof input.publicationYear === "number" &&
      Number.isFinite(input.publicationYear)
        ? Math.floor(input.publicationYear)
        : null,
    study_design:
      typeof input.studyDesign === "string"
        ? input.studyDesign.slice(0, 300)
        : null,
    population:
      typeof input.population === "string"
        ? input.population.slice(0, 300)
        : null,
    concentration:
      typeof input.concentration === "string"
        ? input.concentration.slice(0, 200)
        : null,
    formulation:
      typeof input.formulation === "string"
        ? input.formulation.slice(0, 200)
        : null,
    study_duration:
      typeof input.studyDuration === "string"
        ? input.studyDuration.slice(0, 200)
        : null,
    conflict_of_interest:
      typeof input.conflictOfInterest === "string" &&
      ["none", "disclosed", "unknown", "high"].includes(input.conflictOfInterest)
        ? input.conflictOfInterest
        : "unknown",
    review_status: approveNow ? "approved" : "pending",
    reviewed_at: approveNow ? now : null,
    reviewed_by: approveNow ? session.userId : null,
    updated_at: now,
  };

  const { data: inserted, error } = await client
    .from("ingredient_evidence")
    .insert(row)
    .select("id, review_status")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw conflict("DUPLICATE_CITATION", "중복된 citation입니다.");
    }
    throw internalWriteError();
  }

  await tryInsertWriteAudit(client, {
    action: "workflow_status_changed",
    actorRole: session.role,
    metadata: {
      evidenceId: String(inserted.id),
      reviewStatus: inserted.review_status,
      ingredientId,
      pmid,
      kind: "evidence.create",
    },
  });

  return {
    id: String(inserted.id),
    reviewStatus: String(inserted.review_status),
  };
}

export async function reviewAdminEvidence(
  session: AdminSession,
  evidenceIdRaw: string,
  actionRaw: unknown
): Promise<{ id: string; reviewStatus: string }> {
  if (!ADMIN_ROLE_CAPABILITIES[session.role].canReview) {
    throw forbidden("근거 승인 권한이 없습니다.");
  }
  const client = getClient();
  const evidenceId = parseUuid(evidenceIdRaw);
  if (!evidenceId) throw invalidInput("evidence id가 올바르지 않습니다.");

  const action = normalizeText(String(actionRaw ?? ""));
  if (action !== "approve" && action !== "reject" && action !== "needs_review") {
    throw invalidInput("action은 approve|reject|needs_review 만 허용합니다.");
  }

  const { data: existing, error: loadErr } = await client
    .from("ingredient_evidence")
    .select("id, review_status, pmid, doi, source_url")
    .eq("id", evidenceId)
    .maybeSingle();
  if (loadErr) throw internalWriteError();
  if (!existing) throw notFound("근거를 찾을 수 없습니다.");

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;

  if (action === "approve") {
    validateCitation({
      pmid: typeof existing.pmid === "string" ? existing.pmid : null,
      doi: typeof existing.doi === "string" ? existing.doi : null,
      sourceUrl:
        typeof existing.source_url === "string" ? existing.source_url : null,
    });
    patch = {
      review_status: "approved",
      reviewed_at: now,
      reviewed_by: session.userId,
      updated_at: now,
    };
  } else if (action === "reject") {
    patch = {
      review_status: "rejected",
      reviewed_at: now,
      reviewed_by: session.userId,
      updated_at: now,
    };
  } else {
    patch = {
      review_status: "needs_review",
      reviewed_at: null,
      updated_at: now,
    };
  }

  const { data: updated, error } = await client
    .from("ingredient_evidence")
    .update(patch)
    .eq("id", evidenceId)
    .select("id, review_status")
    .single();
  if (error) throw internalWriteError();

  await tryInsertWriteAudit(client, {
    action:
      action === "approve"
        ? "verification_approved"
        : action === "reject"
          ? "verification_rejected"
          : "verification_needs_review",
    actorRole: session.role,
    metadata: {
      evidenceId,
      reviewStatus: updated.review_status,
      kind: `evidence.${action}`,
    },
  });

  return {
    id: String(updated.id),
    reviewStatus: String(updated.review_status),
  };
}
