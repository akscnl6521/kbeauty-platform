# Follow-up lifecycle (T02)

3/7/15/30 care follow-up lifecycle. **Real email/SMS/push is not claimed complete.**

## Modules

| Path | Role |
|------|------|
| `src/lib/retention/followUpLifecycle.ts` | Opt-in → schedule → due → check-in decisions → routine adjust → red-flag → pause/resume |
| `src/lib/retention/followUpDelivery.ts` | Channel interfaces (in_app/email/sms/push) · dry-run / disabled / live_blocked adapters · status records |
| `src/lib/retention/followUpLifecyclePersistence.ts` | Local serialize/parse · resume · corrupt → empty fallback |
| `src/lib/admin/followUpLifecycleAdmin.ts` | Admin counts only (no PII) |

## Channels

- Site: `notificationsEnabled`
- Email: `careEmailChannelConsent` (existing queue/dry-run retained)
- SMS: `careSmsChannelConsent` (interface + dry-run only)
- Push: `carePushChannelConsent` (interface + dry-run only)

`live` env resolves to `live_blocked`. `realDeliveryClaimed` is always `false`.

## Admin

- `/admin/care/follow-up`
- `GET /api/admin/care/follow-up-lifecycle`

## Tests

```bash
npm run test:follow-up-lifecycle
```

Related: `test:checkin-policy` · `test:checkin-scheduling` · `test:reminder-delivery` · `test:routine-adjustment`
