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
title: Recommendation-scenario Top10 candidate pools (not mass SKU)
priority: 60
status: active
environment: staging
deps:
tests:
  - npm run test:recommendation-scenarios
  - npm run analyze:scenario-catalog-gap
  - npm run test:catalog-quality-status
approval_required: false
notes: |
  Phase 0/1: curated KR scenarios (30), types, match/pool/gap pure logic, docs.
  Official crawl + product_discovery_candidates = ingestion feed for scenario pools (not storefront).
  Not shopping/price-comparison. No Cartesian scenario explosion.
  Modifiers (age/climate/country/budget/routine/avoid/allergy/availability) re-rank within pool only.
  Phase 2+: schema + pool fill + runtime Top3-5. No WQ-G / Production / main / auto-publish.
  Pilot Top10 artifacts: data/catalog/scenario-pilot/2026-07-22/ (docs/catalog/SCENARIO_TOP10_PILOT.md · npm run test:recommendation-pilot).
  Enrichment artifacts: data/catalog/scenario-pilot-enrichment/2026-07-22/ (npm run test:recommendation-pilot-enrichment).
  2026-07-27 품질 검증(npm run check:recommendation-scenarios): 활성 106건으로 KR 시나리오 6종 실행.
  수집기가 key_ingredients 를 안 채워 60건이 추천에서 제외되던 문제 수정·백필 41건 완료.
  대기 중(손대지 않음): sioris 24건(성분 이미지뿐) · 에스쁘아 8 / 미쟝센 4(오퍼 없음) · COSRX 9건 비활성.
  승인 대기: 안전 필터가 full_ingredients 를 안 봐서 향료 40건 중 3건만 걸러짐 — filterCandidatesBySafety 확장 여부.
  대기열: 활성 44건(abib 43 · 아로마티카 1) category 미채움 → 시나리오 카테고리 매칭 불가.

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
