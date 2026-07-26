# Check-in scheduling (WQ-D)

Channel consent + due/reminder scheduling. No live email send.

## Pure modules
- `src/lib/retention/checkinSchedulingOrchestrator.ts`
- helpers: `resolveCareNotificationLocale`, `deriveReminderCountFromQueueKeys`, `mapSettingsToEmailConsent`
- `src/lib/retention/runCheckinSchedulingTick.ts` (enqueue only)
- `src/lib/care/settingsDefaults.ts`
- `src/lib/care/notificationPreferences.ts` (auth user_metadata persistence, no new migration)

## Consent channels
- Site notifications: `notificationsEnabled` (in-app)
- Care check-in email: `careEmailChannelConsent`
- Marketing email: `emailOptIn`

Marketing unsubscribe is NOT the same as care channel opt-out.

## Schedule
- Day 3 / 7 / 15 / 30 via `createCheckInSchedule` / `buildCheckinScheduleIfConsented`
- User timezone (local 10:00) + locale ko|en|ja

## Idempotency
`checkin-email:v1:{user_id}:{checkin_id}:{milestone}:{kind}:email`

Preview test-send (`preview-email-test:`) stays in-memory. Persistence rejects those keys.

## Reminder
48h after due, once. `reminderCount` derived from queue keys.

## Admin
- `GET /api/admin/care/checkin-email-queue-status`
- `/admin/care` panel + Preview test page link

## Tests
`npm run test:checkin-scheduling`
`npm run test:checkin-policy`
`npm run test:reminder-delivery`

## Staging SELECT only
`npm run verify:checkin-scheduling-staging`

No INSERT, no live send, no Production.
