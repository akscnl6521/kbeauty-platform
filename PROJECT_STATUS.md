# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-17

## 다음 작업 (단일 · 재개 지침)

**다음 작업:** 페이스 탐색 노출 Preview 배포.  
**방금 완료:** 헤더·홈·푸터에 `/face-explorer` 링크.  
**운영 메모:** 볼 수 없는 대시보드는 건너뜀 · Production 배포/DB는 명시 전 안 함.

### 2026-07-17 페이스 탐색 노출

| 항목 | 결과 |
|------|------|
| 내비 | 헤더·홈·푸터에 페이스 탐색 |
| Production | 미변경 |

### 2026-07-17 results ?tab= 도메인 탭 동기화

| 항목 | 결과 |
|------|------|
| UX | `?tab=makeup|hair` → 해당 탭 오픈 |
| URL | 탭 클릭 시 query 갱신 |
| push | `ac24ac4` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 성분 가이드 DB 목록

| 항목 | 결과 |
|------|------|
| UX | ingredients 테이블 목록 · 폴백 3개 |
| CTA | 문진 · 추천 결과 |
| push | `eb3ed2e` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 문진 도메인 전환 네비

| 항목 | 결과 |
|------|------|
| UX | 피부/마스카라/베이스/립/헤어 칩 |
| push | `4da9971` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 헤더/푸터 네비 보강

| 항목 | 결과 |
|------|------|
| 헤더 | 문진 · 분석 · 결과 · 성분 · 루틴 |
| 푸터 | 바로가기 + 법적 링크 분리 |
| push | `7528dbc` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 루틴←핵심 Top5 연결

| 항목 | 결과 |
|------|------|
| UX | Ranked Top5 우선 + 즐겨찾기 병합 |
| push | `d9fe3fa` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 빈 Top5·analyze CTA 안내

| 항목 | 결과 |
|------|------|
| UX | 빈 Top5 이유·CTA · 콜드 진입 문진 안내 |
| analyze | 「추천 결과 보기」 |
| push | `b53b4ee` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 홈 CTA·루틴 연결

| 항목 | 결과 |
|------|------|
| UX | `/quiz` CTA · 이어보기→결과/루틴 |
| push | `b2cbedf` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 결과 브랜드 칩 필터

| 항목 | 결과 |
|------|------|
| UX | 탐색 브랜드 칩 · 제형 칩과 교차 필터 |
| push | `13fc671` |
| Preview | READY |
| Production | 미변경 |

### 2026-07-17 결과 카테고리 칩 필터

| 항목 | 결과 |
|------|------|
| UX | 탐색 목록 제형 칩 (전체/세럼/토너…) |
| push | `4237fdc` |
| Preview | READY |
| INCI 승격 | **스킵** (Staging 운영 쓰기) |
| Production | 미변경 |

### 2026-07-17 문진→Top5 재랭킹 · V6

| 항목 | 결과 |
|------|------|
| 코드 | `buildQuizRecommendation` · results 재랭킹 |
| 캐시 | `KR_MATCH_EVIDENCE_V6` |
| push | `387767b` |
| Preview | READY |
| AI 경로 | `ai=1` 유지 |
| Production | 미변경 |

### 2026-07-17 Top5 브랜드 다양성 · Preview V5

| 항목 | 결과 |
|------|------|
| 코드 | `diversifyByBrand` · 브랜드당 max **2** |
| 캐시 | `KR_MATCH_EVIDENCE_V5` |
| push | `e62e556` |
| Preview | READY (`kbeauty-platform-p3pnilvig-…`) |
| Production | 미변경 |

### 2026-07-17 Preview 배포 · Top5 대체 확인

| 항목 | 결과 |
|------|------|
| push | `backup-sprint14-20260713` → origin (`6bf5e5c`) |
| Preview | `kbeauty-platform-peogpdicj-…` READY |
| Staging 적격 | **14** · 브랜드 **6** · 부적격 0 |
| Auth URL | **스킵** (대시보드) |
| Production | 미변경 |

### 2026-07-17 캐시 V4 · concern 분포

| 항목 | 결과 |
|------|------|
| 캐시 | `KR_MATCH_EVIDENCE_V4` |
| 적격 14 고민 태그 | dryness 6 · acne 4 · pores/pigmentation 3 … |
| Auth URL | **사용자 대시보드만** |

### 2026-07-17 skin_concern 보강 · Auth 표면 점검

| 항목 | 결과 |
|------|------|
| Staging concern 채움 | id **4·6·8·9** (banila 12는 비움 유지) |
| Auth 공개 경로 | `/login`·`/signup`·`/forgot-password`·`/admin/login` **200** · `/auth/callback` 307 |
| Auth URL allow-list | **사용자 대시보드 남음** |
| Production DB/배포 | 미변경 |

### 2026-07-17 Production env 대체 확인

| 항목 | 결과 |
|------|------|
| AI_PROVIDER | 존재 · **mock 아님** (health requiredConfigPresent) |
| NEXT_PUBLIC_SITE_URL / OPENAI | Production에 존재 |
| Auth URL | **사용자 확인 남음** |
| Production DB/배포 | 미변경 |

### 2026-07-17 Staging 최종 잠금 · Production 읽기 점검

| 항목 | 결과 |
|------|------|
| Production health | **200** · version `2b17f5f` · supabaseReachable |
| Staging `check:staging-quality` | 통과 · **krVerifiedOffers: 14** |
| `test:quality` | 통과 |
| 엄격 KR Top5 | **14** · 브랜드 **6** · 부적격 0 |
| 다양성 2차 | INCI BLOCKED로 승격 풀 없음 |
| Production DB/배포 | 미변경 |

