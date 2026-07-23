/**
 * BeautyProfile durable journey self-test (T01).
 * Covers parse/fallback, merge priority, check-in observation, patch sanitize,
 * and DRAFT migration static review. No DB apply / Production touch.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  applyConfirmedProfilePatch,
  applyProfileObservation,
  createEmptyBeautyProfile,
  mergeBeautyProfiles,
  observationFromCheckIn,
  parseBeautyProfile,
  sanitizeConfirmedProfilePatch,
} from "../src/lib/profile/beautyProfile";

const t0 = "2026-07-20T00:00:00.000Z";
const t1 = "2026-07-23T00:00:00.000Z";

// Safe fallback
assert.equal(parseBeautyProfile(null).version, 1);
assert.equal(parseBeautyProfile("bad").skin.concerns.value.length, 0);
assert.equal(parseBeautyProfile({ version: 9, skin: { concerns: "x" } }).version, 1);

const partial = parseBeautyProfile({
  updatedAt: t0,
  skin: {
    type: { value: "dry", source: "user_confirmed", updatedAt: t0 },
    concerns: { value: ["dryness", ""], source: "inferred", updatedAt: t0 },
  },
});
assert.equal(partial.skin.type?.value, "dry");
assert.deepEqual(partial.skin.concerns.value, ["dryness"]);

// Confirmed wins over inferred in merge
let a = applyProfileObservation(createEmptyBeautyProfile(t0), {
  source: "user_confirmed",
  recordedAt: t0,
  skinType: "dry",
  concerns: ["dryness"],
});
const b = applyProfileObservation(createEmptyBeautyProfile(t1), {
  source: "inferred",
  recordedAt: t1,
  skinType: "oily",
  concerns: ["redness"],
});
const merged = mergeBeautyProfiles(a, b);
assert.equal(merged.skin.type?.value, "dry");
assert.equal(merged.skin.type?.source, "user_confirmed");
assert.ok(merged.skin.concerns.value.includes("dryness"));
assert.ok(merged.skin.concerns.value.includes("redness"));

// Patch sanitize
const bad = sanitizeConfirmedProfilePatch({
  skinType: 1 as unknown as string,
});
assert.equal(bad.ok, false);
const good = sanitizeConfirmedProfilePatch({
  skinType: " combination ",
  concerns: ["acne", "", "acne"],
});
assert.equal(good.ok, true);
if (good.ok) {
  assert.equal(good.patch.skinType, "combination");
  assert.deepEqual(good.patch.concerns, ["acne"]);
}

const patched = applyConfirmedProfilePatch(merged, good.ok ? good.patch : {});
assert.equal(patched.skin.type?.value, "combination");
assert.equal(patched.skin.type?.source, "user_confirmed");

// Check-in → profile observation
const obs = observationFromCheckIn({
  recordedAt: t1,
  answers: {
    sting: 4,
    itch: 2,
    redness: 3,
    dryness: 1,
    overallResponse: "worsened",
    stoppedReason: "irritation",
    stillUsing: false,
    acuteSignals: { pain: true, bleeding: false },
  },
});
assert.equal(obs.source, "inferred");
assert.ok(obs.triggers?.includes("sting_on_use"));
assert.ok(obs.triggers?.includes("irritation"));
assert.ok(obs.redFlags?.includes("irritation_reported"));
assert.ok(obs.redFlags?.includes("acute_pain"));
assert.ok(!obs.redFlags?.includes("acute_bleeding"));
assert.equal(obs.sensitivity, "elevated_reported");

a = applyProfileObservation(a, obs);
assert.ok(a.skin.redFlags.value.includes("irritation_reported"));
assert.ok(a.skin.triggers.value.includes("routine_worsening"));
assert.equal(a.skin.sensitivity?.value, "elevated_reported");
assert.equal(a.skin.sensitivity?.source, "inferred");
// Confirmed type must survive inferred check-in sensitivity merge for type
assert.equal(a.skin.type?.value, "dry");

// DRAFT migration static review
const draftPath = "supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql";
assert.ok(existsSync(draftPath), "draft migration exists");
const sql = readFileSync(draftPath, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();
assert.match(sql, /DRAFT ONLY|DO NOT APPLY/i);
assert.match(upper, /CREATE TABLE IF NOT EXISTS PUBLIC\.BEAUTY_PROFILES/);
assert.match(upper, /ENABLE ROW LEVEL SECURITY/);
assert.match(upper, /REVOKE ALL ON TABLE PUBLIC\.BEAUTY_PROFILES FROM ANON/);
assert.match(upper, /GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.BEAUTY_PROFILES TO AUTHENTICATED/);
assert.match(upper, /GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.BEAUTY_PROFILES TO SERVICE_ROLE/);
assert.ok(!/GRANT\s+[^;]*\bDELETE\b/.test(upper), "no DELETE grant");
assert.ok(!/\bTRUNCATE\b/.test(upper), "no TRUNCATE");
assert.ok(!/\bDROP\b/.test(upper), "no DROP");
assert.ok(!/\bDELETE FROM\b/.test(upper), "no DELETE FROM");
assert.match(upper, /AUTH\.UID\(\)/);
assert.match(upper, /BEAUTY_PROFILES_NO_PII_KEYS_CHK/);

// Route + server module presence
assert.ok(existsSync("src/app/api/care/beauty-profile/route.ts"));
assert.ok(existsSync("src/lib/profile/beautyProfileServer.ts"));
assert.ok(existsSync("src/app/my/profile/page.tsx"));

const route = readFileSync("src/app/api/care/beauty-profile/route.ts", "utf8");
assert.ok(route.includes("migrationPending"));
assert.ok(route.includes("UNAUTHORIZED"));
assert.ok(route.includes("sanitizeConfirmedProfilePatch"));

const localStore = readFileSync("src/lib/care/local-store.ts", "utf8");
assert.ok(localStore.includes("observationFromCheckIn"));
assert.ok(localStore.includes("parseBeautyProfile"));

console.log(
  JSON.stringify({
    ok: true,
    checks: [
      "parse_fallback",
      "merge_confirmed_wins",
      "sanitize_patch",
      "checkin_observation",
      "draft_migration",
      "api_route",
    ],
  })
);
