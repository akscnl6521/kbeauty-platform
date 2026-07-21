import { randomUUID } from "crypto";
import {
  DEFAULT_RETENTION_DAYS,
  PHOTO_CONSENT_VERSION,
  applyIdempotentDeleteStatus,
  buildCarePhotoObjectPath,
  canPersistPhoto,
  evaluatePhotoDeleteAccess,
  listDeletionTargets,
  planDeleteSequence,
  resolveConsentState,
  revokePhotoConsent,
  shouldAutoPurgeAfterAnalysis,
  type PhotoAssetRecord,
  type PhotoAuditEvent,
  type PhotoConsentChoices,
  type PhotoConsentRecord,
  type PhotoDeletionRequest,
  type PhotoStorageStatus,
} from "@/lib/care/photoComparisonPolicy";

export type SyntheticPhotoInput = {
  userId: string;
  contentType?: string;
  byteSize?: number;
  analysisSessionId?: string | null;
  consentId?: string | null;
  learningOptIn?: boolean;
};

export class FakePhotoComparisonStore {
  consents = new Map<string, PhotoConsentRecord>();
  assets = new Map<string, PhotoAssetRecord>();
  deletionRequests = new Map<string, PhotoDeletionRequest>();
  auditEvents: PhotoAuditEvent[] = [];
}

export function createAuditEvent(args: {
  userId: string;
  assetId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  now?: string;
}): PhotoAuditEvent {
  return {
    id: randomUUID(),
    userId: args.userId,
    assetId: args.assetId ?? null,
    eventType: args.eventType,
    metadata: args.metadata ?? {},
    createdAt: args.now ?? new Date().toISOString(),
  };
}

export function registerConsent(
  store: FakePhotoComparisonStore,
  args: {
    userId: string;
    choices: PhotoConsentChoices;
    retentionDays?: number;
    analysisSessionId?: string | null;
    now?: string;
  }
): PhotoConsentRecord {
  const now = args.now ?? new Date().toISOString();
  const record: PhotoConsentRecord = {
    id: randomUUID(),
    userId: args.userId,
    consentVersion: PHOTO_CONSENT_VERSION,
    state: resolveConsentState(args.choices),
    saveForComparison: args.choices.saveForComparison,
    learningOptIn: args.choices.learningOptIn,
    retentionDays: args.retentionDays ?? DEFAULT_RETENTION_DAYS,
    grantedAt: now,
    revokedAt: null,
    analysisSessionId: args.analysisSessionId ?? null,
  };
  store.consents.set(record.id, record);
  store.auditEvents.push(
    createAuditEvent({
      userId: args.userId,
      eventType: "consent_registered",
      metadata: { state: record.state, version: PHOTO_CONSENT_VERSION },
      now,
    })
  );
  return record;
}

export function createSyntheticPhotoAsset(
  store: FakePhotoComparisonStore,
  input: SyntheticPhotoInput
): PhotoAssetRecord {
  const assetId = randomUUID();
  const now = new Date().toISOString();
  const asset: PhotoAssetRecord = {
    id: assetId,
    userId: input.userId,
    analysisSessionId: input.analysisSessionId ?? null,
    storageStatus: "ephemeral",
    objectPathOriginal: buildCarePhotoObjectPath({
      userId: input.userId,
      assetId,
      derivative: "original",
    }),
    objectPathThumb: buildCarePhotoObjectPath({
      userId: input.userId,
      assetId,
      derivative: "thumb",
    }),
    objectPathPreview: buildCarePhotoObjectPath({
      userId: input.userId,
      assetId,
      derivative: "preview",
    }),
    retentionDays: DEFAULT_RETENTION_DAYS,
    expiresAt: null,
    consentId: input.consentId ?? null,
    learningOptIn: input.learningOptIn ?? false,
    contentType: input.contentType ?? "image/jpeg",
    byteSize: input.byteSize ?? 1024,
    createdAt: now,
    deletedAt: null,
  };
  store.assets.set(asset.id, asset);
  return asset;
}

export function requestPersist(
  store: FakePhotoComparisonStore,
  args: {
    assetId: string;
    userId: string;
    choices: PhotoConsentChoices;
    consentId?: string;
    now?: string;
  }
): { ok: true; asset: PhotoAssetRecord } | { ok: false; code: string } {
  if (!canPersistPhoto(args.choices)) {
    return { ok: false, code: "save_consent_required" };
  }
  const asset = store.assets.get(args.assetId);
  if (!asset || asset.userId !== args.userId) {
    return { ok: false, code: "not_found" };
  }
  const now = args.now ?? new Date().toISOString();
  const expiresAt = new Date(
    Date.parse(now) + DEFAULT_RETENTION_DAYS * 86_400_000
  ).toISOString();
  const updated: PhotoAssetRecord = {
    ...asset,
    storageStatus: "stored",
    consentId: args.consentId ?? asset.consentId,
    learningOptIn: args.choices.learningOptIn,
    expiresAt,
  };
  store.assets.set(updated.id, updated);
  store.auditEvents.push(
    createAuditEvent({
      userId: args.userId,
      assetId: updated.id,
      eventType: "asset_persisted",
      now,
    })
  );
  return { ok: true, asset: updated };
}

