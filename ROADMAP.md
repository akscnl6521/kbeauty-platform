# ROADMAP.md — K-Beauty Match

최종 갱신: 2026-07-15

상세 기술 초안은 `docs/07_Roadmap.md`에도 있으나, **현재 실제 진행 상태는 본 문서를 우선**한다.

---

## 0. 지금 할 일 (단일)

- [x] 출시 직전 로컬 검사 · 브랜치 push (`1181edd`)
- [x] Staging `products` anon SELECT 권한·RLS 수정 (`permission denied` 해소)
- [x] Evidence Layer 1차: 증상→성분 공개 근거 → 추천/결과 UI (Staging 시드 8건)
- [x] Evidence Layer 2차: admin Evidence CRUD API·UI · DB 승인 근거 조회 · acne 시드
- [x] Evidence Layer 2차 보강: 색소·주름·모공·UV · acne(살리실산) · 고민별 주의·랭킹 분기 검증
- [x] Evidence·한국 제품 추천 품질 회귀 (`test:quality` · Staging `check:staging-quality`)
- [x] Preview 자동 스모크 (`check:preview-quality`) — Deployment Protection → **SSO 수동 승인 대기**
- [x] Preview SSO 대체 검증 (`check:preview-substitute`) — Staging linked 카탈로그 8고민 E2E
- [x] **Full Beauty 스프린트** — 카테고리·35브랜드·1161후보 Staging · 메이크업/헤어 랭커 · bulk-review · Preview
- [x] **Discovery 보강** — 플레이스홀더 1085 rejected · 전 브랜드 enrich 완료 · 문진 4종 · bulk API · Preview
- [x] **INCI/라벨 보강 1차** — 라벨 파서·COSRX URL override·`catalog:inci` · 일시 실패 비덮어쓰기 · 문진→results 속성 힌트 (전성분 건수 0 유지)
- [x] **공식 전성분 라벨시트 채널** — curated sheet · Staging apply · with_inci 9 · `/admin/catalog/labels` · `labels:sync`
- [x] **OBF 전성분 수확 채널** — `catalog:labels:obf` · 엄격 매칭(자동 apply 0 · Banila 후보 검수용)
- [x] **Admin Labels 검수·Staging 적용** — `/admin/catalog/labels` + apply API
- [x] **Banila 오매칭 제거 · Staging EN 이름 정리** — 폼≠밤 · `catalog:labels:status`
- [x] **Banila Clean It Zero Original 공식 US PDP INCI** — `banilausa.com` · sheet `applyReady=true` (Staging apply는 승인 후)
- [x] **Staging Banila·COSRX 라벨 적용** — with_inci **12** · official_matched **13** · apply `match_class` 보정
- [x] **LANEIGE US 공식 INCI** — Cream Skin · Lip Sleeping Mask(BERRY) · with_inci **14**
- [x] **Anua·Torriden US 공식 INCI** — Heartleaf/Niacinamide+TXA · Dive-In · with_inci **17**
- [x] **Beauty of Joseon·ROUND LAB 공식 INCI** — CPNP 3건 + Dokdo/Birch · with_inci **22**
- [x] **SKIN1004·PURITO·Klairs·AXIS-Y 공식 INCI** — with_inci **26**
- [x] **numbuzin·PURITO sun·AXIS-Y sun 공식 INCI** — with_inci **29**
- [x] **mixsoon·Isntree (US DailyMed) 공식 INCI** — with_inci **31**
- [x] **SKIN1004 Hyalu-Cica Water-Fit Sun (US DailyMed)** — with_inci **32**
- [x] **heimish All Clean Balm (US PDP)** — with_inci **33**
- [x] **AMOREPACIFIC·Haruharu·Etude SoonJung 공식 INCI** — with_inci **36**
- [x] **Lador Hydro LPP·Perfect Hair Fill-up 공식 INCI** — with_inci **38**
- [x] **medicube·Dr.Jart Cicapair·MISSHA BB(13/21/23) 공식 INCI** — with_inci **43**
- [x] **Sulwhasoo First Care VI·COSRX Clear Fit Patch 공식 INCI** — with_inci **45**
- [x] **mise en scène Perfect Serum Original 공식 INCI** — with_inci **46**
- [x] **mise shampoo·goodal eye·ETUDE/CLIO/PERIPERA mascara 공식 INCI** — with_inci **51**
- [ ] Preview SSO 승인 후 브라우저 UI 수동 확인 (`/analyze`→`/results`·`/admin/catalog/labels`·bulk-review)
- [ ] 잔여 heroes 공식 INCI (SOME BY MI/innisfree/TOCOBO Soft≠Airy·rom&nd·HERA·espoir 등) — Staging 제품등록은 승인 없이 계속
- [ ] 브랜드 terms/robots 승인 후 추가 공식 수집 채널
- [ ] Production `AI_PROVIDER` ≠ mock 확인 (Vercel Dashboard)
- [ ] Supabase Auth Site URL / Redirect URLs Production 도메인 확인
- [ ] **A안:** Staging 한국 COSRX 시드 Production 반영 (승인 후)
- [ ] main 병합 · Production 배포 — **승인 후**
- 판정: **BLOCKED** (타브랜드 라벨 확보 · Preview SSO · Production 출시 항목)


