# WORK_QUEUE — Fast Execution Task Queue

단일 `active` task. complete 후 `npm run project:next`.

### TASK WQ-A-checkin-email-queue-staging

id: WQ-A-checkin-email-queue-staging
title: Checkin email queue Staging migration and verify
priority: 10
status: active
environment: staging
deps:
tests:
  - npm run test:checkin-email-queue
  - npm run test:checkin-email-queue-migration
  - npm run test:checkin-email-queue-persistence
  - npm run test:admin-care-readiness
  - npm run gate:checkin-email-queue-staging
approval_required: false
dashboard_sql: true
dashboard_sql_file: supabase/migrations/20260722010000_create_checkin_email_queue.sql
notes: Staging Dashboard SQL apply pending; probe after apply

### TASK WQ-B-photo-compare-consent

id: WQ-B-photo-compare-consent
title: Photo compare consent and deletion flow
priority: 20
status: queued
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:care-data
approval_required: false

### TASK WQ-C-revisit-dashboard

id: WQ-C-revisit-dashboard
title: Revisit dashboard enhancements
priority: 30
status: queued
environment: staging
deps: WQ-B-photo-compare-consent
tests:
  - npm run test:care-dashboard
approval_required: false

### TASK WQ-D-checkin-scheduling

id: WQ-D-checkin-scheduling
title: Checkin scheduling and notification channels
priority: 40
status: queued
environment: staging
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:checkin-policy
  - npm run test:reminder-delivery
approval_required: false

### TASK WQ-E-care-worker-admin

id: WQ-E-care-worker-admin
title: Care worker admin and dry-run delivery
priority: 50
status: queued
environment: staging
deps: WQ-D-checkin-scheduling
tests:
  - npm run test:care-guidance
  - npm run test:routine-adjustment
approval_required: false

### TASK WQ-F-catalog-remaining

id: WQ-F-catalog-remaining
title: Catalog remaining sprint and refresh
priority: 60
status: queued
environment: staging
deps:
tests:
  - npm run test:catalog-refresh
  - npm run test:catalog-refresh-due
approval_required: false

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