### 2026-07-17 banila KRW offer

| 항목 | 결과 |
|------|------|
| PDP | banila.com `product_no=669` |
| 할인가·재고 | **14,000 KRW** · stock 4412 |
| 엄격 KR Top5 적격 | **14** · 브랜드 **6** |
| KR 부적격 | **0** |
| Production | 미변경 |

### 2026-07-17 KRW 공식몰 offer

| 항목 | 결과 |
|------|------|
| Anua / BoJ / ROUND LAB / Isntree | 20,000 / 17,000 / 13,500 / 15,400 KRW |
| banila | **14,000 KRW** (이후 완료) |
| 엄격 KR Top5 적격 | **13** → **14** · 브랜드 **6** |
| 올리브영 | 403 유지(공식몰로 대체) |
| Production | 미변경 |

### 2026-07-17 Isntree 판매확인

| 항목 | 결과 |
|------|------|
| 판매 URL | isntree-global.com … watery-sun-gel-50ml |
| 가격·재고 | USD **21.96** · in_stock |
| Staging 이미지 | **14/14 OK** |
| Preview Top5 적격 | **14** · 브랜드 **6** |
| 엄격 KR Top5 | COSRX 9 → 이후 KRW로 **13** |
| Production | 미변경 |

### 2026-07-17 Preview 대체 검증

| 항목 | 결과 |
|------|------|
| Staging 이미지 | **13/14** → 이후 Isntree로 **14/14** |
| Preview Top5 적격 | **13** → **14** · 브랜드 **6** |
| `test:quality` | 통과 |
| Preview SSO UI | 사용자 선택 확인 · 에이전트는 Staging 대체로 완료 처리 |
| 문서 | `docs/PRODUCTION_BATCH_REVIEW.md` |

### 2026-07-17 이미지·판매처 1차 + Preview offer 모드

| 항목 | 값 |
|------|-----|
| 이미지+verified offer | banila · Anua · BoJ · ROUND LAB |
| Isntree | deferred |
| Preview Top5 적격 | **13** / 브랜드 **5** |
| 엄격 KR Top5 | COSRX 9 (OY 403 · KRW 미확보) |
| Preview | https://kbeauty-platform-36kgekanz-akscnl6521s-projects.vercel.app |
| Production | 미변경 |

### 2026-07-16 고민별 추천 비교

| 항목 | 결과 |
|------|------|
| `test:quality` | 8고민 fingerprint **유일** |
| `check:staging-quality` | 통과 · KR verified offers **9** |
| Top5 적격 브랜드 | **COSRX만** |
| Top5 부적격 | banila · Anua · BoJ · ROUND LAB · Isntree (offer 미검증) |
| 스크립트 | `scripts/compare-staging-concern-recommendations.mjs` |

### 2026-07-16 Staging 다양성 1차 배치

| 항목 | 값 |
|------|-----|
| 공개 제품 | **14** (이전 9) |
| 공개 브랜드 | **6** — COSRX, banila co., Anua, Beauty of Joseon, ROUND LAB, Isntree |
| 신규 id | 12~16 |
| offer | unverified 스텁만 (가짜 가격 없음) |
| Production | 미변경 |

### 2026-07-16 추천 고정·카탈로그 조사

| 항목 | 결과 |
|------|------|
| Production 공개 추천 | **2** (COSRX 달팽이 96·92만) / 전체 191 · 브랜드 55 |
| Staging 공개 추천 | **9** / 전부 COSRX |
| mock | Production 차단 · 고정 체감의 주원인 아님 |
| 원인 | `active`∧`verified_at` 풀 과소 · 단일 브랜드 · concern 매핑 공란 |
| 문서 | `docs/RECOMMENDATION_DIVERSITY_FINDINGS.md` |
| Production 승인 | **보류** |

### 2026-07-16 Production 배포 완료

| 항목 | 값 |
|------|-----|
| 승인 | 「다음작업진행하자」 |
| deployment | `dpl_8cYYZ2wABiFwEDyTSqB8zLUa344g` |
| alias | https://www.kbeautymatch.com |
| health | **200** · `ok:true` · version `2b17f5f` · supabaseReachable |
| home | **200** |

### 2026-07-16 로컬 출시 준비 검사

| 항목 | 결과 |
|------|------|
| `check:production` | 통과 |
| `check:release-security` | 통과 |
| `test:smoke` | 통과 (18 routes) |
| `check:deployment-env` | non-production · Supabase 키 있음 · 로컬 `AI_PROVIDER`/`SITE_URL` 없음(이슈 0) |
| main / Production 배포 | **미실행** |

### 2026-07-16 Snail 96 이미지 복구 + Staging 9/9 검증

| 항목 | 값 |
|------|-----|
| 원인 | id=1 primary 이미지 **68B** 플레이스홀더 (E2E tiny PNG) |
| 조치 | 공식 `cosrx.com` 제품 이미지 재업로드 · `catalog_product_media` 갱신 |
| Snail 96 | `content_length` **26,610** · signed GET **200** |
| 공개 추천 9건 | verified primary media + signed fetch **9/9 OK** |
| 스크립트 | `scripts/fix-staging-snail96-official-image.mjs` · `scripts/verify-staging-public-product-images.mjs` |
| Production / main | 미변경 |

### 2026-07-16 A안 Production 반영 완료 (신규 5)

| id | slug | 성분 링크 |
|---:|------|----------:|
| 188 | cosrx-low-ph-good-morning-gel-cleanser | 27 |
| 189 | cosrx-aha-bha-clarifying-treatment-toner | 11 |
| 190 | cosrx-hydrium-watery-toner | 13 |
| 191 | cosrx-the-niacinamide-15-serum | 15 |
| 192 | cosrx-the-6-peptide-skin-booster-serum | 45 |