---

## 1. 완료

- [x] GitHub 연결
- [x] 기본 프로젝트 구조
- [x] Supabase 제품 조회
- [x] 추천 파이프라인
- [x] AI 분석 API (`POST /api/analyze`)
- [x] Mock AI
- [x] 확장 분석 결과 구조
- [x] 결과 페이지 연결
- [x] 핵심 추천 Top 5
- [x] 일반 제품 탐색 분리
- [x] 성분 표시명 표준화
- [x] 빌드 검증
- [x] **Sprint 9** — 알레르기·회피 성분 안전 필터
- [x] **Sprint 10** — 현재 제품 등록·루틴 점검
- [x] **Sprint 12** — canonical 브랜드명 표준화 (오번역 복구)
- [x] **Sprint 13** — 한국 카탈로그 템플릿·검증 도구
- [x] `product_offers` 원격 migration 적용 (`20260713022607`)

---

## 2. 진행 중 — Sprint 14

방향: 단순 COSRX 수동 입력에서 **Search-to-Verified-Product Pipeline** 설계로 확장.

- [x] COSRX 실제품 3개·offer 3개 로컬 등록 (검증 대기 사례)
- [x] `/admin/catalog-review` 개발용 검토 UI
- [x] `product_offers` migration (bigint FK, 최소 권한 RLS) 원격 적용
- [x] GitHub 백업 브랜치 `backup-sprint14-20260713`
- [x] 검색 우선·검증 후 등록 원칙을 Master Plan / Project Rule에 공식화
- [x] Search-to-Verified 11테이블 + admin_users/history migration·bootstrap
- [x] 관리자 인증 가드 최소 구현 (clients / proxy / layout / auth-check)
- [x] 관리자 로그인 페이지 최소 구현 (`/admin/login`, logout)
- [x] 관리자 비밀번호 재설정 최소 구현 (`/admin/forgot-password`, `/admin/reset-password`)
- [x] 비밀번호 재설정 PKCE callback (`/auth/callback` → cookie 세션)
- [x] 비밀번호 재설정 `token_hash` + `verifyOtp(recovery)` 보완
- [x] 관리자 대시보드 1차 (읽기 전용 `/admin` + `/api/admin/dashboard`)
- [x] 관리자 제품 목록 1차 (읽기 전용 `/admin/products` + API)
- [x] 관리자 제품 상세 1차 (읽기 전용 /admin/products/[id] + API)
- [x] 관리자 discovery 목록 1차 (읽기 전용 /admin/discovery + API)
- [x] 관리자 discovery 상세 1차 (읽기 전용 /admin/discovery/[id] + API)
- [x] 관리자 성분 목록 1차 (읽기 전용 /admin/ingredients + API)
- [x] 관리자 성분 상세 1차 (읽기 전용 /admin/ingredients/[id] + API)
- [x] 관리자 verification 목록 1차 (읽기 전용 /admin/verification + API)
- [x] 관리자 verification 상세 1차 (읽기 전용 /admin/verification/[id] + API)
- [x] 관리자 읽기 전용 운영 콘솔 내비 정리 (AdminSubnav)
- [x] Search-to-Verified 관리자 쓰기 UI/API 1차 (권한·후보·큐·검토·workflow)
- [x] URL/CSV 기반 discovery 빠른 등록 (preview·commit·SSRF)
- [x] 자율 카탈로그 파이프라인 1차 (orchestrator·crawl·extract·dedupe·score·admin·worker·docs)
- [x] pipeline DB migration 적용 (`create_autonomous_pipeline_persistence`)
- [x] Supabase persistence + dry_run worker 1회 검증
- [x] Cursor/worker 분리 · config-driven 고정 스케줄러 진입점
- [x] 자율 draft catalog · INCI 연결 · 추천 pool draft 제외 (코드 완료, worker 다음 스케줄 적용)
- [x] 자율 offer discovery · verification gate · admin offers (코드 완료, worker 다음 스케줄 적용)
- [x] 자율 제품 검증·활성화·verified catalog 추천 연결 (코드 완료, worker 다음 스케줄 적용)
- [x] 운영 모니터링·알림센터·safe recovery (코드 완료, worker 다음 스케줄 적용)
- [x] Continuous Care 1차 (`/my` · check-ins · progress · referral · admin care 집계 · docs/123~132 BLOCKER)
- [x] Continuous Care 서버 영속화 (migration 적용 · CarePersistence · `/api/care/*` · worker tick · docs/133~137)
- [x] 일반 사용자 인증·온보딩·Care E2E (`/login` `/signup` · `/my` 보호 · link-local · docs/138~142)
- [x] Phase 8 여정 통합 · 공개 내비 · production check · journey tests (docs/143~148)
- [x] Phase 9 staging/release 준비 · env/health/smoke/security · headers/SEO/error pages (docs/149~154)
- [x] Phase 10 UI·반응형·접근성 최종 · header/Hero · check:responsive · docs/155~158
- [x] Staging 격리 · `product-images` private Storage · signed URL
- [x] `createAdminProduct` Staging HTTP E2E · slug 중복 차단 · 전성분/주요성분 · media 연결
- [x] service_role 최소 SELECT (`ingredient_aliases` · `product_offers` · `product_variants`)
- [x] 관리자 상세 로컬 Staging 조회 (`productId=3`, offers/variants 0 = 빈 상태)
- [x] **Preview Staging 확정 + `/admin/products/3` 브라우저 E2E** (완료 · 재요청 금지)
- [x] Windows Task Scheduler 인자를 고정 `run-pipeline.ps1`로 정렬 확인 (`KBeautyMatch-Pipeline`)
- [x] COSRX catalog JSON 3개를 첫 실제 검증 사례로 Staging 적용
- [ ] Supabase 제품/offer 반영 (**Production 승인 후**)
- [x] `data/backups` JSON 백업 (`data/backups/2026-07-14-catalog/`)

