# Check-in email worker admin (WQ-E)

Staging/preview Care admin for `checkin_email_queue` dry-run ops.

## Hard rules

- **No live email** — dry-run worker only (`providerCalls === 0`)
- Production `VERCEL_ENV` / Production Supabase ref (`rhfr***mns`) blocked
- Preview test-send stays in-memory (`preview-email-test:…`) separate from DB queue
- Idempotency for DB queue: `checkin-email:v1:…`
- Snapshot / API never expose recipient, payload, user_id, or raw email

## Admin retry choice

`manual_retry` (from `failed`, optionally `cancelled` with flag):

- status → `pending`
- **retry_count reset to 0**
- **last_error cleared**

## Endpoints

- `GET /api/admin/care/checkin-email-worker` — snapshot
- `POST /api/admin/care/checkin-email-worker` — `{ action, confirm: "CONFIRM", jobId?, limit? }`
  - `dry_run_tick` | `manual_retry` | `manual_cancel`

## UI

`/admin/care/checkin-email-worker` — linked from `/admin/care` queue panel.

## Rate limit

In-memory: 30 actions / minute / admin subject.

## Tests

```bash
npm run test:checkin-email-worker-admin
npm run test:checkin-email-queue-persistence
npm run test:checkin-email-queue
npm run test:care-guidance
npm run test:routine-adjustment
npm run verify:checkin-email-worker-admin-staging
```

Staging verify is SELECT-only by default (no Resend, no remote dry-run unless explicitly extended later).
