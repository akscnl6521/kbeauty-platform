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
  2026-07-27 알레르겐 필터 전성분 확장 완료(승인 후). 커버리지 향료 3→21/23 · 리모넨 0→14/14.
  확장이 새로 만들 뻔한 오탐 2종(지방 알코올 15건, Ethylhexylglycerin 2건)을 접두 매처로 같이 해소.
  2026-07-27 category 채우기 43/44 완료. 미채움 1건(242 아로마티카 알로에 젤)은 needs_review 큐.
  알레르겐 노출 감사: 옛 필터가 놓쳤던 28건 전부 해소 확인 (Staging 한정).
  2026-07-27 얼굴 트랙 밖 8건 추천 풀에서 제외 완료 (제품은 내리지 않음, 코드 필터). 풀 106 -> 98.
  진행 중: Production 알레르겐 감사 — SELECT 전용 SQL 작성 완료, 사람이 Dashboard 에서 실행 후 결과 회수.
  2026-08-04 §35.7 파서 잔여물 해소 — 알레르겐 미검출 2 -> 0건. 원인은 광고 문구가 아니라
  (a) 규제 안내가 마지막 성분에 쉼표 없이 붙음, (b) 호수별 목록이 이어붙음 두 가지였다.
  stripIngredientNoticeTail + 호수 구분자 분리로 해결. 호수는 끊지 않고 쪼갠다(뒤쪽 알레르겐 보존).
  2026-08-04 카탈로그 확대 — 추천 풀 17 -> 26건, 브랜드 6 -> 10개. 원인은 데이터 부족이 아니라
  저장된 전성분이 잘못 쪼개져 있던 것(쉼표 분리 버그 잔재). 재분리 13행 -> 게이트 통과 9건.
  제품 이미지 0 -> 26/26 (catalog_product_media 생성 + Shopify 수집 58건 + 화면 배선).
  국내 오퍼: 네이버 쇼핑 API 폐지 확정, 대체 경로로 브랜드 국내몰 sitemap+JSON-LD 구축.
  남은 병목은 한글<->영문 제품명 대조. 느슨하게 하면 다른 제품이 붙으므로 하한은 낮추지 않는다.
  **미배포 10커밋** — main push 가 .claude/settings.json 에 막혀 사람이 병합해야 한다.
  2026-08-04 LHA 판단 완료 — Salicylic Acid 그룹에 묶었다. Betaine Salicylate 를 같은 그룹에
  둔 기존 선례와 같은 결이고, 판단이 갈리면 «거르는 쪽» 을 고른다. Benzyl Salicylate 는
  향료 알레르겐이라 일부러 분리 유지(양방향 회귀 테스트로 고정). Staging 영향 2건.

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
