/**
 * In-memory persistence for affiliate links (no Production DB write).
 */

import {
  createAffiliateLinkDraft,
  validateAffiliateLink,
  type AffiliateLinkRecord,
} from "@/lib/commercial/affiliateLink";

const links = new Map<string, AffiliateLinkRecord>();

export function resetAffiliateLinkStore(): void {
  links.clear();
}

export function listAffiliateLinks(): AffiliateLinkRecord[] {
  return [...links.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAffiliateLink(id: string): AffiliateLinkRecord | null {
  return links.get(id) ?? null;
}

export function upsertAffiliateLink(
  input: Omit<AffiliateLinkRecord, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
  now = new Date(),
): { ok: true; link: AffiliateLinkRecord } | { ok: false; reasons: string[] } {
  const existing = links.get(input.id);
  const draft = createAffiliateLinkDraft(
    {
      ...input,
      reviewStatus: input.reviewStatus,
    },
    now,
  );
  const link: AffiliateLinkRecord = {
    ...draft,
    createdAt: existing?.createdAt ?? draft.createdAt,
    updatedAt: now.toISOString(),
  };

  if (link.reviewStatus === "publishable") {
    const validation = validateAffiliateLink(link);
    if (!validation.ok) {
      return { ok: false, reasons: validation.reasons };
    }
  }

  links.set(link.id, link);
  return { ok: true, link };
}

export function advanceAffiliateReview(
  id: string,
  action: "mark_reviewed" | "mark_publishable" | "block",
  now = new Date(),
): { ok: true; link: AffiliateLinkRecord } | { ok: false; reasons: string[] } {
  const current = links.get(id);
  if (!current) return { ok: false, reasons: ["link_not_found"] };

  if (action === "block") {
    const blocked = {
      ...current,
      reviewStatus: "blocked" as const,
      updatedAt: now.toISOString(),
    };
    links.set(id, blocked);
    return { ok: true, link: blocked };
  }

  if (action === "mark_reviewed") {
    const reviewed = {
      ...current,
      reviewStatus: "reviewed" as const,
      updatedAt: now.toISOString(),
    };
    links.set(id, reviewed);
    return { ok: true, link: reviewed };
  }

  const validation = validateAffiliateLink({
    ...current,
    reviewStatus: "publishable",
  });
  if (!validation.ok) {
    return { ok: false, reasons: validation.reasons };
  }
  const publishable = {
    ...current,
    reviewStatus: "publishable" as const,
    updatedAt: now.toISOString(),
  };
  links.set(id, publishable);
  return { ok: true, link: publishable };
}

export function buildAffiliateAdminSummary(): {
  total: number;
  draft: number;
  reviewed: number;
  publishable: number;
  blocked: number;
  affiliate: number;
  sponsored: number;
  databaseTouched: false;
  productionTouched: false;
} {
  const all = listAffiliateLinks();
  return {
    total: all.length,
    draft: all.filter((l) => l.reviewStatus === "draft").length,
    reviewed: all.filter((l) => l.reviewStatus === "reviewed").length,
    publishable: all.filter((l) => l.reviewStatus === "publishable").length,
    blocked: all.filter((l) => l.reviewStatus === "blocked").length,
    affiliate: all.filter((l) => l.isAffiliate).length,
    sponsored: all.filter((l) => l.isSponsored).length,
    databaseTouched: false,
    productionTouched: false,
  };
}
