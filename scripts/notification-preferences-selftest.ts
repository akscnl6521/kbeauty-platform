import assert from "node:assert/strict";
import {
  parseCareNotificationPrefsFromMetadata,
  toCareNotificationPrefsPayload,
  mergeCareNotificationPrefsMetadata,
  CARE_NOTIFICATION_PREFS_META_KEY,
} from "../src/lib/care/notificationPreferences";

let checks = 0;
function check(cond: boolean, msg: string) {
  assert.ok(cond, msg);
  checks += 1;
}

const empty = parseCareNotificationPrefsFromMetadata({});
check(empty.careEmailChannelConsent === false, "default care email off");
check(empty.notificationsEnabled === true, "default in-app on");
check(empty.emailOptIn === false, "default marketing off");

const merged = mergeCareNotificationPrefsMetadata(
  { foo: 1 },
  {
    ...empty,
    careEmailChannelConsent: true,
    locale: "en",
    timezone: "America/New_York",
  }
);
check(merged.foo === 1, "preserves other metadata");
check(
  (merged[CARE_NOTIFICATION_PREFS_META_KEY] as { careEmailChannelConsent: boolean })
    .careEmailChannelConsent === true,
  "stores care consent"
);

const round = parseCareNotificationPrefsFromMetadata(merged);
check(round.locale === "en", "locale roundtrip");
check(toCareNotificationPrefsPayload(round).timezone === "America/New_York", "tz");

console.log("[notification-preferences] " + checks + " checks passed");