- 전원 `verified_at` **NULL** (자동 Verified 금지) · media/offer 없음  
- 스킵 유지: Vitamin C 23 · Snail 92 · Retinol 0.1  
- ingredients **112**

### 2026-07-16 Preview /results 이미지 수정

| 항목 | 값 |
|------|-----|
| 원인 | anon `catalog_product_media` 권한 없음 + signed URL 미재발급 |
| 수정 | `/api/catalog/product-images` · `resolveVerifiedProductImageUrls` · `fetchCandidateProducts` |
| 검증 | Staging 재서명 HEAD 5/5 · build 통과 · Preview READY |
| Preview | https://kbeauty-platform-i3uatyk1n-akscnl6521s-projects.vercel.app/results |

### 2026-07-16 A안 dry-run + 스모크 + 나머지 4건

| 항목 | 결과 |
|------|------|
| Production 신규 COSRX | **5** (id 188~192) |
| `verified_at` | 전부 NULL |
| 스킵(중복) | **3** (Vitamin C / Snail 92 / Retinol) |
| media | 미첨부 |

상세: `docs/RELEASE_KR_CATALOG_PRODUCTION_PLAN.md`

### 2026-07-16 Production launch blockers (읽기 전용)

| 항목 | 결과 |
|------|------|
| Supabase URL | Production ref **일치** |
| `AI_PROVIDER` / `SITE_URL` | Vercel에 Encrypted 키 **존재** · CLI pull은 빈 값으로 분류(민감변수 한계 가능) |
| 라이브 사이트 | `https://www.kbeautymatch.com/` **200** |
| Production DB | 스모크 1건 반영 (id 188) · 배포/main **미실행** |

### 2026-07-16 Preview SSO UI 검수 완료

| 항목 | 값 |
|------|-----|
| Preview URL | https://kbeauty-platform-jz7pabqnu-akscnl6521s-projects.vercel.app |
| 사용자 확인 | `/analyze`→`/results` · `/admin/catalog/labels` · bulk-review |
| Staging 대체 검증 | 이전 통과 유지 |
| Production / main | 미변경 |

### 2026-07-16 잔여 27건 BLOCKED (공식 INCI 미확보)

| 항목 | 값 |
|------|-----|
| OBF 1·2차 | searched 27 · harvested **0** |
| Banila Prime Primer | `banila.com` PDP에 전성분 고시 값 미노출 (리테일 목록은 사용 금지) |
| Isntree Green Tea Fresh Toner | 공식몰 고시 표 헤더만·값 공란 · 리테일 INCI 서로 불일치(iHerb≠SokoGlam) → invent 금지 |
| Staging | with_inci **57** · official_matched **58** · heroes **84** |
| Production / main | 미변경 |

**재개 조건(하나만 있으면 apply 가능):** 공식몰 Cosmetics Act 고시 텍스트 · DailyMed/공식 라벨 · 브랜드 EN PDP All ingredients · 패키징 사진(official_label)

**스킵 확정:** ETUDE 속눈썹 컬러(비화장품) · HERA UV Mist·Dr.Jart spray(단종) · espoir/HERA 립·peripera/rom&nd/3CE(쉐이드별 공식 INCI 없음) · innisfree body lotion(SKU 불명) · RYSES(브랜드 미확인) · CLIO Fingertip Gel(공식 SKU 미확인)

### 2026-07-16 TOCOBO Cotton Soft Sun Stick

| 항목 | 값 |
|------|-----|
| TOCOBO | Cotton Soft Sun Stick (`tocobo.co.kr` · Soft ≠ Airy) |
| Staging | with_inci **57** · official_matched **58** · recommendable **58** · evidence_linked **44** |
| Production / main | 미변경 |

### 2026-07-16 espoir Be Glow Cushion 3 shades

| 항목 | 값 |
|------|-----|
| espoir | Pro Tailor Be Glow Cushion Beige / Ivory / Petal (`espoir.com`) |
| Staging | with_inci **56** · official_matched **57** · recommendable **57** · evidence_linked **44** |
| Production / main | 미변경 |

### 2026-07-16 innisfree serum·SOME BY MI Miracle Toner

| 항목 | 값 |
|------|-----|
| innisfree | Green Tea Seed Hyaluronic Serum (`au.innisfree.com`) |
| SOME BY MI | AHA BHA PHA 30 Days Miracle Toner (`en.somebymi.com`) |
| Staging | with_inci **53** · official_matched **54** · recommendable **54** · evidence_linked **41** |
| Production / main | 미변경 |

### 2026-07-16 mise shampoo·goodal·ETUDE/CLIO/PERIPERA mascara

| 항목 | 값 |
|------|-----|
| mise en scène | Perfect Serum Shampoo Original (`hk.miseenscene.com`) |
| goodal | Vita C Dark Circle Eye Cream (`clubclio.shop`) |
| ETUDE / CLIO / PERIPERA | Curl Fix #01 · Kill Lash · Ink Black Cara |
| Staging | with_inci **51** · official_matched **52** · recommendable **52** · evidence_linked **39** |
| Production / main | 미변경 |

### 2026-07-16 mise en scène Perfect Serum Original

| 항목 | 값 |
|------|-----|
| mise en scène | Perfect Serum Original (`global.amoremall.com`) |
| Staging | with_inci **46** · official_matched **47** · recommendable **47** · evidence_linked **38** |
| Production / main | 미변경 |

### 2026-07-16 Sulwhasoo·COSRX Clear Fit Patch

