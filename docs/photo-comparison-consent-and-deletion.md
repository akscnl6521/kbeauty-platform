# Photo comparison consent and deletion

Design summary for WQ-B (K-Beauty Match care photos).

## Goals

- Let users choose **analysis only** (ephemeral) vs **save for comparison** (up to 90 days).
- Optional **learning opt-in** only when save consent is granted.
- User-controlled deletion (single asset or delete all).
- No PII in storage paths, audit metadata, or filenames.
- EXIF stripped best-effort before any future upload path.

## Policy layer

- `src/lib/care/photoComparisonPolicy.ts` — pure types and rules.
- Persist requires: `analysisConsent && saveForComparison && retentionAcknowledged`.
- Learning requires persist + `learningOptIn`.
- `analysis_only` → auto purge after analysis (in-memory service + UI ack).

## Service layer (tests / Preview synthetic)

- `src/lib/care/photoComparisonService.ts` — `FakePhotoComparisonStore`, no network/Storage.
- Delete sequence: mark pending → delete storage objects (later) → mark deleted → audit.

## API

| Route | Purpose |
|-------|---------|
| `GET/POST /api/care/photo-consents` | Defaults + stored consent; upsert with validation |
| `GET/POST /api/care/photo-assets` | List metadata; synthetic POST when `x-synthetic-fixture:1` and non-production |
| `DELETE /api/care/photo-assets/[id]` | Idempotent delete request |
| `POST /api/care/photo-assets/delete-all` | Delete all own assets |

Missing tables → `migrationPending` (GET) or `503 MIGRATION_PENDING` (writes).

Real upload returns `501 NOT_IMPLEMENTED` until Staging Storage is approved.

## Database (DRAFT only)

- `supabase/migrations/DRAFT_DO_NOT_APPLY_care_photo_comparison.sql`
- Tables: `photo_comparison_consents`, `photo_assets`, `photo_deletion_requests`, `photo_audit_events`
- RLS owner policies; authenticated SELECT/INSERT/UPDATE only; no DELETE grant.
- **Not applied** to Staging/Production until explicit approval.

## Storage (manual, later)

- Private bucket name: `care-photos` (constant only; bucket **not** created in this task).
- Signed URL TTL: 5 minutes (`SIGNED_URL_TTL_SEC`).

## UI

- `PhotoConsentPanel` — analyze + settings
- `PhotoAssetsSettingsPanel` — settings list/delete

## Manual approval required

1. Apply DRAFT migration to Staging (Dashboard SQL).
2. Create private `care-photos` Storage bucket on Staging.
3. Wire real upload + Storage delete worker after the above.

## Tests

```bash
npm run test:photo-comparison
```
