/**
 * Stale detection for product + clinic refresh entities (P3-T03).
 */

import {
  CLINIC_HARD_STALE_DAYS,
  CLINIC_STALE_DAYS,
  PRODUCT_HARD_STALE_DAYS,
  PRODUCT_STALE_DAYS,
} from "./constants";
import type {
  RefreshEntityKind,
  RefreshEntityRecord,
  RefreshStatus,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageDays(
  iso: string | null | undefined,
  now: Date,
): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

export function staleThresholds(kind: RefreshEntityKind): {
  soft: number;
  hard: number;
} {
  return kind === "product"
    ? { soft: PRODUCT_STALE_DAYS, hard: PRODUCT_HARD_STALE_DAYS }
    : { soft: CLINIC_STALE_DAYS, hard: CLINIC_HARD_STALE_DAYS };
}

export type StaleDetectionResult = {
  entityId: string;
  isStale: boolean;
  isHardStale: boolean;
  ageDays: number | null;
  softDays: number;
  hardDays: number;
  suggestedStatus: RefreshStatus;
  reasons: string[];
};

/**
 * Derive stale flags from verifiedAt / collectedAt without mutating storage.
 */
export function detectStale(
  entity: RefreshEntityRecord,
  now: Date = new Date(),
): StaleDetectionResult {
  const { soft, hard } = staleThresholds(entity.entityKind);
  const verifiedAge = ageDays(entity.verifiedAt, now);
  const collectedAge = ageDays(entity.collectedAt, now);
  const age = verifiedAge ?? collectedAge;
  const reasons: string[] = [];

  if (entity.discontinued) {
    return {
      entityId: entity.entityId,
      isStale: false,
      isHardStale: false,
      ageDays: age,
      softDays: soft,
      hardDays: hard,
      suggestedStatus: "discontinued",
      reasons: ["discontinued"],
    };
  }

  if (entity.refreshStatus === "blocked") {
    return {
      entityId: entity.entityId,
      isStale: false,
      isHardStale: false,
      ageDays: age,
      softDays: soft,
      hardDays: hard,
      suggestedStatus: "blocked",
      reasons: ["blocked"],
    };
  }

  if (age == null) {
    reasons.push("verification_timestamp_missing");
    return {
      entityId: entity.entityId,
      isStale: true,
      isHardStale: true,
      ageDays: null,
      softDays: soft,
      hardDays: hard,
      suggestedStatus: "verification_required",
      reasons,
    };
  }

  if (age >= hard) {
    reasons.push("hard_stale");
    return {
      entityId: entity.entityId,
      isStale: true,
      isHardStale: true,
      ageDays: age,
      softDays: soft,
      hardDays: hard,
      suggestedStatus: "verification_required",
      reasons,
    };
  }

  if (age >= soft) {
    reasons.push("soft_stale");
    return {
      entityId: entity.entityId,
      isStale: true,
      isHardStale: false,
      ageDays: age,
      softDays: soft,
      hardDays: hard,
      suggestedStatus: "stale_but_usable",
      reasons,
    };
  }

  return {
    entityId: entity.entityId,
    isStale: false,
    isHardStale: false,
    ageDays: age,
    softDays: soft,
    hardDays: hard,
    suggestedStatus: "current",
    reasons: [],
  };
}

/** Apply suggested stale status onto a copy (never mutates input). */
export function applyStaleStatus(
  entity: RefreshEntityRecord,
  now: Date = new Date(),
): RefreshEntityRecord {
  if (
    entity.refreshStatus === "refresh_failed" ||
    entity.refreshStatus === "source_unavailable" ||
    entity.refreshStatus === "refreshing" ||
    entity.refreshStatus === "blocked" ||
    entity.refreshStatus === "discontinued"
  ) {
    return { ...entity };
  }

  const stale = detectStale(entity, now);
  const duePassed =
    entity.refreshDueAt != null &&
    Number.isFinite(Date.parse(entity.refreshDueAt)) &&
    Date.parse(entity.refreshDueAt) <= now.getTime();

  let refreshStatus = stale.suggestedStatus;
  if (duePassed && refreshStatus === "current") {
    refreshStatus = "refresh_due";
  } else if (duePassed && refreshStatus === "stale_but_usable") {
    refreshStatus = "refresh_due";
  }

  return {
    ...entity,
    refreshStatus,
    manualReviewRequired:
      entity.manualReviewRequired ||
      stale.isHardStale ||
      entity.sourceChanged,
  };
}
