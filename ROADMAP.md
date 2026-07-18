# ROADMAP.md ??K-Beauty Match

최종 갱신: 2026-07-18

?�세 기술 초안?� `docs/07_Roadmap.md`?�도 ?�으?? **?�재 ?�제 진행 ?�태??�?문서�??�선**?�다.  
?�합 ?�황?? `PROJECT_DASHBOARD.md`

---

## 0. 지�?????(?�일)

**?�재 ?�일 목표:** Production ?�인 ?��?(?�?�보???�인 ???�Production 배포 진행??

- [x] **Phase A** ???�황?��?check:mvp`·CI·?�동???�책·?�크?�테?�션 병렬 기반
- [x] **Phase B** ???�→분석?�문진→결과?�인증→마이 ?�자???�정
- [x] **Phase C** ??Staging 카탈로그 ?�질 ?�동?�·추�?SSOT·PDP 기반
- [x] **Phase D** ??3·7·15·30 체크??UX · 루틴 · ?�림 · ?�전 분기 · worker dry-run
- [x] **Phase E** ???�합 검�?· Preview MANUAL · Production 준�?체크리스??(**배포???�인 ??*)

### 최근 ?�료 (?�약)

- [x] Phase E: RELEASE_AUDIT · env readiness · prod-safety · journey A?�H · 체크리스??롤백/?�정
- [x] Phase D: 체크??SSOT·Day�?질문·?�전 게이?�·알�??�터·?�메??adapter·care workers
- [x] Phase C: `catalog:phase-c` · recommendableCriteria · Auto Queue · `/products/[slug]`
- [x] Phase B: ?�자???�큰·JourneyProgress·??CTA·analyze 3?�계·문진·결과·로그??마이
- [x] main 병합 ?�료 (`2b17f5f`) ??**??Production 배포??별개·미실??*
- [x] Preview SSO UI · Staging ?��?검�?· 로컬 출시 준�?검??
- [x] Staging INCI with_inci **57** · ?�여 27 **BLOCKED**
- [x] A??Production DB ?�규 5�?id 188~192)

### 보류 / BLOCKED

- [ ] Production ?�플리�??�션 배포 ??**?�Production 배포 진행??* ?�인 ??
- [ ] main ??`automation-mvp-completion` 병합 ???�인 ??
- [ ] Production 케???�론·?�제 ?�메??발송 ???�인 ??
- [ ] Preview ?�안 최종 (MANUAL)
- [ ] Vercel Production AI_PROVIDER / SITE_URL · Supabase Auth URL (?�?�보??
- [ ] ?�여 27 heroes 공식 INCI ??**BLOCKED**
- ?�정: **Production ?�인 ?��?* (무단 배포 금�?)


---

## 1. ?�료

- [x] GitHub ?�결
- [x] 기본 ?�로?�트 구조
- [x] Supabase ?�품 조회
- [x] 추천 ?�이?�라??
- [x] AI 분석 API (`POST /api/analyze`)
- [x] Mock AI
- [x] ?�장 분석 결과 구조
- [x] 결과 ?�이지 ?�결
- [x] ?�심 추천 Top 5
- [x] ?�반 ?�품 ?�색 분리
- [x] ?�분 ?�시�??��???
- [x] 빌드 검�?
- [x] **Sprint 9** ???�레르기·?�피 ?�분 ?�전 ?�터
- [x] **Sprint 10** ???�재 ?�품 ?�록·루틴 ?��?
- [x] **Sprint 12** ??canonical 브랜?�명 ?��???(?�번??복구)
- [x] **Sprint 13** ???�국 카탈로그 ?�플릿·�?�??�구
- [x] `product_offers` ?�격 migration ?�용 (`20260713022607`)

---

## 2. 진행 �???Sprint 14

방향: ?�순 COSRX ?�동 ?�력?�서 **Search-to-Verified-Product Pipeline** ?�계�??�장.

- [x] COSRX ?�제??3개·offer 3�?로컬 ?�록 (검�??��??��?)
- [x] `/admin/catalog-review` 개발??검??UI
- [x] `product_offers` migration (bigint FK, 최소 권한 RLS) ?�격 ?�용
- [x] GitHub 백업 브랜�?`backup-sprint14-20260713`
- [x] 검???�선·검�????�록 ?�칙??Master Plan / Project Rule??공식??
- [x] Search-to-Verified 11?�이�?+ admin_users/history migration·bootstrap
- [x] 관리자 ?�증 가??최소 구현 (clients / proxy / layout / auth-check)
- [x] 관리자 로그???�이지 최소 구현 (`/admin/login`, logout)
- [x] 관리자 비�?번호 ?�설??최소 구현 (`/admin/forgot-password`, `/admin/reset-password`)
- [x] 비�?번호 ?�설??PKCE callback (`/auth/callback` ??cookie ?�션)
- [x] 비�?번호 ?�설??`token_hash` + `verifyOtp(recovery)` 보완
- [x] 관리자 ?�?�보??1�?(?�기 ?�용 `/admin` + `/api/admin/dashboard`)
- [x] 관리자 ?�품 목록 1�?(?�기 ?�용 `/admin/products` + API)
- [x] 관리자 ?�품 ?�세 1�?(?�기 ?�용 /admin/products/[id] + API)
- [x] 관리자 discovery 목록 1�?(?�기 ?�용 /admin/discovery + API)
- [x] 관리자 discovery ?�세 1�?(?�기 ?�용 /admin/discovery/[id] + API)
- [x] 관리자 ?�분 목록 1�?(?�기 ?�용 /admin/ingredients + API)
- [x] 관리자 ?�분 ?�세 1�?(?�기 ?�용 /admin/ingredients/[id] + API)
- [x] 관리자 verification 목록 1�?(?�기 ?�용 /admin/verification + API)
- [x] 관리자 verification ?�세 1�?(?�기 ?�용 /admin/verification/[id] + API)
- [x] 관리자 ?�기 ?�용 ?�영 콘솔 ?�비 ?�리 (AdminSubnav)
- [x] Search-to-Verified 관리자 ?�기 UI/API 1�?(권한·?�보·?�·�??�·workflow)
- [x] URL/CSV 기반 discovery 빠른 ?�록 (preview·commit·SSRF)
- [x] ?�율 카탈로그 ?�이?�라??1�?(orchestrator·crawl·extract·dedupe·score·admin·worker·docs)
- [x] pipeline DB migration ?�용 (`create_autonomous_pipeline_persistence`)
- [x] Supabase persistence + dry_run worker 1??검�?
- [x] Cursor/worker 분리 · config-driven 고정 ?��?줄러 진입??
- [x] ?�율 draft catalog · INCI ?�결 · 추천 pool draft ?�외 (코드 ?�료, worker ?�음 ?��?�??�용)
- [x] ?�율 offer discovery · verification gate · admin offers (코드 ?�료, worker ?�음 ?��?�??�용)
- [x] ?�율 ?�품 검증·활?�화·verified catalog 추천 ?�결 (코드 ?�료, worker ?�음 ?��?�??�용)
- [x] ?�영 모니?�링·?�림?�터·safe recovery (코드 ?�료, worker ?�음 ?��?�??�용)
- [x] Continuous Care 1�?(`/my` · check-ins · progress · referral · admin care 집계 · docs/123~132 BLOCKER)
- [x] Continuous Care ?�버 ?�속??(migration ?�용 · CarePersistence · `/api/care/*` · worker tick · docs/133~137)
- [x] ?�반 ?�용???�증·?�보?�·Care E2E (`/login` `/signup` · `/my` 보호 · link-local · docs/138~142)
- [x] Phase 8 ?�정 ?�합 · 공개 ?�비 · production check · journey tests (docs/143~148)
- [x] Phase 9 staging/release 준�?· env/health/smoke/security · headers/SEO/error pages (docs/149~154)
- [x] Phase 10 UI·반응?�·접근성 최종 · header/Hero · check:responsive · docs/155~158
- [x] Staging 격리 · `product-images` private Storage · signed URL
- [x] `createAdminProduct` Staging HTTP E2E · slug 중복 차단 · ?�성�?주요?�분 · media ?�결
- [x] service_role 최소 SELECT (`ingredient_aliases` · `product_offers` · `product_variants`)
- [x] 관리자 ?�세 로컬 Staging 조회 (`productId=3`, offers/variants 0 = �??�태)
- [x] **Preview Staging ?�정 + `/admin/products/3` 브라?��? E2E** (?�료 · ?�요�?금�?)
- [x] Windows Task Scheduler ?�자�?고정 `run-pipeline.ps1`�??�렬 ?�인 (`KBeautyMatch-Pipeline`)
- [x] COSRX catalog JSON 3개�? �??�제 검�??��?�?Staging ?�용
- [x] 한국 공식몰 verified import bundle (READY 7) — Staging 등록·Preview Verified는 대기
- [ ] Supabase ?�품/offer 반영 (**Production ?�인 ??*)
- [x] `data/backups` JSON 백업 (`data/backups/2026-07-14-catalog/`)

### ?�재 ?�계 (2026-07-14)

- Staging catalog JSON 백업·검�? **?�료**
- **?�음:** Production/main ?�업?� ?�용???�인 ?�에�?
- main 병합: **????* · Production 배포/DB: **????*

---

## 3. ?�음 ?�서 (Search-to-Verified-Product Pipeline)

1. ?�이?�라???�이??모델 ?�계  
2. 검???�보 ?�??구조  
3. ?�매 검�??�태  
4. ?�성�?구조  
5. ?�문 근거 DB ??Staging ?�드·?�적 카탈로그·관리자 Evidence CRUD ?�결 ?�료  
6. 관리자 검�??�면  
7. COSRX 3개�? �??�제 검�??��?�??�용  
8. Supabase 반영  
9. JSON 백업  
10. GitHub push  

?��? 개발 ??��:

- ?�제 ?�품 검??계층  
- ?�매 ?�태 검�? 
- ?�성�??�집  
- ?�분 ?��??? 
- ?�문 근거 ?�결 ??추천/결과 + `/admin/evidence` ?�료 (Preview SSO ?�동 ?�인 ?��?  
- 중복 검?? 
- 관리자 ?�인  
- Supabase ?�록  
- ?�기 ?��?�? 

---

## 4. ?�후 ?�계

- ?�제 Anthropic / OpenAI / Ollama ?�결
- �??·?�어·?�화 고도??
- ?�용??계정�?분석 결과 DB ?�??
- 3?��??��?5?��?0???��? ?�인
- 관리자 권한·?�로??UI
- ?�진 분석 (비전)
- ?�스?�·보?�·배??