| 항목 | 값 |
|------|-----|
| Sulwhasoo | First Care Activating Serum VI (`int.sulwhasoo.com`) |
| COSRX | Clear Fit Master Patch (`cosrx.com`) |
| Staging | with_inci **45** · official_matched **46** · recommendable **46** · evidence_linked **38** |
| Production / main | 미변경 |

### 2026-07-16 medicube·Dr.Jart Cicapair·MISSHA BB

| 항목 | 값 |
|------|-----|
| medicube | Zero Pore Pads (`medicube.us`) |
| Dr.Jart+ | Cicapair Tiger Grass Color Correcting Treatment (US DailyMed) |
| MISSHA | Perfect Cover BB NO.13 / 21 / 23 (US DailyMed) |
| Staging | with_inci **43** · official_matched **44** · recommendable **44** · evidence_linked **37** |
| Production / main | 미변경 |

### 2026-07-16 Lador Hydro LPP·Perfect Hair Fill-up

| 항목 | 값 |
|------|-----|
| Lador | Hydro LPP Treatment · Perfect Hair Fill-up (`en.lador.co.kr`) |
| Staging | with_inci **38** · official_matched **39** · recommendable **39** · evidence_linked **32** |
| Production / main | 미변경 |

### 2026-07-16 AMOREPACIFIC·Haruharu·Etude SoonJung

| 항목 | 값 |
|------|-----|
| AMOREPACIFIC | Time Response Skin Reserve Serum (`us.amorepacific.com`) |
| Haruharu | Black Rice Hyaluronic Toner (공식 PDP; fragrance-free SKU 아님) |
| ETUDE | SoonJung pH 6.5 Whip Cleanser (`int.etude.com`) |
| Staging | with_inci **36** · official_matched **37** · recommendable **37** · evidence_linked **31** |
| Production / main | 미변경 |

### 2026-07-16 heimish All Clean Balm

| 항목 | 값 |
|------|-----|
| heimish | All Clean Balm (`heimish.us` Skin-Loving Ingredients) |
| Staging | with_inci **33** · official_matched **33** · recommendable **33** · evidence_linked **29** |
| Production / main | 미변경 |

### 2026-07-16 SKIN1004 Hyalu-Cica Sun (DailyMed)

| 항목 | 값 |
|------|-----|
| SKIN1004 | Madagascar Centella Hyalu-Cica Water-Fit Sun Serum (US DailyMed actives+inactive) |
| Staging | with_inci **32** · official_matched **32** · recommendable **32** · evidence_linked **29** |
| 스킵 | TOCOBO Soft Stick ≠ DailyMed Cotton Airy · SOME BY MI/innisfree 공식 전성분 PDP 부재 |
| Production / main | 미변경 |

### 2026-07-16 mixsoon·Isntree 공식 INCI

| 항목 | 값 |
|------|-----|
| mixsoon | Bean Essence (`mixsoon.us`) |
| Isntree | Hyaluronic Acid Watery Sun (US DailyMed actives+inactive) |
| Staging | with_inci **31** · official_matched **31** · recommendable **31** · evidence_linked **28** |
| Production / main | 미변경 |

### 2026-07-16 numbuzin·PURITO sun·AXIS-Y sun 공식 INCI

| 항목 | 값 |
|------|-----|
| numbuzin | No.3 Skin Softening Serum (`us.numbuzin.com`) |
| PURITO | Daily Soft Touch Sunscreen |
| AXIS-Y | Complete No-Stress Physical Sunscreen |
| Staging (당시) | with_inci **29** · official_matched **29** · recommendable **29** · evidence_linked **27** |
| Production / main | 미변경 |

### 2026-07-16 SKIN1004·PURITO·Klairs·AXIS-Y 공식 INCI

| 항목 | 값 |
|------|-----|
| SKIN1004 | Madagascar Centella Ampoule |
| PURITO | Wonder Releaf Centella Serum Unscented |
| Klairs | Freshly Juiced Vitamin Drop |
| AXIS-Y | Dark Spot Correcting Glow Serum |
| Staging (당시) | with_inci **26** · official_matched **27** · recommendable **27** · evidence_linked **24** |
| Production / main | 미변경 |

### 2026-07-16 Beauty of Joseon·ROUND LAB 공식 INCI

| 항목 | 값 |
|------|-----|
| BoJ | Glow Serum · Relief Sun · Ginseng Essence Water (공식 CPNP 페이지) |
| ROUND LAB | 1025 Dokdo Toner · Birch Moisturizing Sunscreen (roundlab.com) |
| Staging (당시) | with_inci **22** · official_matched **23** · recommendable **23** · evidence_linked **21** |
| Production / main | 미변경 |

### 2026-07-16 Anua·Torriden US 공식 INCI

| 항목 | 값 |
|------|-----|
| Anua | Heartleaf 77 Toner · Niacinamide 10%+TXA 4% Serum (`anua.us`) |
| Torriden | DIVE-IN Serum (`torriden.us` Full Ingredient List) |
| Staging (당시) | with_inci **17** · official_matched **18** · recommendable **18** · evidence_linked **16** |
| 도구 | `scripts/harvest-shopify-inci-candidates.ts` (후보 추출) |
| Production / main | 미변경 |

### 2026-07-15 LANEIGE US 공식 INCI

| 항목 | 값 |
|------|-----|
| 소스 | us.laneige.com Cream Skin Toner & Moisturizer · Lip Sleeping Mask (BERRY) |
| Staging (당시) | with_inci **14** · official_matched **15** · recommendable **15** · evidence_linked **13** |
| Production / main | 미변경 |

### 2026-07-15 Banila·COSRX 라벨 Staging 적용