export function scheduleEphemeralPurge(
  store: FakePhotoComparisonStore,
  args: { assetId: string; userId: string; now?: string }
): PhotoAssetRecord | null {
  const asset = store.assets.get(args.assetId);
  if (!asset || asset.userId !== args.userId) return null;
  const now = args.now ?? new Date().toISOString();
  const updated: PhotoAssetRecord = {
    ...asset,
    storageStatus: "deleted",
    deletedAt: now,
  };
  store.assets.set(updated.id, updated);
  store.auditEvents.push(
    createAuditEvent({
      userId: args.userId,
      assetId: updated.id,
      eventType: "ephemeral_purged",
      now,
    })
  );
  return updated;
}

export function requestDeleteAsset(
  store: FakePhotoComparisonStore,
  args: { assetId: string; userId: string; now?: string }
): {
  ok: boolean;
  code?: string;
  asset?: PhotoAssetRecord;
  deletionRequest?: PhotoDeletionRequest;
  idempotent?: boolean;
} {
  const asset = store.assets.get(args.assetId);
  if (!asset) return { ok: false, code: "not_found" };
  if (
    evaluatePhotoDeleteAccess({
      assetUserId: asset.userId,
      requesterUserId: args.userId,
    }) === "deny"
  ) {
    return { ok: false, code: "forbidden" };
  }

  const idempotent = applyIdempotentDeleteStatus(asset.storageStatus);
  if (idempotent.idempotent) {
    return { ok: true, asset, idempotent: true };
  }

  const now = args.now ?? new Date().toISOString();
  const sequence = planDeleteSequence();
  let status: PhotoStorageStatus = asset.storageStatus;
  for (const step of sequence) {
    if (step === "mark_pending_delete") status = "pending_delete";
    if (step === "mark_deleted") status = "deleted";
  }

  const updated: PhotoAssetRecord = {
    ...asset,
    storageStatus: status,
    deletedAt: now,
  };
  store.assets.set(updated.id, updated);

  const deletionRequest: PhotoDeletionRequest = {
    id: randomUUID(),
    userId: args.userId,
    assetId: asset.id,
    status: "completed",
    idempotencyKey: `photo-delete:${args.userId}:${asset.id}`,
    retryCount: 0,
    lastError: null,
    createdAt: now,
    completedAt: now,
  };
  store.deletionRequests.set(deletionRequest.id, deletionRequest);
  store.auditEvents.push(
    createAuditEvent({
      userId: args.userId,
      assetId: asset.id,
      eventType: "asset_deleted",
      metadata: { paths: listDeletionTargets(asset) },
      now,
    })
  );

  return { ok: true, asset: updated, deletionRequest, idempotent: false };
}

export function requestDeleteAll(
  store: FakePhotoComparisonStore,
  userId: string,
  now?: string
): { deletedCount: number; assets: PhotoAssetRecord[] } {
  const owned = listAssetsForUser(store, userId);
  const deleted: PhotoAssetRecord[] = [];
  for (const asset of owned) {
    if (asset.storageStatus === "deleted") continue;
    const result = requestDeleteAsset(store, { assetId: asset.id, userId, now });
    if (result.ok && result.asset) deleted.push(result.asset);
  }
  return { deletedCount: deleted.length, assets: deleted };
}

export function listAssetsForUser(
  store: FakePhotoComparisonStore,
  userId: string
): PhotoAssetRecord[] {
  return [...store.assets.values()]
    .filter((a) => a.userId === userId && a.storageStatus !== "deleted")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function revokeUserConsent(
  store: FakePhotoComparisonStore,
  consentId: string,
  now?: string
): PhotoConsentRecord | null {
  const record = store.consents.get(consentId);
  if (!record) return null;
  const revoked = revokePhotoConsent(record, now ?? new Date());
  store.consents.set(consentId, revoked);
  store.auditEvents.push(
    createAuditEvent({
      userId: revoked.userId,
      eventType: "consent_revoked",
      now: revoked.revokedAt ?? undefined,
    })
  );
  return revoked;
}

export { shouldAutoPurgeAfterAnalysis };
