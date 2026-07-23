export type PhotoConsentMode = "analysis_only" | "save_for_comparison";

export type PhotoConsentState =
  | "analysis_only"
  | "save_for_comparison"
  | "learning_opt_in"
  | "revoked";

export type PhotoStorageStatus =
  | "ephemeral"
  | "stored"
  | "pending_delete"
  | "deleted"
  | "delete_failed";

export type PhotoConsentChoices = {
  saveForComparison: boolean;
  learningOptIn: boolean;
  retentionAcknowledged: boolean;
  analysisConsent: boolean;
};

export type PhotoConsentRecord = {
  id: string;
  userId: string;
  consentVersion: string;
  state: PhotoConsentState;
  saveForComparison: boolean;
  learningOptIn: boolean;
  retentionDays: number;
  grantedAt: string;
  revokedAt: string | null;
  analysisSessionId: string | null;
};

export type PhotoAssetRecord = {
  id: string;
  userId: string;
  analysisSessionId: string | null;
  storageStatus: PhotoStorageStatus;
  objectPathOriginal: string;
  objectPathThumb: string;
  objectPathPreview: string;
  retentionDays: number;
  expiresAt: string | null;
  consentId: string | null;
  learningOptIn: boolean;
  contentType: string;
  byteSize: number;
  createdAt: string;
  deletedAt: string | null;
};

export type PhotoDeletionRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type PhotoDeletionRequest = {
  id: string;
  userId: string;
  assetId: string;
  status: PhotoDeletionRequestStatus;
  idempotencyKey: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type PhotoAuditEvent = {
  id: string;
  userId: string;
  assetId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const PHOTO_CONSENT_VERSION = "v1";
export const DEFAULT_RETENTION_DAYS = 90;
export const SIGNED_URL_TTL_SEC = 300;
export const CARE_PHOTO_BUCKET = "care-photos";

export function defaultPhotoConsentChoices(): PhotoConsentChoices {
  return {
    saveForComparison: false,
    learningOptIn: false,
    retentionAcknowledged: false,
    analysisConsent: false,
  };
}

export function validatePhotoConsentChoices(input: Partial<PhotoConsentChoices>): {
  ok: boolean;
  errors: string[];
  effectiveMode: PhotoConsentMode;
} {
  const choices: PhotoConsentChoices = {
    ...defaultPhotoConsentChoices(),
    ...input,
  };
  const errors: string[] = [];

  if (!choices.analysisConsent) {
    errors.push("analysis_consent_required");
  }
  if (choices.learningOptIn && !choices.saveForComparison) {
    errors.push("learning_requires_save");
  }
  if (choices.saveForComparison && !choices.retentionAcknowledged) {
    errors.push("retention_ack_required_for_save");
  }

  const effectiveMode: PhotoConsentMode =
    choices.analysisConsent &&
    choices.saveForComparison &&
    choices.retentionAcknowledged
      ? "save_for_comparison"
      : "analysis_only";

  return { ok: errors.length === 0, errors, effectiveMode };
}

export function canPersistPhoto(choices: PhotoConsentChoices): boolean {
  return (
    choices.analysisConsent &&
    choices.saveForComparison &&
    choices.retentionAcknowledged
  );
}

export function canUseForLearning(choices: PhotoConsentChoices): boolean {
  return canPersistPhoto(choices) && choices.learningOptIn;
}

export function resolveConsentState(choices: PhotoConsentChoices): PhotoConsentState {
  if (canUseForLearning(choices)) return "learning_opt_in";
  if (canPersistPhoto(choices)) return "save_for_comparison";
  return "analysis_only";
}

export function revokePhotoConsent(
  record: PhotoConsentRecord,
  now: Date | string
): PhotoConsentRecord {
  const revokedAt = typeof now === "string" ? now : now.toISOString();
  return {
    ...record,
    state: "revoked",
    saveForComparison: false,
    learningOptIn: false,
    revokedAt,
  };
}

export function isRetentionExpired(
  asset: Pick<PhotoAssetRecord, "expiresAt" | "storageStatus">,
  now: Date | string
): boolean {
  if (asset.storageStatus === "deleted" || asset.storageStatus === "ephemeral") {
    return false;
  }
  if (!asset.expiresAt) return false;
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  return Date.parse(asset.expiresAt) <= nowMs;
}

export function buildCarePhotoObjectPath(args: {
  userId: string;
  assetId: string;
  derivative?: "original" | "thumb" | "preview";
}): string {
  const derivative = args.derivative ?? "original";
  return `${args.userId}/${args.assetId}/${derivative}`;
}

export function listDeletionTargets(
  asset: Pick<
    PhotoAssetRecord,
    "objectPathOriginal" | "objectPathThumb" | "objectPathPreview"
  >
): string[] {
  return [
    asset.objectPathOriginal,
    asset.objectPathThumb,
    asset.objectPathPreview,
  ].filter(Boolean);
}

export function evaluatePhotoDeleteAccess(args: {
  assetUserId: string;
  requesterUserId: string;
}): "allow" | "deny" {
  return args.assetUserId === args.requesterUserId ? "allow" : "deny";
}

export function applyIdempotentDeleteStatus(current: PhotoStorageStatus): {
  status: PhotoStorageStatus;
  success: boolean;
  idempotent: boolean;
} {
  if (current === "deleted") {
    return { status: "deleted", success: true, idempotent: true };
  }
  return { status: current, success: false, idempotent: false };
}

export function planDeleteSequence(): readonly [
  "mark_pending_delete",
  "delete_storage_objects",
  "mark_deleted",
  "write_audit",
] {
  return [
    "mark_pending_delete",
    "delete_storage_objects",
    "mark_deleted",
    "write_audit",
  ] as const;
}

const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function assertSafePhotoFilename(name: string): { ok: boolean; reason?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "empty_filename" };
  if (trimmed.includes("@")) return { ok: false, reason: "contains_at" };
  if (EMAIL_LIKE.test(trimmed)) return { ok: false, reason: "looks_like_email" };
  return { ok: true };
}

export function shouldAutoPurgeAfterAnalysis(mode: PhotoConsentMode): boolean {
  return mode === "analysis_only";
}

export const medicalDisclaimerKo =
  "AI 피부 가이드는 참고용 정보이며 의료 진단이 아닙니다. 통증·진물·급격한 악화가 있으면 전문의 상담을 우선하세요.";

export const medicalDisclaimerEn =
  "AI skin guidance is informational only and not a medical diagnosis. Seek professional care for pain, discharge, or rapid worsening.";

export const retentionNoticeKo =
  "비교용 저장을 선택하면 최대 90일간 보관되며, 설정에서 언제든 삭제할 수 있습니다. 분석만 선택하면 안내 후 이 기기의 임시 사진은 삭제됩니다. 현재 단계에서 사진 픽셀은 외부 AI로 보내지 않습니다.";

export const retentionNoticeEn =
  "If you choose to save for comparison, photos are kept up to 90 days and can be deleted anytime in settings. Analysis-only temporary photos are cleared after guidance. At this stage photo pixels are not sent to external AI.";