| 항목 | 값 |
|------|-----|
| 적용 | sheet 12/12 · Banila US PDP + sunscreen + propolis |
| Staging (당시) | heroes **84** · with_inci **12** · official_matched **13** · recommendable **13** · evidence_linked **11** |
| 보정 | curated apply 시 `match_class=official_matched` · `recommendable=true` |
| 명령 | `catalog:labels:upsert-heroes` · `catalog:labels --force` · `catalog:labels:status` |
| Production / main | 미변경 |

### 2026-07-15 Banila Clean It Zero Original 공식 INCI

| 항목 | 값 |
|------|-----|
| 소스 | [banilausa.com Clean It Zero Original](https://banilausa.com/products/clean-it-zero-cleansing-balm-original) Ingredients metafield (밤 SKU) |
| 시트 | `banila-co-clean-it-zero-original` · tokens **21** · `applyReady=true` |
| Staging | **적용 완료** · with_inci 포함 |
| Production / main | 미변경 |

### 2026-07-15 Banila 오매칭 제거 · Staging 이름 정리

| 항목 | 값 |
|------|-----|
| Banila | OBF 폼클렌저 INCI **삭제** (밤 SKU 오매칭) |
| Staging 이름 | garbled `product_name_en` **5건 → 0** (`catalog:fix-staging-names`) |
| status (당시) | heroes 82 · with_inci **9** · sheet applyReady 9 · emptyPending 1 |
| 명령 | `npm run catalog:labels:status` · `npm run catalog:fix-staging-names` |
| Production / main | 미변경 |

### 2026-07-15 Admin Labels 검수·적용

| 항목 | 값 |
|------|-----|
| UI | `/admin/catalog/labels` — 검수 대기/ready 필터 · 선택 적용 |
| API | `POST /api/admin/catalog/labels/apply` (preview/commit · Staging only) |
| 정책 | 시트 JSON은 Git SSOT · DB만 갱신 · applyReady=false 기본 skip |
| 명령 | `npm run test:labels-admin` |
| Production / main | 미변경 |

### 2026-07-15 Open Beauty Facts INCI 수확 채널

| 항목 | 값 |
|------|-----|
| 소스 | Open Beauty Facts (Staging `catalog_sources` approved open_data) |
| 대상 | ingredients 미확보 heroes **73** |
| 수확 | **1** (`banila-co-clean-it-zero-original` · nameSim 0.50 → **applyReady=false**) |
| Staging 적용 | **0** (폼클렌저≠오리지널 밤 오매칭 방지) |
| 가드 | 브랜드 매칭 · INCI 형태 · form conflict · sim≥0.55만 자동 apply |
| 명령 | `npm run catalog:labels:obf` |
| Production / main | 미변경 |

### 2026-07-15 라벨시트 히어로 확장

| 항목 | 값 |
|------|-----|
| upsert | COSRX seed 6 SKU → Staging heroes |
| with_inci | **9** (이전 3) |
| official_matched · recommendable · evidence_linked | **9** |
| heroes | **82** |
| 파서 수정 | `1,2-Hexanediol` 콤마 분리 방지 |
| 명령 | `npm run catalog:labels:sync` (= build → upsert-heroes → apply) |
| Production / main | 미변경 |

### 2026-07-15 공식 전성분 라벨시트 채널

| 항목 | 값 |
|------|-----|
| 시트 | `data/catalog/labels/official-inci-sheet.v1.json` (11 entries · applyReady 9) |
| Staging 적용 | 1차 3 → **확장 후 9** |
| with_inci | **9** · evidence_linked **9** |
| heroes | 82 · official_matched 9 · recommendable 9 |
| Admin | `/admin/catalog/labels` |
| 문서 | `docs/92-official-inci-label-sheet.md` |
| 명령 | `npm run catalog:labels:build` · `npm run catalog:labels:upsert-heroes` · `npm run catalog:labels` · `npm run test:labels` |
| Production / main | 미변경 |

### 2026-07-15 INCI/라벨 보강 스프린트

| 항목 | 값 |
|------|-----|
| 대상 | Staging heroes **76** (비-rejected) |
| 공식 PDP 매칭 | **3** (`official_matched` · COSRX 스네일 96/92 URL override + Purito sunscreen) |
| needs_review | **73** (429/404/JS렌더 · 일시 실패는 Staging 덮어쓰기 스킵) |
| 전성분 | **0** (라벨 `전성분`/`Ingredients`/`INCI` 추출기 추가 · 공개 HTML에 라벨 목록 부재 · 추측 저장 없음) |
| URL override | `officialUrlOverrides` — 검증된 COSRX 공식몰만 (오매핑 pad 제거) |
| 문진→결과 | `/results` 도메인 탭에 속성 예시 패널 (구매 검증 제품 아님) |
| Preview | https://kbeauty-platform-aaczm021m-akscnl6521s-projects.vercel.app |
| 명령 | `npm run catalog:inci` · `npm run test:enrichment` |
| Production / main | 미변경 |

### 2026-07-15 Discovery 보강 스프린트

| 항목 | 값 |
|------|-----|
| 플레이스홀더 제거 | **1085** (`rejected` / 추천 제외) |
| 공식 PDP 매칭 | 당시 **5** → 이후 INCI 패스로 **3** 재정리 |
| needs_review | 당시 **71** |
| 전성분 확보 | **0%** (공개 JSON-LD에 INCI 거의 없음 · 추측 저장 안 함) |
| 이미지 | Staging 비-rejected 중 remote URL 일부 · Storage 복제 없음 |
| 재개 지점 | **완료** (`resumeBrandId=null`) · 재실행 시 멱등 업데이트 |
| 문진 | `/quiz/mascara` `/quiz/lip` `/quiz/base` `/quiz/hair` |
| Admin | `/admin/catalog/bulk-review` 대량 예상/적용 (Staging only) |
| Preview | https://kbeauty-platform-7k9e5hhex-akscnl6521s-projects.vercel.app |
| Production / main | 미변경 |
| 명령 | `npm run catalog:enrich` · `npm run test:enrichment` |

### 2026-07-14 Full Beauty 플랫폼 스프린트

| 항목 | 값 |
|------|-----|
| 브랜드 | **35** (KR 공식 도메인 allowlist, live crawl OFF) |
| 제품 후보 | **1161** (known_hero/shade + category discovery) |
| Staging | discovery 1161 · staging `data_complete` 76 · `needs_review` 1085 |
| 확보율 | 이미지 6.5% · 전성분 0% · 판매처힌트 6.5% · Evidence 연결 1.9% |
| 원인 | live crawl/terms 미승인 → discovery placeholder 다수 · INCI 미파싱 |
| 추천 | 마스카라·립·베이스 undertone 랭커 · 두피/헤어 기존 랭커 selftest |
| Admin | `/admin/catalog/bulk-review` 대량 필터 검수 |
| UI | `/results` 도메인 탭 · 홈 카피 확장 |
| 테스트 | `npm run test:full-beauty` · `tsc` · `build` 통과 |
| Preview | https://kbeauty-platform-4mf5tlnjm-akscnl6521s-projects.vercel.app |
| 정책 | 공개 verified 자동 승격 없음 · 이미지 external_link_only · Production/main 미변경 |
| 명령 | `npm run catalog:full-beauty` · `npm run test:full-beauty` |

### 2026-07-14 Preview SSO 대체 검증 (Staging)

| 항목 | 값 |
|------|-----|
| 명령 | `npm run check:preview-substitute` |
| 방식 | linked Staging SQL 카탈로그 → Evidence/KR offer/랭킹 (`.env.local` 미사용) |
| 결과 | 8고민 fingerprint 유일 · probe 0 · counseling `expert_first` |
| Preview HTTP | `check:preview-quality` → **SSO_MANUAL_REQUIRED** |
| 주의 | 로컬 `.env.local`의 Supabase URL이 Production ref를 가리킬 수 있음 → 스크립트는 linked Staging만 사용 |
| Production / main | 미변경 |

### 2026-07-14 Preview 자동 스모크 (SSO 한도)

| 항목 | 값 |
|------|-----|
| Preview | https://kbeauty-platform-55z9iwaqj-akscnl6521s-projects.vercel.app · status Ready · target preview |
| 자동 | `check:preview-quality` → Deployment Protection으로 **SSO_MANUAL_REQUIRED** (bypass secret 없음) |
| 로컬·Staging | `test:quality` · `check:staging-quality` 통과 유지 |
| 수동 남음 | SSO 승인 → 8고민 results · `/admin/evidence` |
| Production / main | 미변경 |

### 2026-07-14 추천 품질 회귀 테스트

| 항목 | 값 |
|------|-----|
| 로컬 | `npm run test:quality` · 8고민 fingerprint 유일 · probe/미검수 실패 |
| 파이프라인 | `test:pipeline`에 quality regression 포함 |
| Staging | `npm run check:staging-quality` · 공개 probe 0 · PMID set 8개 상이 |
| Preview | https://kbeauty-platform-55z9iwaqj-akscnl6521s-projects.vercel.app |
| Production / main | 미변경 |

### 2026-07-14 Evidence Layer 2차 보강 (색소·주름·모공·UV·acne)

| 항목 | 값 |
|------|-----|
| 신규 concerns | pigmentation · antiaging · pores · uv |
| acne 보강 | salicylic-acid PMID `37941097` (기존 `17147561` 유지) |
| 주의 조건 | `concernGuidance` → precautions / ingredientsToAvoid |
| Staging | approved evidence **18** · PMID set 고민별 상이 |
| Preview | https://kbeauty-platform-jxdrqgj1a-akscnl6521s-projects.vercel.app |
| Production / main | 미변경 |

### 2026-07-14 Evidence Layer 2차

| 항목 | 값 |
|------|-----|
| Admin API | `GET/POST /api/admin/evidence`, `PATCH /api/admin/evidence/[id]` |
| Admin UI | `/admin/evidence` · 성분 상세 등록 폼 |
| 런타임 | `resolveApprovedEvidenceForConcerns` = Staging DB approved ∪ 정적 폴백 |
| Staging | concerns +acne · evidence approved 9 (PMID 17147561) |
| Preview | https://kbeauty-platform-36yxo76cr-akscnl6521s-projects.vercel.app |
| Production / main | 미변경 |

### 2026-07-14 Evidence Layer 연결

| 항목 | 값 |
|------|-----|
| 카탈로그 | `data/evidence/concern-ingredient-evidence.json` |
| 연동 | analyze + persistTopRanked → 증상→승인 근거 성분→한국 제품 매칭 |
| UI | 결과 가이드「증상 → 성분 공개 근거」·카드 PMID 링크 |
| Staging | concerns 3 · evidence approved 8 · Production 미변경 |

### 2026-07-14 Staging products 공개 SELECT 수정

| 항목 | 값 |
|------|-----|
| 증상 | Preview AI 분석 후 `permission denied for table products` |
| 원인 | anon/authenticated에 `products` SELECT 권한 없음 (RLS만 존재) |
| 조치 | Staging만 컬럼 단위 GRANT + RLS(`active=true` ∧ `verified_at IS NOT NULL`) · `data_confidence` 제외 |
| 검증 | anon REST 200·verified 5행 · `data_confidence` 401 · inactive 0행 · Production/main 미변경 |
| migration | `20260714070000_grant_anon_select_verified_active_products.sql` |

### 2026-07-14 출시 차단 4항 최종

| # | 항목 | 판정 |
|---|------|------|
| 1 | Production `AI_PROVIDER` | Encrypted 키 존재 · CLI pull 빈 값 분류 · 라이브 200 (Dashboard 값 확인은 선택) |
| 2 | 도메인 | **통과 경향** — `www` 200, apex→www 리다이렉트, 계정에 `kbeautymatch.com` |
| 3 | Auth Redirect | **미확인** (Supabase Dashboard 수동 확인 필요) |
| 4 | Preview SSO / 한국 제품 Production | Preview **완료** · A안 **dry-run 완료** · INSERT **대기(`스모크 실행`)** |
| 종합 | | Preview 통과 · A안 쓰기·main·배포는 **추가 실행 문구 후** |
| 커밋 | `e1734d1` 부근 · 브랜치 `backup-sprint14-20260713` · main/Production 쓰기 미실행 |

---

## 현재 컴퓨터 / 경로

| 항목 | 값 |
|------|-----|
| 현재 컴퓨터 | 보조컴퓨터 |
| 프로젝트 경로 | `C:\Users\조병선\Desktop\k뷰티사업\kbeauty-platform` |
| GitHub 저장소 | https://github.com/akscnl6521/kbeauty-platform.git |
| 현재 브랜치 | `backup-sprint14-20260713` |
| 최근 백업 커밋 | `c73c135d92149f1c67b2b4c8209b750850792a03` — Backup Sprint 14 local work before Supabase migration |
| 문서 복구 커밋 | `fd1840e` — Docs: Restore project governance and Sprint 14 status |
| main 최근 커밋 | `514f0f9` — Sprint 13: Add Korean catalog data templates and validation |
| Working tree | Phase 10 UI·반응형·접근성 최종 (backup 브랜치) |
| 빌드 | `test:pipeline` · `test:journey` · `check:production` · `check:deployment-env` · `check:release-security` · `test:smoke` · `build` |
| Pipeline ops | config v5 monitoring `allowProductAutoVerify` 등 · `/admin/pipeline/settings` |
| Scheduler | 고정 `run-pipeline-worker.mjs` (에이전트 미실행) |
| Draft 정책 | `products.active=false` → 게이트 통과 시 active+verified_at · publish 금지 |
| Operations | /admin/operations health/alerts · file-based dedupe |
| Offers | draft에도 verified offer 허용 · Top5는 active verified product만 |
| Care | Supabase 영속화 · `/api/care/*` · `/my` 로그인 필수 · 익명→attach |
| Customer auth | `/login` `/signup` `/forgot-password` `/reset-password` `/logout` `/onboarding` |
| Journey | SiteHeader · 상태 머신 · `test:journey` · `check:production` |
| Release prep | `/api/health` · 환경/보안/스모크 점검 · CSP/SEO/error pages · docs/149~154 |
| UI final | header/Hero offset · a11y nav/forms · `check:responsive` · docs/155~158 |

## 제품 데이터 전략

- Search-to-Verified + **Autonomous Catalog Pipeline** (`docs/69`~`79`)
- 사람이 모든 URL을 등록하지 않음 · needs_review만 검토
- 자동 `published` 금지 · verified offer 없으면 제품 활성화 불가 · Top5 패딩 금지
- 기존 verified 제품 자동 강등 금지 (stale offer → eligibility만 false)
- 공식 API는 선택적 보조 수단 (필수 아님)
- 이중 저장(GitHub + Supabase) 원칙 유지

## Supabase

| 항목 | 값 |
|------|-----|
| Project ref | `rhfrmvkjsummaylpzmns` |
| MCP | 연결 가능 (쓰기 전 사용자 승인) |
| 원격 테이블 | `products` 186 / `ingredients` 40 / `profiles` 1 / `invite_codes` 3 / `product_offers` **0행** |
| Search-to-Verified | 11테이블 적용 완료 (`20260713034442`) |
| 관리자 인증 테이블 | `admin_users` / `admin_role_history` (`20260713041018`), 첫 admin bootstrap 완료 |
| `product_offers` | **적용 완료** (migration `20260713022607` / `create_product_offers_and_catalog_extensions`) |
| RLS | verified + in_stock + active 만 클라이언트 SELECT |
| `products.id` | `bigint` (IDENTITY ALWAYS) |

## 로컬 제품 데이터

| 항목 | 값 |
|------|-----|
| COSRX 제품 | 3개 (`data/catalog/kr/cosrx-products.json`) — 첫 검증 사례 후보 |
| COSRX offer | 3개 (`data/catalog/kr/cosrx-offers.json`) |
| offer 상태 | `unverified` / `unknown` / `verifiedAt=null` / `active=true` |
| 가격 | 23,000 / 23,000 / 24,000 KRW |
| 핵심 추천 포함 | **불가** (검증·published 전) |
| 원격 중복 매핑 | Snail 96→기존 id=4, Snail 92→기존 id=28, Pad→신규 필요 (쓰기 전 계획만) |
| `data/backups` | **미생성** |

## 실행 가능한 페이지

| 경로 | 역할 |
|------|------|
| `/` | 메인 |
| `/analyze` | AI 피부 분석 (사진·수동·Mock) |
| `/results` | 분석 가이드 + Top 5 + 제품 탐색 |
| `/quiz` | 설문 |
| `/routine` | 루틴 |
| `/face-explorer` | 얼굴 영역 탐색 |
| `/ingredients/[slug]` | 성분 상세 |
| `/admin` | 관리자 대시보드 (읽기 전용 count) |
| `/admin/products` | 제품 목록 (읽기 전용 · 검색/필터/페이지) |
| `/admin/products/[id]` | 제품 상세 (읽기 전용) |
| `/admin/discovery` | 발견 후보 목록 (읽기 전용) |
| `/admin/discovery/import` | URL/CSV 빠른 후보 등록 |
| `/admin/discovery/new` | 제품 후보 수동 등록 (쓰기) |
| `/admin/discovery/[id]` | 발견 후보 상세 + 제한 쓰기 |
| `/admin/ingredients` | 성분 목록 (읽기 전용) |
| `/admin/ingredients/[id]` | 성분 상세 (읽기 전용) |
| `/admin/verification` | 검증 큐 목록 (읽기 전용) |
| `/admin/verification/[id]` | 검증 큐 상세 (읽기 전용) |
| `/admin/login` | 관리자 이메일/비밀번호 로그인 |
| `/admin/forgot-password` | 관리자 비밀번호 재설정 메일 요청 |
| `/admin/reset-password` | 메일 링크 후 새 비밀번호 설정 |
| `/auth/callback` | 복구: `verifyOtp(recovery)` + PKCE `code` fallback |
| `/admin/pipeline` | 자율 카탈로그 파이프라인 콘솔 (dry_run/commit) |
| `/admin/pipeline/batches/[id]` | 배치·job 진행 |
| `/admin/brands` | 브랜드 seed 목록 (products/brands 자동) |
| `/admin/brands/[id]` | 브랜드 seed 상세 |
| `/admin/forbidden` | 비관리자 안내 |
| `/admin/unavailable` | 서버 설정 누락 안내 |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/logout` | 일반 사용자 인증 |
| `/onboarding` | 케어 온보딩 |
| `/auth/link-local` | 익명 기록 → 계정 연결 |
| `/my` | 개인 케어 홈 (로그인 필수) |
| `/my/analyses` · `/my/routine` · `/my/check-ins` · `/my/progress` | 케어 하위 |
| `/my/recommendations` · `/my/settings` | 추천·알림 설정 |
| `/admin/care` | Care 운영 집계 (PII 비노출) |
| `/privacy`, `/terms` | 약관 |
| `/api/analyze` | 서버 AI 분석 API |
| `/api/admin/care` | Care 익명 집계 API |
| `/api/admin/auth-check` | 관리자 세션 테스트 (GET) |
| `/api/admin/dashboard` | 관리자 대시보드 count (GET, 읽기 전용) |
| `/api/admin/products` | 관리자 제품 목록 (GET, 읽기 전용) |
| `/api/admin/products/[id]` | 관리자 제품 상세 (GET, 읽기 전용) |
| `/api/admin/discovery` | 관리자 discovery 목록 (GET, 읽기 전용) |
| `/api/admin/discovery/[id]` | 관리자 discovery 상세 (GET, 읽기 전용) |
| `/api/admin/ingredients` | 관리자 성분 목록 (GET, 읽기 전용) |
| `/api/admin/ingredients/[id]` | 관리자 성분 상세 (GET, 읽기 전용) |
| `/api/admin/verification` | 관리자 검증 큐 목록 (GET, 읽기 전용) |
| `/api/admin/verification/[id]` | 관리자 검증 큐 상세 (GET, 읽기 전용) |

## 현재 주요 기능

- 피부 분석 (Mock AI 포함)
- 추천 결과 (핵심 Top 5 + 둘러보기)
- 알레르기·회피 성분 안전 필터
- 현재 제품 등록
- 루틴 점검
- 브랜드명 표준화
- 한국 offer 구조·적격 필터
- 관리자 catalog review
- 한국 카탈로그 템플릿·검증 유틸

## 현재 문제

1. Supabase Reset Password 이메일 템플릿을 token_hash URL로 **수동 변경 필요**
2. Redirect URLs에 `http://localhost:3000/auth/callback` 유지 필요
3. 로컬 `SUPABASE_SERVICE_ROLE_KEY` **missing** 가능 → 관리자 영역 E2E 차단
4. COSRX 로컬 데이터는 등록됐으나 Supabase 미반영
5. `data/backups` 폴더 미생성
6. 실제 AI 공급자 연결 미완
7. 관리자 쓰기 콘솔 1차 완료 (discovery/verification). offers 자동생성·대량수정·DELETE 미지원

## 다음 작업

**최우선 (지금):** `docs/NEXT_TASK_PREVIEW_VALIDATION.md` — Preview Staging 확정 · 재배포 · `/admin/products/3` 브라우저 E2E

이후 (Preview 검증 완료·별도 승인 후):

1. Supabase Auth 이메일 템플릿·Redirect URL에 `/auth/callback` 확인 (사용자)
2. 일반 사용자 가입→온보딩→/my E2E (사용자)
3. 운영 UI에서 실제 후보 1건 E2E (사용자)
4. main 병합은 별도 승인 후
5. Production 배포는 별도 승인 후
6. 테스트 제품 `productId=3` 삭제 여부 (Preview 검증 완료 후 승인)

## 참고 문서

- `docs/NEXT_TASK_PREVIEW_VALIDATION.md` — **다음 단일 작업 실행 지침**
- `.cursor/rules/kbeauty-resume.mdc` — 재개 규칙
- `docs/138`~`docs/142` — 고객 인증·온보딩·연결·E2E·설정
- `docs/133`~`docs/137` — Care DB/RLS/연결/worker/retention
- `docs/123`~`docs/130` — Continuous Care 정책
- `docs/131` / `docs/132` — migration 상태 포인터 / rollback
- `docs/43`~`docs/65` — 관리자 인증·읽기·쓰기 콘솔
- `docs/29-korean-product-data-guide.md` — 한국 데이터 입력
- `docs/30-github-supabase-backup.md` — 백업 연동
