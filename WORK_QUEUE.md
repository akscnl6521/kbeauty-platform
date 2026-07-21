# WORK_QUEUE — Fast Execution Task Queue

단일 `active` task. complete 후 `npm run project:next`.

### TASK WQ-A-checkin-email-queue-staging

id: WQ-A-checkin-email-queue-staging
title: Checkin email queue Staging migration and verify
priority: 10
status: completed
result_commit: 3a79fbccd078e73e3530ae58e2ebfa4b991ae54a
environment: staging
deps:
tests:
  - npm run test:checkin-email-queue
  - npm run test:checkin-email-queue-migration
  - npm run test:checkin-email-queue-persistence
  - npm run test:admin-care-readiness
  - npm run gate:checkin-email-queue-staging
  - npm run verify:checkin-email-queue-staging
approval_required: false
dashboard_sql: true
dashboard_sql_file: supabase/migrations/20260722010000_create_checkin_email_queue.sql
notes: Staging Dashboard SQL applied; verify pass (FK/status/payload negative + claim RPC; positive insert skipped — no care_check_ins rows)

### TASK WQ-B-photo-compare-consent

id: WQ-B-photo-compare-consent
title: Photo compare consent and deletion flow
priority: 20
status: completed
result_commit: a55d72a0914fe381c796b12f6ca77321d3f82713
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:photo-comparison
  - npm run test:care-data
approval_required: true
notes: Code+tests complete; Staging DRAFT migration NOT applied — awaiting approval; care-photos bucket not created

### TASK WQ-C-revisit-dashboard

id: WQ-C-revisit-dashboard
title: Revisit dashboard enhancements
priority: 30
status: completed
result_commit: 336893858ac70dff118595081945f54a11c1810d
environment: staging
deps: WQ-B-photo-compare-consent
tests:
  - npm run test:revisit-dashboard
  - npm run test:care-dashboard
approval_required: false
notes: revisitDashboard + quickSkinCheck pure · /my 섹션 재구성 · photo-consents 클라이언트 fetch · migration 미적용 유지

### TASK WQ-D-checkin-scheduling

id: WQ-D-checkin-scheduling
title: Checkin scheduling and notification channels
priority: 40
status: completed
result_commit: a568bed6b723ac65e163bbf75e4a83f403d44de8
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:checkin-policy
  - npm run test:reminder-delivery
  - npm run test:checkin-scheduling
approval_required: false
notes: orchestrator + channel consent UI + worker enqueue (no live send) · docs/checkin-scheduling.md

### TASK WQ-E-care-worker-admin

id: WQ-E-care-worker-admin
title: Care worker admin and dry-run delivery
priority: 50
status: completed
result_commit: c2711d5fae25dba44f08caa0d6c748fdb84c44fa
environment: staging
deps: WQ-D-checkin-scheduling
tests:
  - npm run test:care-guidance
  - npm run test:routine-adjustment
  - npm run test:checkin-email-worker-admin
approval_required: false
notes: dry-run worker admin · claim/retry/stale · manual retry/cancel · Staging SELECT verify · no live send

### TASK WQ-F-catalog-remaining

id: WQ-F-catalog-remaining
title: Catalog remaining sprint and refresh
priority: 60
status: completed
result_commit: cf68e0eba42a403bac665fd1ee8914325ae3c18a
environment: staging
deps:
tests:
  - npm run test:catalog-refresh
  - npm run test:catalog-refresh-due
  - npm run test:catalog-quality-status
  - npm run test:catalog-exception-queue
approval_required: false
notes: officialCrawl Shopify-list extract · qualityStatus · exception queue · Staging discovery candidates upsert (no publish)

### TASK WQ-G-prelaunch-integration

id: WQ-G-prelaunch-integration
title: Prelaunch integration and production readiness gate
priority: 90
status: queued
environment: production
deps: WQ-C-revisit-dashboard, WQ-E-care-worker-admin, WQ-F-catalog-remaining
tests:
  - npm run check:production
  - npm run check:release-security
approval_required: true
