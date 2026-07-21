import assert from "node:assert/strict";
import {
  DEFAULT_RETENTION_DAYS,
  PHOTO_CONSENT_VERSION,
  SIGNED_URL_TTL_SEC,
  CARE_PHOTO_BUCKET,
  applyIdempotentDeleteStatus,
  assertSafePhotoFilename,
  buildCarePhotoObjectPath,
  canPersistPhoto,
  canUseForLearning,
  defaultPhotoConsentChoices,
  evaluatePhotoDeleteAccess,
  isRetentionExpired,
  listDeletionTargets,
  medicalDisclaimerKo,
  planDeleteSequence,
  retentionNoticeKo,
  revokePhotoConsent,
  shouldAutoPurgeAfterAnalysis,
  validatePhotoConsentChoices,
} from "../src/lib/care/photoComparisonPolicy";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const defaults = defaultPhotoConsentChoices();
ok(!defaults.saveForComparison, "defaults save false");
ok(!defaults.analysisConsent, "defaults analysis false");

ok(PHOTO_CONSENT_VERSION === "v1", "version v1");
ok(DEFAULT_RETENTION_DAYS === 90, "retention 90");
ok(SIGNED_URL_TTL_SEC === 300, "signed url ttl");
ok(CARE_PHOTO_BUCKET === "care-photos", "bucket name only");

const invalid = validatePhotoConsentChoices({ analysisConsent: false });
ok(!invalid.ok, "analysis required");
ok(invalid.effectiveMode === "analysis_only", "invalid -> analysis_only");

const learningOnly = validatePhotoConsentChoices({
  analysisConsent: true,
  learningOptIn: true,
});
ok(!learningOnly.ok, "learning without save invalid");

const saveMissingAck = validatePhotoConsentChoices({
  analysisConsent: true,
  saveForComparison: true,
  retentionAcknowledged: false,
});
ok(!saveMissingAck.ok, "save needs retention ack");

const saveOk = validatePhotoConsentChoices({
  analysisConsent: true,
  saveForComparison: true,
  retentionAcknowledged: true,
});
ok(saveOk.ok, "save valid");
ok(saveOk.effectiveMode === "save_for_comparison", "save mode");

ok(
  !canPersistPhoto({ ...defaults, analysisConsent: true, saveForComparison: true }),
  "persist needs retention ack"
);
ok(
  canPersistPhoto({
    analysisConsent: true,
    saveForComparison: true,
    retentionAcknowledged: true,
    learningOptIn: false,
  }),
  "can persist"
);
ok(
  !canUseForLearning({
    analysisConsent: true,
    saveForComparison: true,
    retentionAcknowledged: true,
    learningOptIn: false,
  }),
  "learning needs opt in"
);
ok(
  canUseForLearning({
    analysisConsent: true,
    saveForComparison: true,
    retentionAcknowledged: true,
    learningOptIn: true,
  }),
  "can learning"
);

const revoked = revokePhotoConsent(
  {
    id: "c1",
    userId: "u1",
    consentVersion: "v1",
    state: "save_for_comparison",
    saveForComparison: true,
    learningOptIn: false,
    retentionDays: 90,
    grantedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    analysisSessionId: null,
  },
  "2026-07-22T00:00:00.000Z"
);
ok(revoked.state === "revoked", "revoked state");
ok(revoked.revokedAt !== null, "revoked at set");

ok(
  isRetentionExpired(
    { expiresAt: "2026-01-01T00:00:00.000Z", storageStatus: "stored" },
    "2026-07-22T00:00:00.000Z"
  ),
  "expired"
);
ok(
  !isRetentionExpired(
    { expiresAt: "2027-01-01T00:00:00.000Z", storageStatus: "stored" },
    "2026-07-22T00:00:00.000Z"
  ),
  "not expired"
);

const path = buildCarePhotoObjectPath({
  userId: "11111111-1111-4111-8111-111111111111",
  assetId: "22222222-2222-4222-8222-222222222222",
  derivative: "thumb",
});
ok(!path.includes("@"), "path no email");
ok(path.endsWith("/thumb"), "path derivative");

const targets = listDeletionTargets({
  objectPathOriginal: "a/o",
  objectPathThumb: "a/t",
  objectPathPreview: "a/p",
});
ok(targets.length === 3, "three deletion targets");

ok(
  evaluatePhotoDeleteAccess({
    assetUserId: "u1",
    requesterUserId: "u1",
  }) === "allow",
  "owner allow"
);
ok(
  evaluatePhotoDeleteAccess({
    assetUserId: "u1",
    requesterUserId: "u2",
  }) === "deny",
  "other deny"
);

const idem = applyIdempotentDeleteStatus("deleted");
ok(idem.idempotent && idem.success, "idempotent delete");

ok(planDeleteSequence().length === 4, "delete sequence");
ok(planDeleteSequence()[0] === "mark_pending_delete", "first step");

ok(!assertSafePhotoFilename("user@mail.com").ok, "reject email filename");
ok(assertSafePhotoFilename("photo-001.jpg").ok, "safe filename");

ok(shouldAutoPurgeAfterAnalysis("analysis_only"), "purge analysis only");
ok(!shouldAutoPurgeAfterAnalysis("save_for_comparison"), "no purge save");

ok(medicalDisclaimerKo.includes("의료"), "disclaimer ko");
ok(retentionNoticeKo.includes("90"), "retention ko");

console.log("[photo-comparison-policy] all cases passed");
