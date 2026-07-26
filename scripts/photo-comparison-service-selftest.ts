import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import {
  defaultPhotoConsentChoices,
  shouldAutoPurgeAfterAnalysis,
  validatePhotoConsentChoices,
} from "../src/lib/care/photoComparisonPolicy";
import {
  FakePhotoComparisonStore,
  createSyntheticPhotoAsset,
  listAssetsForUser,
  registerConsent,
  requestDeleteAll,
  requestDeleteAsset,
  requestPersist,
  scheduleEphemeralPurge,
} from "../src/lib/care/photoComparisonService";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const userId = randomUUID();
const otherUser = randomUUID();
const store = new FakePhotoComparisonStore();

const choices = {
  ...defaultPhotoConsentChoices(),
  analysisConsent: true,
  saveForComparison: true,
  retentionAcknowledged: true,
};
const consent = registerConsent(store, { userId, choices });
ok(consent.state === "save_for_comparison", "consent registered");

const asset = createSyntheticPhotoAsset(store, { userId });
ok(asset.storageStatus === "ephemeral", "synthetic ephemeral");

const blocked = requestPersist(store, {
  assetId: asset.id,
  userId,
  choices: defaultPhotoConsentChoices(),
});
ok(!blocked.ok && blocked.code === "save_consent_required", "persist blocked");

const persisted = requestPersist(store, {
  assetId: asset.id,
  userId,
  choices,
  consentId: consent.id,
});
ok(persisted.ok, "persist ok");
if (persisted.ok) {
  ok(persisted.asset.storageStatus === "stored", "stored status");
}

const analysisOnly = validatePhotoConsentChoices({
  analysisConsent: true,
});
ok(shouldAutoPurgeAfterAnalysis(analysisOnly.effectiveMode), "analysis only purge");
const purged = scheduleEphemeralPurge(store, {
  assetId: createSyntheticPhotoAsset(store, { userId }).id,
  userId,
});
ok(purged?.storageStatus === "deleted", "ephemeral purged");

const del1 = requestDeleteAsset(store, { assetId: asset.id, userId });
ok(del1.ok, "delete ok");
const del2 = requestDeleteAsset(store, { assetId: asset.id, userId });
ok(del2.ok && del2.idempotent, "delete idempotent");

const forbidden = requestDeleteAsset(store, {
  assetId: createSyntheticPhotoAsset(store, { userId: otherUser }).id,
  userId,
});
ok(!forbidden.ok && forbidden.code === "forbidden", "forbidden delete");

createSyntheticPhotoAsset(store, { userId });
createSyntheticPhotoAsset(store, { userId });
const before = listAssetsForUser(store, userId).length;
const all = requestDeleteAll(store, userId);
ok(all.deletedCount >= 1, "delete all");
ok(listAssetsForUser(store, userId).length <= before, "list shrinks");

console.log("[photo-comparison-service] fake store flows passed");