### 현재 단계 (2026-07-14)

- Staging catalog JSON 백업·검증: **완료**
- **다음:** Production/main 작업은 사용자 승인 후에만
- main 병합: **안 함** · Production 배포/DB: **안 함**

---

## 3. 다음 순서 (Search-to-Verified-Product Pipeline)

1. 파이프라인 데이터 모델 설계  
2. 검색 후보 저장 구조  
3. 판매 검증 상태  
4. 전성분 구조  
5. 논문 근거 DB — Staging 시드·정적 카탈로그·관리자 Evidence CRUD 연결 완료  
6. 관리자 검증 화면  
7. COSRX 3개를 첫 실제 검증 사례로 적용  
8. Supabase 반영  
9. JSON 백업  
10. GitHub push  

세부 개발 항목:

- 실제 제품 검색 계층  
- 판매 상태 검증  
- 전성분 수집  
- 성분 표준화  
- 논문 근거 연결 — 추천/결과 + `/admin/evidence` 완료 (Preview SSO 수동 확인 대기)  
- 중복 검사  
- 관리자 승인  
- Supabase 등록  
- 정기 재검증  

---

## 4. 이후 단계

- 실제 Anthropic / OpenAI / Ollama 연결
- 국가·언어·통화 고도화
- 사용자 계정과 분석 결과 DB 저장
- 3일·7일·15일·30일 안부 확인
- 관리자 권한·업로드 UI
- 사진 분석 (비전)
- 테스트·보안·배포
