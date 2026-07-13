# 82 — Pipeline Database Persistence

최종 갱신: 2026-07-13

## 적용

- Migration name: `create_autonomous_pipeline_persistence`
- Remote version: `20260713084701` (MCP timestamp)
- Local file: `supabase/migrations/20260713100000_create_autonomous_pipeline_persistence.sql`
- Rollback (manual only): `docs/81-pipeline-migration-rollback.sql`

## Backend

- 운영 기본: `SupabasePersistence` (`src/lib/pipeline/persistence/supabase.ts`)
- Fallback: `FilePersistence` (`PIPELINE_PERSISTENCE=file` 또는 비상)
- Commit 모드: Supabase 필수

## Tables

pipeline_batches, pipeline_jobs, brand_official_site_state, product_field_provenance,
product_quality_scores, product_skin_match_scores, product_change_candidates

## RLS

- 전부 RLS ON
- anon/authenticated: REVOKE ALL, GRANT 없음
- service_role만 서버/worker 접근

## Claim

`claim_pipeline_jobs(batch_id, worker_id, limit, stale_seconds)` — FOR UPDATE SKIP LOCKED
