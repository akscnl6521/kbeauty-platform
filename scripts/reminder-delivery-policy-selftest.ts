import assert from "node:assert/strict";
import { decideReminderDelivery } from "../src/lib/care/reminderDeliveryPolicy";
import type { CareUserSettings } from "../src/lib/care/types";

const settings: CareUserSettings = {
  notificationsEnabled: true,
  emailOptIn: false,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  timezone: "Asia/Seoul",
};

const baseCheckIn = {
  id: "check-1",
  day: 3 as const,
  status: "due" as const,
  dueAt: "2026-07-19T00:00:00.000Z",
  referralLevel: "none" as const,
};

const due = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings,
  channel: "in_app",
  existingNotifications: [],
  now: new Date("2026-07-19T12:00:00.000Z"),
});
assert.equal(due.deliver, true);
assert.equal(due.reason, "due");

const emailOff = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings,
  channel: "email",
  existingNotifications: [],
  now: new Date("2026-07-19T12:00:00.000Z"),
});
assert.equal(emailOff.deliver, false);
assert.equal(emailOff.reason, "email_opt_out");

// Force local 23:00 so quiet-hours is timezone-stable
const quietNow = new Date("2026-07-19T12:00:00.000Z");
quietNow.setHours(23, 0, 0, 0);
const quiet = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings,
  channel: "in_app",
  existingNotifications: [],
  now: quietNow,
});
assert.equal(quiet.deliver, false);
assert.equal(quiet.reason, "quiet_hours");
assert.ok(quiet.deliverAt);

const urgent = decideReminderDelivery({
  checkIn: { ...baseCheckIn, referralLevel: "seek_emergency_care" as const },
  settings,
  channel: "in_app",
  existingNotifications: [],
  now: quietNow,
});
assert.equal(urgent.deliver, true);
assert.equal(urgent.reason, "urgent_override");
assert.equal(urgent.priority, "urgent");

const duplicate = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings,
  channel: "in_app",
  existingNotifications: [{ fingerprint: due.fingerprint }],
  now: new Date("2026-07-19T12:00:00.000Z"),
});
assert.equal(duplicate.deliver, false);
assert.equal(duplicate.reason, "duplicate");

const careOff = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings: { ...settings, careEmailChannelConsent: false, emailOptIn: true },
  channel: "email",
  existingNotifications: [],
  now: new Date("2026-07-19T12:00:00.000Z"),
});
assert.equal(careOff.deliver, false);
assert.equal(careOff.reason, "email_opt_out");

const careOn = decideReminderDelivery({
  checkIn: baseCheckIn,
  settings: { ...settings, careEmailChannelConsent: true, emailOptIn: false },
  channel: "email",
  existingNotifications: [],
  now: new Date("2026-07-19T12:00:00.000Z"),
});
assert.equal(careOn.deliver, true);
assert.equal(careOn.reason, "due");

console.log("reminder delivery policy self-test passed");
