# CHANGELOG.md — K-Beauty Match

형식: 최신 항목이 위.

---

## 2026-07-30 전성분 오염을 게이트에서 차단 + 라이브 알레르겐 빈틈 해소 (배포 대기)

추천 풀 제품 중 전성분 검증 통과 **15/17 → 17/17**.

**안전**

- **feat(safety)**: `validateIngredientList.ts` — 전성분이 실제 INCI 목록인지
  판정한다. 전성분은 알레르겐 필터의 입력이라, 페이지 문구가 섞이면 «안전» 판정
  자체가 근거를 잃는다. HTML 엔티티·해시태그·연도·URL·물음표, INCI 에 없는
  기능어(`from`·`to`·`of`)로 문장을 판별한다. 의심스러우면 반려한다.
- **feat(safety)**: 활성화 게이트에 `ingredientsTextValid` 추가 →
  `official_ingredients_text_invalid` 블로커. **오염된 전성분을 가진 제품은
  활성화될 수 없다.** 활성화·재활성화 두 경로 모두. 데이터 정리로는 재발을 막지
  못한다는 것이 두 번(07-29·07-30) 확인됐다.
- **fix(safety)**: 추천 풀 2건(COSRX 스네일 96 에센스 · 스네일 92 크림)의 전성분이
  비어 있어 알레르겐 검사가 `key_ingredients` 2개만 봤다. 향료 알레르기를 입력해도
  «알레르겐 없음» 이 됐다. 브랜드 글로벌 스토어에서 채웠다 (12개 · 22개).
- **fix(pipeline)**: 수집기 대상이 `verified_at IS NULL` 이었는데 추천 풀 조건은
  `verified_at IS NOT NULL` 이다. **정확히 라이브인 제품을 건너뛰어** 활성 제품의
  데이터 구멍이 구조적으로 안 메워졌다. «검증 안 됨 또는 전성분 비어 있음» 으로 고쳤다.

**데이터 (Production · 승인 받음)**

- 오염 전성분 10건을 정제된 값으로 교체 (검증 반려 17행 → 7행).
- 전성분 3건 보강 (id 4 · 28 · 76).
- id 1 (COSRX Centella Water Toner) 비활성화 — 전성분 전체가 자바스크립트 배열이라
  교체가 불가능했다. 오염된 값은 추적 근거로 남겼다. NULL 로 만들면 안전 필터가
  `key_ingredients` 만 보게 되어 더 위험하다.
- 백업 3건: `production_20260730_145720_*` · `_145830_*` · `_152254_*`.

**정정**

- 최초 보고에서 `active = true` 를 «사용자 노출 중» 으로 읽어 17건을 노출 위험으로
  보고했는데 **틀렸다.** 추천 풀은 `active = true AND verified_at IS NOT NULL` 이고,
  Production 은 191행 중 190행이 `active = true` 다. 오염된 17건은 전부
  `verified_at` 이 비어 **풀에 없었다** — 오염된 전성분이 사용자 추천에 나간 적은 없다.
  감사 스크립트 판정 기준을 `isInRecommendationPool()` 로 통일했다.

**품질**

- `extractLabeledIngredients`: 구간 선택 시 첫 항목이 성분이 아니면 점수를 깎는다.
- 슬래시 동의어(`WAX / CERA / CIRE`)를 조각별로 판정 — 낱말 12개를 문장으로 오판했다.
- 무수 제형(페이셜 오일·파우더) 인정 — 물·글리세린이 없는 게 정상이다.
- `brandGlobalStores.ts` 로 브랜드 스토어 목록·제품명 대조를 단일 출처화.
- 신규 회귀: `test:ingredient-list-validate`(28) · `test:product-verify-gate`(12).
- CI 회귀 40개 전부 통과 · tsc·lint 무경고 · build 통과.

**미해결**

- 카탈로그 확대는 막혀 있다. 브랜드 스토어 11개를 더 붙였지만 매칭은 1건.
  전성분이 없거나 오염된 79건 중 채운 것은 3건뿐 — 나머지는 제품명 대조 미달이거나
  페이지에 전성분 구간이 없다. 스토어를 더 찾는 방식으로는 늘지 않는다.

---

## 2026-07-30 Production 카탈로그 복구 + 추천 안전 수정 (배포 대기)

Production 활성 제품 **2 → 17건** · 오퍼 2 → 38건 · 성분 사전 112 → 1,284행 ·
성분 링크 111 → 1,134건. 코드는 `feature/scalp-hair-track-20260727` 에 있고 미배포
(배포본 `355624d`, 92커밋 뒤처짐).

**안전**

- **fix(safety)**: 알레르기·회피 필터가 `full_ingredients` 까지 훑는다. 기존엔
  `key_ingredients`(기능성 성분 사전 부분집합)만 봐서 향료·리모넨·리날룰이 구조적으로
  안 잡혔다. 커버리지 향료 3→21/23 · 리모넨 0→14/14 · 리날룰 0→13/13. **랭킹 점수는
  무변경.**
- **feat(safety)**: `allergenMatch.ts` — 안전 필터 전용 매처. 기존 «부분 문자열 포함»
  을 전성분에 쓰면 `alcohol` 이 `cetearylalcohol` 에 포함돼 지방 알코올이 변성알코올로
  오탐된다(실측 15건, 87건 중 22건이 잘못 제외될 뻔). INCI 는 수식어가 머리명사 앞에
  오므로 **접두 관계**로 판정한다. `Ethylhexylglycerin` ≠ `Glycerin` 오탐도 해소.
- **feat(aliases)**: 향료 유래 표시 알레르겐 한글↔영문 17쌍. 전부 `ingredients`
  테이블(식약처)에서 확인한 쌍만.

**국가별 구매처**

- **fix(recommend)**: `persistTopRankedProducts` 가 `shippingCountry` 를 받아 두고도
  오퍼 필터에 항상 KR 을 넘겼다. 미국 사용자는 US 판매처가 있어도 «구매처 없음» 을
  봤다. `normalizeShippingCountry(...) ?? KR` — 한국 사용자 동작은 그대로.

**카탈로그 파이프라인**

- **fix(pipeline)**: 활성화 시 `key_ingredients` 를 함께 채운다. 수집기가 채우지 않아
  활성 106건 중 60건이 추천에서 통째로 제외되고 있었다.
- **fix(catalog)**: 전성분 추출기 오염 — 「가장 긴 후보 선택」·8000자 창·느슨한 통과
  조건이 네비게이션·판촉 문구를 성분으로 잡았다. 선두(`&times; Full Ingredients` ·
  `List:`)·꼬리(`DETAILS`) UI 잡음도 제거. 실제로 들어갔던 오염 문구 5종을 selftest 에
  고정.
- **fix(ingredients)**: 사전 부연 괄호 매칭(`Panthenol (Vitamin B5)` ↔ `Panthenol`,
  판테놀 14회·나이아신아마이드 9회가 이렇게 빠졌다) · INCI 슬래시 동의어
  (`Aqua/Water/Eau`, 조각 전부가 사전에 있을 때만) · **PostgREST 1000행 절단**(사전이
  1,242행이 되자 새 성분이 조회에서 빠져 활성화가 멈췄다).
- **fix(catalog)**: 성분 링크 순번 충돌·중복 · 게이트 미매칭 수 계산 오류 · 링크 재생성.
- **fix(recommend)**: 얼굴 트랙 밖 제품(향수·핸드크림·바디) 추천 풀 제외. 제품은 내리지
  않아 트랙 B 착수 시 그대로 쓸 수 있다.
- **config(pipeline)**: 활성화 허용 등급에 `C` 추가(사람 승인). 9개 차원 중 8개가 상수
  (합 4.9)라 등급 B 는 confidence 1.0 에서만 나온다 — 자동 추출에서 그 값을 넣는 것은
  게이트를 속이는 것이라 하지 않았다.

**data(production)**

- 브랜드 정정 4건(SKIN1004 → COSRX, cosrx.com·skin1004.com 전수 대조) · 오퍼 38건 ·
  전성분 24건 · 성분 사전 1,172행 추가(Staging 1,103 + 식약처 69) · 성분 링크 1,134건.
  **모든 변경 전 백업**(`backups/production_*.sql`). 작업 중 두 번의 실수를 백업으로
  복구했다.

**검증**: 타입체크 · `npm run build` · 회귀 11종 · 추천 selftest 4종 통과. Production
시나리오 4종 실측 Top 5 정상.

**미해결**: 배포 대기(구매 링크가 안 뜨는 상태) · 브랜드 쏠림(17건 중 COSRX 10) ·
수집 대상 9건 페이지 문구 오염 · `availability_status` 마이그레이션 미적용.

## 2026-07-27 얼굴 트랙 밖 8건 추천 풀 제외 + Production 감사 SQL

- **fix(recommend)**: `isOutsideFaceTrack()` 신설 — 향수·핸드크림·바디 제품을 얼굴 추천 후보 풀에서 뺀다. 제품을 내리지 않고(카탈로그·`active` 무변경) 풀에서만 제외해, 트랙 B 착수 시 그대로 쓸 수 있게 했다. `fetchCandidateProducts` 와 `results/page.tsx` 두 경로에 적용. 추천 풀 106 → 98건. `category` 가 비면 빼지 않고, 두피·모발 카테고리는 단계 5.5 설계와 충돌하지 않도록 건드리지 않는다(`test:face-track-filter` 가 고정).
- **chore(audit)**: `data/production-audit/2026-07-27-allergen-exposure-READONLY.sql` — Production 알레르겐 노출 감사용 SELECT 전용 SQL 4개. 사람이 Dashboard 에서 실행. 주석 밖 쓰기 구문 0건 기계 검증.
- **check**: `check:allergen-audit-sql-validate` — SQL 판정 규칙을 TS 로 재현해 Staging 에서 운영 코드와 대조(28 = 28, 불일치 0). 이 과정에서 SQL 버그 2개 수정: 숫자 미제거, 길이 하한 4자를 정확 일치에도 적용해 «향료»·«리모넨» 이 잘리던 것.

## 2026-07-27 category 채우기 (43/44) + 알레르겐 노출 최종 감사

- **data(staging)**: 활성 제품 43건에 `category` 채움 — mask 15 · cream 9 · foam_cleanser 3 · serum 3 · perfume 3 · hand_cream 3 · toner 2 · sunscreen 1 · body_lotion 1 · body_wash 1 · cleanser 1 · eye_patch 1. 근거는 제품명의 유형 표기이고, 표기가 없는 3건은 브랜드 공식 페이지·카테고리 목록에서 확인했다. 감사 로그 `product_category_filled` 에 근거 문구 기록, 되돌리기 백업 `data/backups/2026-07-27/product-category-before-fill.json`.
- **미채움 1건**: 242 아로마티카 수딩 알로에 베라 젤 — 제품명·원문 어디에도 유형 표기 없음, 사용방법이 «얼굴과 몸 전체에». `verification_queue` 에 `product_category_unknown` 등록.
- **발견**: 얼굴 트랙 밖 제품 8건(향수 3 · 핸드크림 3 · 바디 2)이 얼굴 고민 시나리오의 추천 후보 풀에 들어 있다. §29 MVP 범위 밖 — 카테고리는 채웠고 풀에서 뺄지는 미결.
- **audit**: `check:allergen-exposure-audit` 신설. 옛 필터가 놓쳐 노출될 수 있었던 제품 **28건**(향료 18 · 리모넨 14 · 리날룰 13 …) — 이번 수정으로 전부 걸러진다. 여전히 매칭 안 되는 4건은 별개 성분(`Hexyl Cinnamal`≠`Cinnamal` 3건, `Capryloyl Salicylic Acid`≠`Salicylic Acid` 1건)이라 누락이 아니다. **Staging 한정** — Production 자격증명이 세션에 없어 미확인.

## 2026-07-27 알레르기·회피 필터를 전성분 전체로 확장

- **fix(safety)**: `filterCandidatesBySafety` 가 알레르겐을 `full_ingredients` 까지 훑는다. 기존엔 `key_ingredients`(기능성 성분 사전으로 골라낸 부분집합)만 봐서 향료·리모넨·리날룰이 구조적으로 안 잡혔다. **랭킹 점수는 무변경** — `key_ingredients` 만 쓴다. 추천 풀 자격(`incomplete_info`) 기준도 무변경.
- **feat(safety)**: `allergenMatch.ts` — 안전 필터 전용 매처. 기존 «부분 문자열 포함» 을 전성분에 그대로 쓰면 `alcohol` 이 `cetearylalcohol` 에 포함돼 지방 알코올이 변성알코올로 오탐된다(실측 15건, 87건 중 22건이 잘못 제외될 뻔). INCI 는 수식어가 머리명사 앞에 오므로 **접두 관계**로 판정한다. `Ethylhexylglycerin` ≠ `Glycerin` 오탐 2건도 같이 해소. 랭킹이 쓰는 `findMatchByCanonical` 은 건드리지 않음.
- **feat(aliases)**: 향료 유래 표시 알레르겐 한글↔영문 17쌍 추가(리모넨↔Limonene 등). 전부 `ingredients` 테이블(식약처 원료성분정보)에서 확인한 쌍만 넣었고, 확인 안 된 4개는 넣지 않았다.
- **커버리지(활성 106건 중 성분정보 있는 87건)**: 향료 3→21/23 · 변성알코올 2→3/3 · 리모넨 0→14/14 · 리날룰 0→13/13. 남은 2건은 §35.7 파서 잔여물(광고 문구가 성분 토큰에 붙음) — 대기열.
- **회귀**: 제외 집합 단조 증가(dry-run 회귀 0건), 근거가 원문에 없는 제외 0건. `npm run test:allergen-full-ingredients` 신설(한글↔영문 17쌍 양방향 + 오탐 4종 포함).
- **도구**: `check:allergen-expansion-dryrun` — 코드 변경 없이 세 방식(현재 / 전성분+포함 / 전성분+접두) 영향 비교.

## 2026-07-27 추천 품질 검증 — key_ingredients 미채움 수정 · 알레르겐 커버리지 결함 보고

- **fix(pipeline)**: `product-activate.ts` 가 활성화 시 `key_ingredients` 를 함께 채운다. 추천·안전 필터는 `key_ingredients` 만 읽는데 수집기는 `full_ingredients` 만 채워서, 수집된 제품이 활성화돼도 매 시나리오에서 `incomplete_info` 로 제외되고 있었다(활성 106건 중 60건).
- **feat(catalog)**: `deriveKeyIngredientsFromFullList` 신설 — 사전에 있으면서 동시에 그 제품 전성분에 등장하는 토큰만, 전성분 원문 표기 그대로 반환한다. 선언 순서 유지·중복 제거. 자체 검증 `npm run test:key-ingredients-derive`.
- **data(staging)**: 백필 41건(abib 40 · Round Lab 1). 성분 없는 활성 제품 60 → 19건(전부 아도르 헤어 + 아로마티카 — 사전 미매칭이라 손대지 않음). 감사 로그 `product_key_ingredients_backfilled`, 되돌리기 백업 `data/backups/2026-07-27/`.
- **검증 도구**: `npm run check:recommendation-scenarios` — §29 KR 코어 시나리오 6종의 Top 5 + 매칭 근거, 알레르기 필터 정합성(근거 없는 제외·새어나간 제품 양방향), 신규 브랜드별 필터 동작, 알레르겐 커버리지. 읽기 전용.
- **미수정(승인 필요)**: 안전 필터가 `key_ingredients` 만 봐서 향료 함유 40건 중 3건, 리모넨 19건 중 0건, 리날룰 18건 중 0건만 걸러진다. 안전 필터 변경은 명시적 승인 대상이라 측정만 함.
- **대기열**: 활성 44건(abib 43 · 아로마티카 1)의 `category` 미채움 — 시나리오 카테고리 매칭 불가.

## 2026-07-26 Master Plan v4.3 — 두피·모발 트랙 편입

- **docs(master-plan)**: v4.2 → **v4.3**. 기존 §1~§46 삭제·축약 없이 추가·명확화만 수행(diff: +90 / −7, 삭제 7줄은 전부 제목·버전 줄의 치환분).
- **§44**: 단계 1~4에 `[얼굴 MVP]` 태그 · 단계 4 완료를 MVP 런칭 시점으로 확정 · **단계 5.5 두피·모발 트랙(확장 A) 신설** · **단계 6.5 카테고리 확장 트랙 B 신설** · 단계 6을 "얼굴 + 두피·모발 전문의 포함"으로 확장.
- **§14**: 두피·모발 특별 규칙 추가(탈모 C/D/E 분기, '치료' 표현 금지, 기능성과 치료의 구분, 지루성 두피염·원형탈모·급격한 탈모 D/E, 두피 상처·감염·통증 E).
- **§29**: MVP는 얼굴 트랙만 포함함을 명시.
- **부록 A 신설**: v4.1 → v4.2(§22 촬영 확장·§32.1 신설) → v4.3 변경 이력 기록.
- `ROADMAP.md`에 트랙 구조와 신설 트랙 착수 조건 추가, `PROJECT_STATUS.md`에 결정사항 기록.

## 2026-07-26 관리자 로그인 루프 수정 + 정리 원칙 신설

- **fix(admin)**: `/admin/login`이 `redirect()`를 `try` 안에서 호출해 `catch`가 `NEXT_REDIRECT`를 삼키는 바람에 초당 3회 무한 재요청 → 흰 화면. `redirect()`를 `try` 밖으로 이동(`dfdbcca`, PR #35). main `355624d` 병합 → Vercel `mdnkflqc9` 배포. 배포 후 초당 0.09회로 정상화, 미로그인 `/admin`은 1회 리다이렉트 후 정지. 저장소 전체에서 같은 패턴은 이 파일 하나뿐이었음.
- **정정**: care attach "연결에 실패했습니다"는 service_role 키와 무관. 해당 경로는 `createSupabaseServerClient()`(anon + 사용자 세션)만 사용하며, care에서 service_role은 백그라운드 이메일 워커에서만 쓰인다.
- **docs**: `PROJECT_RULE.md` §10 SQL 실행 원칙, §11 작업 정리 원칙 신설.
- **chore(cleanup)**: 병합 완료 브랜치 원격 24개·로컬 1개 삭제(미병합 보존), 임시 env 파일 2개·scratchpad 10개 삭제, 로컬 `main` 최신화, `.env.local`에서 `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` 제거.
- 미완: `SUPABASE_ACCESS_TOKEN` 부재로 Supabase secret key 목록 조회·옛 키 삭제 미실행.

## 2026-07-26 병원 데이터 Production 이관 완료

- **이관**: Staging → Production `dermatology_institution_candidates` **1,917행**(verified 1,868 · discovered 49). 사람이 이번 작업에 한해 Production 쓰기를 승인, 병원 테이블 한정으로 실행. `products` 무영향(공개 191건 유지) 확인.
- **원인**: 앞선 4개 파트 붙여넣기가 실제로는 커밋되지 않았음(행 0건 · RLS 정상). 파트가 단일 트랜잭션이라 중간 오류 시 전체 롤백.
- **방식**: 동일 데이터·동일 순서·동일 500행 배치·`ON CONFLICT DO NOTHING`(=`resolution=ignore-duplicates`) REST INSERT. UPDATE/DELETE/DDL 없음, 재실행 안전. 1차 시도는 Vercel이 마스킹한 service_role placeholder로 401 → 0행 기록 후 즉시 중단.
- **검증**: 공개 anon 경로로 페이지와 동일 쿼리 실행 → 1,868건 노출, `/my/clinics` 목업 fallback 해제 조건 충족.

## 2026-07-26 병원 데이터 Production 검증 (읽기 전용)

- **검증**: 병원 SQL 4개 파트 적용 보고 후 Production `/my/clinics` 실검증 → **anon 조회 0건**, 목업 fallback 유지. 동일 쿼리를 Staging에 실행하면 1,868건 정상 → 코드·쿼리·정책 정의 문제 아님. 원인은 (1) 파트 미커밋 또는 (2) Production RLS 정책 부재 둘 중 하나로 좁혀짐.
- **추가**: `DASHBOARD.md` §26에 원인 확정용 SELECT 전용 진단 SQL(사람이 Production SQL Editor에서 실행) + 결과 해석 기준.
- **대조**: Staging↔Production `products` slug 대조(읽기 전용) — Staging 공개 27건 중 Production 미존재 21건, 그중 5건은 다른 slug로 이미 존재 → 실제 미존재 16건. Production 공개 카탈로그 191건으로 더 크고 slug 규칙이 달라 slug 기준 이관 시 중복 발생 위험 확인.
- Production DB 쓰기 없음 · INSERT 없음 · main 병합 없음.

## 2026-07-26 🚀 Production 출시

- **9단계 로드맵 완주 → Production 배포**: `https://www.kbeautymatch.com` 라이브(커밋 `9f293da`).
- **§23 전체 흐름 Production 실검증 통과**: health green, 핵심 경로 전부 200, 홈·퀴즈·결과 실렌더, 신규 `/api/track/click` 실동작 확인.
- **fix(vercel)**: `.vercelignore`가 빌드 시점 import되는 픽스처(`data/backups/2026-07-14-catalog/*.json`)를 제외해 Preview 빌드가 13h+ 연속 실패하던 것 수정 — `data/backups/*` 제외 + 해당 픽스처 디렉터리만 재포함(`92192f8`).
- **Production DB**: `dermatology_institution_candidates`, `commercial_click_events` 테이블 마이그레이션 적용(사람 실행).
- **이메일**: Production 실발송 차단 유지(환경변수 부재 + 코드 하드 차단).

## 2026-07-25 (오토파일럿)

- 3단계: discovery 검수 대기 후보 68건 재크롤 → draft product 40건 생성(실 성분/이미지/오퍼 연결). 활성화 0건 — Staging `ingredients` 사전 부족으로 게이트 미통과(원인 확인, 게이트 자체는 미변경).
- 6단계: `dermatology_institution_candidates` 신규 테이블 + migration 설계, HIRA 실 후보 1,917건 적재 스크립트 준비, `/my/clinics` 실데이터 조회 배선. migration 적용은 Dashboard 사람 실행 대기.
- 7단계: `commercial_click_events` 신규 테이블 + migration, `/api/track/click` 실 라우트로 클릭/전환 이벤트 배선(`validateClickConversionEvent`/`scrubEventForAnalytics` 재사용). migration 적용은 동일 사유로 대기.
- 백업 체계: `docs/autopilot/BACKUP_LOG.md` 신설, non-PII Staging row-count 스냅샷 스크립트(`scripts/snapshot-staging-summary.ts`) 추가.
- 부수 수정: CLI `server-only` 로더가 상대경로 import를 해석 못 하던 사각지대 수정(`register-server-only.mjs`/`resolve-server-only.mjs`).
- 확인된 차단 요인(전부 사람의 Dashboard 실행 필요): migration 2건 + `pipeline_batches` GRANT 1건. 8단계 실 스케줄러 설치 스크립트는 기존 준비되어 있으나 "에이전트 자동 실행 금지" 명시로 미실행.

## 2026-07-25

- 스캐폴드: 11단계 사용자 여정 화면 클릭 연결 완료 (`/onboarding` 언어·통화, `/routine/purchase`, `/routine/save`, `/my/clinics`, `/my/consultation-report`, `/quiz/body` 신규) — 완료 기준 12가지 미적용, 샘플 데이터 명시 표기.
- 스캐폴드 하위 기능 6개: 사용 영상 placeholder(`UsageVideoModal`), 광고/제휴 뱃지(`CommercialBadge`, 기본 off), 클릭 추적 stub(`trackScaffoldClick`), 마지막 확인일 표시, 알림·상담정보 전달 동의 체크박스.
- 마스터플랜 전수 점검(섹션 2~21·26·41) 및 갭 2건 처리: 전신 부위 문진(`/quiz/body`), `/results` 제품별 "추천하지 않는 제품" 사유 노출(`filterCandidatesBySafety` 확장, `loadRecommendation.ts` 필드 allowlist 누락 수정 포함). 나머지 5건은 로드맵 후반 보류.
- 통합 검증 1차: 모바일 375px 이상 없음 확인, 의료 단정 표현 1건 완화, 광고/제휴 disclosure 문구 명확화(`title` tooltip + 병원 카드 섹션 헤더).
- 버그 수정: WQ-F `looksLikeProductUrl`이 한국형 `.do?i_sProductcd=` URL 패턴을 인식 못 해 espoir 브랜드가 0건이던 문제 — 수정 후 실 제품 10건 Staging 등록.
- 데이터: HIRA 서울 피부과 실 라이브 수집 1,917/4,967건(로컬 아티팩트만, 미게시). Staging `product_discovery_candidates` 총 1,319건.
- 로그인 게이트 e2e 신설(`test:scaffold-journey-e2e`): 고객·관리자 계정 실 로그인 기반 4개 화면 렌더링 검증, `.env.local` 누락 값(공개 Supabase URL/anon key, service role key) 2건 발견·수정.
- 최종 회귀: 전체 `tsc`/`eslint`/`build` 통과, 기존 test suite 107건 중 104 통과 — 3건(`checkin-email-provider`/`resend`/`test-api`) 실패는 로컬 환경에 `SITE_URL` 미설정 때문으로 확인(오늘 변경과 무관, pre-existing).
- 상세 내역: `DASHBOARD.md`.

## 2026-07-24

### P3-T05 — Integrated Staging import package

- 계약: `stagingImportPackage` — 제품·병원 후보 · provenance · review states · duplicates · rejection reasons · refresh status · commercial separation · publishable gates · 통합 사람 검수 패키지
- 금지 강제: Staging import 미실행 · fixture 비공개 · Production/main 미터치 · 유료 레인으로 Staging 적격 부여 금지
- Selftest/러너: `test:staging-import-package` · `check:staging-import-package` (focused+integration 12건 · release-security · build) · 아티팩트 `artifacts/staging-import-package/`
- Docs: `docs/prelaunch/P3-T05_STAGING_IMPORT_PACKAGE.md`
- fixture/dry-run 통과 · 실 Staging import 승인·실행은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 live/사람 · Staging import 승인 (`external_only`)

### P3-T04 — Affiliate and sponsored revenue readiness

- 계약: `revenueReadiness` — affiliate offer ingestion · sponsored placement · clear disclosure · click/conversion events · country-specific purchase links · expiry · admin approval · analytics privacy · Organic·전문 라우팅 독립
- 금지 강제: 실 상업 계약 미활성화 · 수수료율·실 URL 미발명 · 건강/증상 광고 타기팅 금지 · Organic zone 스폰서 금지
- Selftest/러너: `test:revenue-readiness` · `check:revenue-readiness` · 아티팩트 `artifacts/revenue-readiness/`
- Docs: `docs/prelaunch/P3-T04_REVENUE_READINESS.md`
- fixture dry-run 통과 · 실제휴·수익 채널은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 live/사람 (`external_only`)

### P3-T03 — Automated refresh and exception operations

- 계약: `automatedRefresh` — 제품·병원 통합 due queue · stale(30/90·90/180) · retry/backoff · resume checkpoint · source-change diff · exception 우선순위 · audit · admin review manifest
- 스케줄러 준비: `refresh:product-daily`(매일 09:20 KST 힌트) · `refresh:clinic-twice-weekly`(월·목 09:40 KST 힌트) · 유료 인프라·Production 스케줄 미생성
- 금지 강제: 자동 게시·파괴적 DB 갱신 · `publishAllowed=false` · `destructiveUpdateAllowed=false`
- Selftest/러너: `test:automated-refresh-ops` · `check:automated-refresh-ops` · 아티팩트 `artifacts/automated-refresh-ops/`
- Docs: `docs/prelaunch/P3-T03_AUTOMATED_REFRESH_OPS.md`
- fixture dry-run 통과 · 실 live 운영·DB 반영은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 live/사람 (`external_only`)

### P3-T02 — Verified product pool and category expansion

- 계약: `verifiedProductPool` — skincare·makeup·hair/scalp·body·lip/eye · 카테고리 정규화 · 안전 적격 · 중복 병합 · 추천 준비 · 거절 사유 · 공개 Top 5(출처·전성분·이미지권리·구매offer) 게이트 · 기계 판독 audit
- 승인된 공식 매니페스트·비공개 dry-run만 · fixture/dry-run 공개 Top 5 빈 배열 · Production 쓰기 없음
- Selftest/러너: `test:verified-product-pool` · `check:verified-product-pool` · 아티팩트 `artifacts/verified-product-pool/`
- Docs: `docs/prelaunch/P3-T02_VERIFIED_PRODUCT_POOL.md`
- fixture dry-run 통과 · 실 live verified SKU·공개 게시는 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 live/사람 (`external_only`)

### P3-T01 — Official Korean product source onboarding

- 계약: `officialKoreanProductSource` — 브랜드 공식·공식 KR몰·공식 INCI · 이미지·variants·가격·재고·국가가용·사용가이드 · 필드 provenance · 재개 매니페스트 · deterministic dedupe · stale/refresh(30/90/180) · review reasons · dry-run audit
- 금지 강제: CAPTCHA/로그인/유료API/약관위험 · 미확인 필드 미발명 · fixture·미검증 비공개 · Production 쓰기 없음
- Selftest/러너: `test:official-kr-product-source` · `check:official-kr-product-source` · 아티팩트 `artifacts/official-kr-product-source/`
- Docs: `docs/prelaunch/P3-T01_OFFICIAL_KR_PRODUCT_SOURCE.md`
- fixture dry-run 통과 · 실 live·Staging import·publishable은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 live/사람 (`external_only`)

### T07-05 — Admin dry run and publishable gate

- 계약: `adminDryRunPublishableGate` — T07-02→T07-03→T07-04 오케스트레이션 · fixture/실패/스테일/충돌/근거부족 비공개 · 공식근거+관리자승인만 구조적 publishable · Organic·clinical fit 유료필드 독립 · JSON/CSV 상태·사유 집계 · 1회성 사람 작업(공식사이트 검수·Staging import)
- Selftest/러너: `test:admin-dry-run-publishable-gate` · `check:admin-dry-run-publishable-gate` · 아티팩트 `artifacts/admin-dry-run-publishable-gate/`
- Docs: `docs/prelaunch/T07-05_ADMIN_DRY_RUN_PUBLISHABLE_GATE.md`
- fixture dry-run 통과 · 실 live·Staging import·publishable 전환은 `external_only` · main·commit/push 미실행
- next_task `T07` 실 live 수집·사람 검수·Staging import (`external_only`)

### T07-04 — Official-site symptom evidence review bundle

- 계약: `symptomEvidenceReview` — 여드름·주사/홍조·아토피피부염·색소 · 매니페스트 전용 접수 · URL/제목/발췌/확인일/검수상태/만료일/거절사유 · Organic↔affiliate/sponsored 큐 분리 · 미검증 비게시 · 로그인/CAPTCHA/크롤 금지
- Selftest/러너: `test:symptom-evidence-review` · `check:symptom-evidence-review` · 아티팩트 `artifacts/symptom-evidence-review/`
- Docs: `docs/prelaunch/T07-04_SYMPTOM_EVIDENCE_REVIEW.md`
- fixture dry-run 통과 · 실 공식 페이지 검수·publishable은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 검수·publishable (`external_only`)

### T07-03 — Institution detail enrichment + specialist evidence

- 계약: `institutionDetailEnrichment` — 공식 기관상세 진료과목·전문의 수 · evidence strength · lastVerified · conflicting-source · retryable failure · manual-review · 피부과 근거↔증상 전문 주장 분리 · bounded concurrency · cache/checkpoint · dry-run
- 상호명만으로 피부과 추론 금지 · 미확인 null · 게시/Production 쓰기 없음
- Selftest/러너: `test:institution-detail-enrichment` · `check:institution-detail-enrichment` · 아티팩트 `artifacts/institution-detail-enrichment/`
- Docs: `docs/prelaunch/T07-03_INSTITUTION_DETAIL_ENRICHMENT.md`
- fixture dry-run 통과 · 실 live 보강·publishable은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 검수·publishable (`external_only`)

### T07-02 — Seoul dermatology candidate ingestion (HIRA)

- 계약: `seoulDermatologyIngestion` — 최소 공개 필드 · 서울/피부과 공식 필드 필터 · 필드 provenance · pagination checkpoint · deterministic dedupe · stale/refresh(90/180일) · dry-run audit
- T07-01 publicData 클라이언트 재사용 · serviceKey 미임베드 · 게시/Production 쓰기 없음
- Selftest/러너: `test:seoul-dermatology-ingestion` · `check:seoul-dermatology-ingestion` · 아티팩트 `artifacts/seoul-dermatology-ingestion/`
- Docs: `docs/prelaunch/T07-02_SEOUL_DERMATOLOGY_INGESTION.md`
- fixture dry-run 통과 · 실 live 수집·publishable은 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 검수·publishable (`external_only`)

### P2-T05 — Final Preview evidence and human approval package

- 계약: `phase2FinalEvidencePackage` — 6버킷(자동 테스트·스크린샷 육안·Android/iPhone·외부 출처·Dashboard·main/Production) · 1회성 사람 검증 절차 · 정직 플래그
- Selftest/러너: `test:phase2-final-evidence` · `check:phase2-final-evidence` · 아티팩트 `artifacts/phase2-final-evidence/`
- Docs: `docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md`
- Phase 2 필수 회귀 8건 통과(P2-T01~T04·T06·autopilot·security·build) · 육안/실기기/Dashboard/Production 위장 없음
- Preview·실기기·공식 출처·WQG-P0-002는 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

### P2-T04 — Real data onboarding readiness

- 계약: `realDataOnboarding` — 출처 매니페스트·필드 provenance·공식 우선순위·stale/refresh·검수 체크리스트·import 템플릿·dry-run·거절 사유 (KR 제품·병원/전문가)
- Selftest: `test:real-data-onboarding` · 비공개 fixture · dry-run 공식만 스테이징 검수 적격 · 마켓/유료API/CAPTCHA/발명 거절 · `writeAttempted=false`
- Docs: `docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md`
- 실공식 KR 제품·실병원 publishable·Staging/Production 쓰기는 `external_only` · main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

### P2-T03 — Admin review end-to-end verification

- 계약: `adminReviewE2E` — 제품·병원/전문가 레인 · candidate→evidence→duplicate→needs_review→admin_reviewed→publishable · 공개성 · Organic 독립
- Selftest: `test:admin-review-e2e` · fixture·미승인 비공개 · dry-run 공식만 publishable · `writeAttempted=false`
- Docs: `docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md`
- 회귀: usage-media-admin-ops · clinic-stage6 · commercial-separation · organic-commerce · 변경 ESLint · tsc — **통과**
- Preview 관리자 육안·공식 병원 실출처는 `external_only` · Staging/Production 쓰기·main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

### P2-T02 — Staging read-only release gates

- 계약: `stagingReleaseGate` — 환경 식별·헬스·테이블/계약·auth callback 입력·Storage 기대·게시 상태·migration · `verified` vs `dashboard_only_unknown`
- 러너: `check:staging-release-gate` (static 기본 · readonly SELECT/health 선택) · Production 차단 · 쓰기 없음
- Selftest: `test:staging-release-gate` · 아티팩트 `artifacts/staging-release-gate/`
- Docs: `docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md`
- Dashboard Redirect URL·care-photos 실버킷·적용 이력은 미검증 · Staging/Production 쓰기·main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

### P2-T01 — Automated Preview and route validation

- 계약: `previewRouteValidation` — 공개·analyze/results/routine·`/my` profile/guidance·admin review·auth API · viewport 320/390/768/1440 · loading/empty/error 마커
- 러너: `check:preview-routes` (static/http/browser) · 스크린샷+JSON 아티팩트 · `visualApprovalClaimed=false`
- 로컬 검증: static·HTTP·browser 스크린샷 40장(10×4 viewports) · `visualApprovalClaimed=false`
- Selftest: `test:preview-routes` · smoke 인프라 재사용 · Preview SSO 우회 금지 · Production 호스트 거부
- Docs: `docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md` · Preview 체크리스트 갱신
- 사람 Preview/실기기 육안은 `external_only` · Staging/Production·main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-23

### T06 — Final integration · release evidence

- 여정 연결 증거: `finalIntegrationEvidence` · `docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md`
- empty/loading/error a11y: `ProductUsageGuide` · `PhotoAssetsSettingsPanel`
- supabase browser/server: empty public env build placeholder (prerender throw 제거)
- landmark 자동촬영 기본 OFF · 수동 3각도 유지 · Phase 3.1 deferred
- Tests: `test:final-integration` · journey · master-execution · guided-capture/landmark · photo-comparison · symptom-safety · commercial-separation · content-disclosure · autopilot-queue · `check:release-security` · 변경 ESLint · tsc · `npm run build` — **통과**
- Preview/실기기/법무/공식 병원/WQG-P0-002 — **미검증** (`external_only`) · Staging/Production DB·main·commit/push 미실행
- next_task `T07` 공식 병원 실출처 (`external_only`)

### T05 — Usage media localization · admin operations

- 사용 가이드 메타: 도포량·순서·빈도·주의·패치 테스트·도포 영상 + fallback 상태 (`usageGuidanceComplete`)
- 국가·언어별 offer: 재고/가격/판매처 미발명 · 미확인 지역 빈 상태 · 미검증 URL CTA 제외 (`localizedOffers`)
- Admin ops: 후보 검수·중복 병합·근거 검토·상태 전환·만료 갱신 큐·재시도·감사 · local/Staging dry-run (in-memory)
- UI/API: `ProductUsageGuide` · `/admin/catalog/ops` · `/api/admin/catalog-ops`
- Docs: `docs/usage-media-localization-admin-ops.md`
- Tests: `test:usage-media-admin-ops` · `test:usage-media` · 변경 ESLint · tsc — **통과**
- Staging/Production DB 쓰기·main·commit/push 미실행 · next_task `T06` Final integration (완료)

### T04 — Organic commerce · professional routing

- Organic/Affiliate/Sponsored: 제휴 링크 데이터 구조 · Organic 전용 랭킹 · 광고 슬롯 안전 영역 · 스폰서 카드 · in-memory 지속화
- API: `/api/commerce/presentation` · `/api/commerce/events` · `/api/admin/commerce` · `/api/care/professional-guidance`
- UI 라벨: `CommerceLaneBadge` · `SponsoredCard` · 추천 카드 Organic 배지 · 병원 패널 레인 배지 · `/admin/commerce`
- 애널리틱스: click/lead/conversion/revenue · 건강·증상 타기팅 거부 (`health_targeting_forbidden`)
- 전문가 번들: 증상 라우팅 · 일반 vs 제휴 병원 분리 · fixture 게시 차단 · guidance 연결
- Docs: `docs/organic-commerce-professional-routing.md`
- Tests: `test:organic-commerce` · `test:commercial-separation` · `test:clinic-stage6` · `test:symptom-safety` · `test:care-guidance` · 변경 ESLint · tsc — **통과**
- 공식 병원 실출처·실제휴 게시·Production·main·commit/push 미실행 · next_task `T05` (Usage media localization · 완료)

### T03 — Product automation · category expansion

- Ingestion 계약 18단계 · 공식출처 evidence · 정규화 · variants · images · INCI · offers · usage media 메타
- dedupe · field verification · eligibility · review · refresh/resume · Staging/admin 링크(쓰기 없음 · autoPromote 금지)
- 마스카라·립·샴푸/두피 카테고리 추출 + 안전 추천(급성 눈·두피 신호 시 중단) · fixture dry-run
- Docs: `docs/catalog-product-automation.md` · 모듈 `src/lib/catalog/productAutomation/`
- Tests: `test:product-automation` · `test:full-beauty` · `test:master-execution` · 변경 ESLint · tsc — **통과**
- 실공식 live verify·verified 구매 SKU·Staging/Production 쓰기·main·commit/push 미실행 · next_task `T04` (공식 병원 실출처 · external_only)

### T02 — 3/7/15/30 follow-up lifecycle

- Opt-in · 스케줄 · due · 체크인 progress/adherence/irritation 결정 · 루틴 조정 · red-flag 에스컬레이션 · pause/resume
- 채널 배송 인터페이스 in_app/email/sms/push · dry-run / disabled / live_blocked · 상태 레코드 (`realDeliveryClaimed=false`)
- Persistence 재개 + 손상/누락 empty fallback
- `/my/settings` SMS·푸시 동의(실발송 미연결 고지) · `/admin/care/follow-up` + API
- Docs: `docs/follow-up-lifecycle.md`
- Tests: `test:follow-up-lifecycle` · 관련 checkin/reminder · 변경 ESLint · tsc — **통과**
- 실 email/SMS/push·Production·main·commit/push 미실행 · next_task `T03` product automation (완료)

### T01 — Core journey · durable BeautyProfile

- `parseBeautyProfile` / `mergeBeautyProfiles` / `sanitizeConfirmedProfilePatch` / `observationFromCheckIn`
- 체크인 완료 시 BeautyProfile에 자극·악화·중단·급성 신호 추론 누적
- 빈 목록이 확인값으로 고정되어 이후 추론 갱신을 막던 `mergeLists` 버그 수정
- 서버 경계 `GET/PUT /api/care/beauty-profile` (auth · 검증 · `migrationPending` 로컬 fallback)
- DRAFT: `supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql` (미적용 · RLS · DELETE 금지)
- `/my/profile` 로컬↔서버 병합 UX
- Tests: `test:beauty-profile` · `test:master-execution` · `test:journey` · 변경 ESLint · tsc — **통과**
- Staging/Production DB·main·commit/push 미실행 · next_task `T02` follow-up lifecycle

### T00 — Master audit · Autopilot 실행 계약/큐

- `docs/autopilot/EXECUTION_CONTRACT.md` · `docs/autopilot/MASTER_EXECUTION_QUEUE.md` 신설
- 검증 완료/부분/외부전용/잔여/보류 분류 · `next_task` 명시
- 레거시 `docs/MASTER_EXECUTION_QUEUE.md`를 canonical 포인터로 정리
- ROADMAP 사진 비교 `[x]`/`[ ]` 모순 수리 (코드 vs Staging `care-photos`)
- Self-test: `npm run test:autopilot-queue` · `scripts/autopilot-queue-selftest.ts`
- Production/main/DB 미변경 · commit/push 없음

### Stage 6 기반 — 병원 후보·안내 UI·상담 리드 dry-run + Preview 원격 검수 JSON

- 병원 후보 수집 어댑터(fixture/dry_run/live_blocked), 필드 검증·게시 게이트, 언어·예산 필터
- `/my/guidance`에 Organic/제휴 분리 병원 카드 + 상담 리드 최소동의 dry-run API 연결
- 관리자 `/admin/clinics` 읽기 전용 검수 · fixture 게시 불가
- Preview 원격 검수 JSON: `/api/public/unified-review-manifest` · `VERCEL_URL` 자동 · 로컬 fixture
- Docs: `docs/clinic-stage6-referral.md`
- Tests: `test:clinic-stage6` · `test:clinic-referral` · `test:unified-review-remote`
- 공식 병원 실데이터·실리드 전달·Preview 육안·Production 미실행 · commit/push 없음

### Master execution — 프로필 UI·전문가 라우팅 실연결·큐 완료

- `/my/profile`에서 장기 BeautyProfile 조회·확인값 편집 (확인값 > 추론값)
- 마스카라·립·베이스·헤어 도메인 문진 완료 시 BeautyProfile 누적
- `applySymptomSafetyToRecommendation`이 `routeProfessionalGuidance`를 호출해 `professionalRoutes`를 추천·`/my/guidance`에 표시
- 급성 신호 시 `productRecommendationAllowed=false`로 제품 추천 중단 명시
- `docs/MASTER_EXECUTION_QUEUE.md` 실행 큐 Q01–Q15·Q19 완료 · Q16–Q18 외부/승인 차단
- 빈 Supabase public env에서도 legacy client가 빌드 수집 단계에서 즉시 throw하지 않도록 placeholder 가드
- Tests: master-execution · symptom-safety · care-guidance · full-beauty · journey · commercial-separation · checkin-scheduling · 변경 ESLint · production build(Staging public env) — **통과**
- Preview/실기기/공식 병원·offer 실데이터/Production 미검증 · commit/push/main/Production 미실행

### Master execution — 장기 프로필·전체 taxonomy·안전 게이트

- 장기 `BeautyProfile`을 추가하고 기존 분석 세션 저장 시 국가/피부/민감도/고민/성분/톤을 교차 세션으로 누적
- 사용자 확인값과 추론값을 명시적으로 분리하고 확인값 우선 병합
- 공통 제품 모델에 규제 분류, 추천 적격, category attributes, variant/source/duplicate/reformulation, refresh와 상업 메타데이터 분리
- taxonomy에 beauty devices, oral/smile beauty, regulated wellness, professional products 추가
- 증상 기반 피부과·두피/탈모·알레르기·치과·응급 분기와 급성 신호 제품추천 중단 정책 추가
- Node 24/CJS에서 실행되지 않던 catalog autopilot self-test의 top-level await를 async entry로 수정
- `test:master-execution` 추가; 기존 full-beauty, journey, symptom safety, commercial separation, refresh, usage media, check-in 일정 회귀 통과
- DB migration·외부 API·Production·main 변경 없음

### WQG-P1-002 — 카메라·landmark 동적 로딩

- `GuidedCaptureFlow`의 `CameraCapturePanel` 런타임 정적 import를 `next/dynamic` 클라이언트 청크로 분리
- 카메라 선택 전 문진 기본 경로에서 MediaPipe landmark 구현을 실행하지 않으며, `ssr: false`로 브라우저 API 경계를 명확히 함
- 카메라 청크 로딩 중 `role="status"`·`aria-live="polite"` 준비 상태 제공
- 회귀 테스트에 동적 import, eager runtime import 부재, SSR-safe 접근성 fallback 검증 추가
- Tests: `test:guided-capture` · `test:guided-landmark` · TypeScript · 변경 파일 ESLint · production build — **통과**
- 전체 저장소 ESLint는 기존 범위 574건(64 errors, 510 warnings)으로 실패; 이번 변경 파일 lint는 통과
- Production/main/DB/Storage/환경변수 미변경 · Preview/실기기 육안 미실행

### WQG-P0-001 — 사진 AI 오인·동의·카피 정합

- 동의·진행·결과 문구를 실제 동작에 맞춤: **사진 픽셀 외부 AI 미전송**, 안내는 **문진·입력 기반**, 3장 촬영은 **품질·각도 표준화**
- `ANALYSIS_SCOPE_COPY_KO` 공용 카피 · PhotoConsentPanel / GuidedCaptureFlow / progress overlay / analyze·results·home
- 갤러리 잔존 「사진을 업로드한 뒤…」문구 제거(동 경로) · **WQG-P1-001도 함께 해소**
- vision AI 미도입 · Storage/DB/Production/main 미변경
- Tests: `npm run test:guided-capture` · `npm run test:photo-comparison` · `npm run test:symptom-safety` — **통과**
- **WQG-P0-002** → `RELEASE_GATE_PENDING` (Production 배포 직전 확인 · feature 중 미실행 · 키 미기록)
- 다음: P0-003 / P1-003·005 Preview·실기기 육안 검수

### WQ-G — Prelaunch gate (docs only)

- Created `docs/prelaunch/WQ-G_PRELAUNCH_GATE.md` (audit · no app/DB/Production changes)
- Verdict: **not launch-ready** — P0: photo-AI consent mismatch (pixels not sent to providers), Production `AI_PROVIDER` must be verified, copy must not claim multi-angle vision analysis
- Pilot A/B/C runtime OK · D/E insufficient honest · Phase 3.1 landmark remains deferred · default manual capture
- Next: WQG-P0-001 copy/consent alignment

### Phase 3.1 deferred — default manual 3-angle capture

- Status: implemented · automated tests passed · Android real-device blocker unresolved · **deferred** (not marked complete)
- `NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE` default **OFF** (explicit `1` only); voice countdown only when landmark auto is ON
- Default UX: Phase 3.0 manual guide + shutter (front → left45 → right45); no gallery; no landmark debug for normal users
- Auto landmark code/tests retained behind flag for later stabilization (Android Chrome + iPhone Safari)
- Next: WQ-G Prelaunch gate (prioritize P0–P3; no blind feature adds)

### Phase 3.1.4 — Fix raw_bounds parse, keep loop, separate manual shutter

- Robust MediaPipe landmark list parsing (array / nested / TypedArray / pixel→norm) with valid/invalid counts
- Cap detector hardRestart at 2; keep rAF loop alive; resume auto when bounds recover
- Manual shutter works without landmarks (video frame → canvas → preview)
- Debug panel default OFF, below camera (not over face); `?landmarkDebug=1` to auto-open
- User copy without technical `raw_bounds` / INVALID jargon
- Tests: `npm run test:guided-landmark` · build OK · **Android 실기기 미확인**

## 2026-07-22

### Phase 3.1.3 — Block exploded landmark coords + keep inference loop alive

- Reject non-finite / out-of-range landmark, bounds, and display values (`invalid_landmark_data`); never clamp into fake-normal
- Face bounds from validated landmark min/max only; facialTransformationMatrix used for pose (copied) never as center/bounds
- Display cover transform: single path, width/height via two corners, mirror once
- Inference: `finally` clears lock; rAF always reschedules; monotonic `performance.now()` timestamps
- Stale policy: reuse ≤250ms, stale >700ms, detector restart >2s → manual_guidance fallback
- Diagnostics: rawC / preMirrorC / dispC / invalidStage / infer / loop / lock / restart; garbage shown as INVALID
- Tests: `npm run test:guided-landmark` · build OK · **Android 실기기 미확인**

### Phase 3.1.2 — Fix false no_face/center loop + always-on alignment diagnostics

- Root cause: `detect()` gated on `video.currentTime` (often stalls on Android) → null → mapped to misleading “중앙에 맞춰 주세요” (`no_face`)
- Throttle by `minIntervalMs` + MediaPipe monotonic timestamps; reuse last snapshot with `stale_landmark` age
- Always-on Preview/dev diagnostic panel (fail, display/video centers, deltas, cover crop, mirror count) — local only
- Distinct messages for center_x/y, size, stale, transform; soft features unchanged
- Mirror applied once in `displaySpace`; tests for cover crops + center-inside invariant
- Tests: `npm run test:guided-landmark`

### Phase 3.1.1 — Fix landmark alignment BLOCKER (cover transform + soft features)

- Root cause: object-fit cover crop mismatch + absolute eye/nose/mouth hard fails + elongated oval guide
- Shared `displaySpace` video→display transform (mirror + cover crop) for detector and overlay
- Templates: wider center/size/pose; features face-relative; softFeaturesOnly (glasses-tolerant)
- Debug overlay toggle on Preview/dev; primary single guidance message
- Tests: `npm run test:guided-landmark`

### Phase 3.1 — Face landmark auto-capture + multilingual voice countdown

- `@mediapipe/tasks-vision` FaceLandmarker (Apache-2.0) · same-origin WASM (`/mediapipe/wasm`) + model (`/models/face_landmarker.task` ~3.7MB)
- Templates: `front_template_v1` / `left_45_template_v1` / `right_45_template_v1` (normalized) · 1s hold → 3·2·1 → auto-capture once/angle
- Voice: ko/en/ja/zh-CN/es via SpeechSynthesis · ON/OFF session toggle · failure never blocks capture
- Fallback: manual guide or questionnaire · **no gallery** · CSP `wasm-unsafe-eval` + `camera=(self)`
- Flags: `NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE`, `NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN` (default ON)
- Privacy: no embeddings / no landmark coords in logs / no Storage/DB this step
- Docs: `docs/analyze/PHASE31_FACE_LANDMARK_AUTO_CAPTURE.md` · test: `npm run test:guided-landmark`

### Phase 3.0.2 — Forbid gallery upload on general user analyze path

- User-facing inputs: camera + questionnaire_only only
- Removed gallery buttons/file inputs from `/analyze` GuidedCaptureFlow and legacy upload UI
- Camera failure fallback: retry + permission help + questionnaire (no gallery)
- Master Plan §22 updated; `inputPolicy.ts` + selftest DOM/source checks

### Phase 3.0.1 — Fix camera blank after permission grant

- Root cause: unstable effect deps stopped MediaStream right after allow; play/attach race
- requesting_permission until live preview; Overconstrained → `{ video: true }` fallback
- 5s startup timeout + retry/gallery/manual; `camera_start_failed` / `video_play_failed` (not mislabeled denied)
- Preview/dev diagnostics `[guided-camera]`; stream-identity cleanup for StrictMode
- Tests extended in `test:guided-capture`

### Phase 3.0 — Guided camera capture MVP + analysis waiting UX

- Camera-first multi-angle capture (front / left45 / right45) on `/analyze`
- Gallery + questionnaire-only fallbacks; permission/HTTPS/device unavailable paths
- Local quality checks (resolution/brightness/sharpness/file/format); pose=`pose_check_unavailable` (no fake face ML)
- Analysis progress overlay with soft 0–90% then 100% on real completion; timeout/retry; duplicate-submit guard
- Ephemeral object URLs only — no Storage/migration/care-photos; EXIF strip via existing helper
- Flag: `NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE` (default on; `0` restores legacy single upload)
- Docs: `docs/analyze/PHASE30_GUIDED_CAMERA_CAPTURE.md` · test: `npm run test:guided-capture`

### Phase 2.6.2 종료 — A 엄격 RLS + BOJ verified OOS + Preview UI

- Staging Dashboard v2: BOJ offer `verification_status` unverified→verified (stock OOS·price·URL 불변)
- A 엄격 RLS: verified+in_stock 또는 verified official KR OOS/unknown (unverified 공개 없음)
- anon 가시 20→21 (추가 BOJ 1건 · ROUND LAB unverified 비가시)
- C Top: COSRX / BOJ(OOS·CTA OFF) / Anua · Haruharu=availability_unknown
- Preview 수동 UI 검수 완료 · Production write 0 · B 예외안 미적용
- Docs: `SCENARIO_PILOT_PHASE262_POST_APPLY_VERIFY.md` · rollback SQL v2

### Phase 2.5~2.6 — recommendation ↔ commerce 분리

- Ranking gate vs purchase CTA 분리 · `RECOMMEND_COMMERCE_SEPARATION` (기본 on)
- Staging SELECT + Preview Ready 검증 · rollback OFF 시 C Top 0 복원
- Docs: `SCENARIO_PILOT_PHASE25_COMMERCE_SEPARATION.md` · `SCENARIO_PILOT_PHASE26_STAGING_PREVIEW.md`

### Scenario Top10 pilot enrichment (multiSource)

- Global products + many-to-many scenario pools; reuseRate 0.16; recommendation_ready 8 (honest shortfall); `test:recommendation-pilot-enrichment`; no DB/UI/runtime

### Scenario Top10 pilot + WQ-F local archive cleanup

- Archive WQ-F clutter under data/archive/; curated JSON Top10 pilot pools + pure-logic selftest (	est:recommendation-pilot); no DB/runtime wiring

### WQ-F Phase 0/1 — Recommendation scenario Top10 model

- Curated KR core scenarios: **30** (not Cartesian) · types/match/pool/gap pure logic
- Docs: `RECOMMENDATION_SCENARIOS.md` · Phase2 schema draft · WORK_QUEUE/MASTER_PLAN redirect
- Tests: `npm run test:recommendation-scenarios` · `npm run analyze:scenario-catalog-gap`
- No fake pool fill · no migration apply · no Staging write · no WQ-G / Production / main

### WQ-F Catalog remaining (legacy ingestion layer · earlier same day)

- CLI-safe crawl: `officialCrawl.ts` (robots-aware · no server-only)
- Quality statuses: `qualityStatus.ts` · sprint: `wqFRemainingSprint.ts`
- Runner: `npm run catalog:wq-f-remaining` (`WQF_DRY_RUN` / `WQF_COMMIT_STAGING`)
- Exception queue scoring: duplicate stays critical; renewal@0.9 stays high
- Docs: `docs/catalog/WQ_F_REMAINING.md` · demoted to **ingestion feed for scenario pools**
- Production 미쓰기 · main 미병합 · products 자동 publish 없음

### Care worker admin dry-run (WQ-E · 코드·테스트 완료)

- Policy/service: Production·prod-ref 차단 · CONFIRM 필수 · dry-run tick · manual retry/cancel
- API: `GET|POST /api/admin/care/checkin-email-worker` · UI `/admin/care/checkin-email-worker`
- Admin retry: failed→pending · retry_count=0 · last_error clear · audit `checkin_email_*`
- self-test: `npm run test:checkin-email-worker-admin` · Staging SELECT verify (Resend 미호출)
- UTF-8 rewrite: `checkin-email-queue-status/route.ts`
- Production 미배포 · main 미병합 · 실발송 없음
### 체크인 스케줄링 (WQ-D · 코드·테스트 완료)

- Pure orchestrator: `checkinSchedulingOrchestrator.ts` (in-app + email due/reminder)
- Settings: `careEmailChannelConsent` · `locale` · 마케팅(`emailOptIn`) 분리 UI (`/my/settings`)
- Preferences 영속: auth user_metadata + `GET/PATCH /api/care/notification-preferences` (새 migration 없음)
- Worker: profiles.email + metadata settings 로드 후 enqueue
- Worker: `runCheckinSchedulingTick` enqueue only · dry-run/live send 없음
- Admin: `GET /api/admin/care/checkin-email-queue-status` · `/admin/care` 패널
- Tests: `npm run test:checkin-scheduling` · Staging SELECT gate `verify:checkin-scheduling-staging`
- Schema A migration 유지 · Preview test-send in-memory 유지 · Production/main 미변경

### 재방문 대시보드 (WQ-C · 코드·테스트 완료)

- Pure: `revisitDashboard.ts` · `quickSkinCheck.ts`
- `/my` 모바일 우선 섹션 (다음 할 일 · quick check · 체크인 · 루틴 · 사진 상태)
- `GET /api/care/photo-consents` 클라이언트 병렬 fetch (migration pending OK)
- `npm run test:revisit-dashboard` · `docs/revisit-dashboard.md`
- Staging photo migration/bucket **미적용** · Production/main **미변경**

### 사진 비교 동의·저장·삭제 (WQ-B · 코드·테스트 완료)

- 정책: `photoComparisonPolicy.ts` · EXIF strip · in-memory service
- API: photo-consents / photo-assets / delete-all (synthetic fixture Preview only)
- UI: `PhotoConsentPanel` · `PhotoAssetsSettingsPanel` · analyze/settings 연결
- DRAFT migration: `DRAFT_DO_NOT_APPLY_care_photo_comparison.sql` (**미적용**)
- `npm run test:photo-comparison` 추가
- 승인 대기: Staging migration apply · private `care-photos` bucket · 실제 업로드/Storage delete

### 체크인 이메일 큐 Staging 적용·검증 완료 (WQ-A)

- Staging Dashboard SQL: `20260722010000_create_checkin_email_queue.sql` **적용 완료**
- 검증: `npm run verify:checkin-email-queue-staging` **통과**
  - Staging ref guard · Production ref 차단
  - service_role SELECT/INSERT/UPDATE · claim RPC · anon SELECT 거부
  - FK negative (fake UUID) · status CHECK negative · payload plaintext CHECK negative
  - care_check_ins 행 없음 → positive insert/claim/sent/cancel 경로 스킵 (negative·RPC 검증은 완료)
- 실발송 **없음** · DELETE **없음** · Production/main/Production DB **미변경**

### Fast Execution System v1

- `WORK_QUEUE.md` · `docs/FAST_EXECUTION_SYSTEM.md` · `docs/APPROVAL_POLICY.md`
- `npm run project:status|next|verify|complete|continue`
- `safe-command-gate` · work-queue parser · orchestrator selftests
- Staging probe: `scripts/probe-checkin-email-queue-staging.mjs` (post-apply verify는 `verify:checkin-email-queue-staging` 사용)
- Production/main/실발송 기본 차단 유지

### 체크인 이메일 큐 Schema A Staging 구현 (코드·게이트 · DB 적용 대기)

- dated migration 승격: `20260722010000_create_checkin_email_queue.sql` (DRAFT는 참고용 유지)
- Schema A: Production 체크인만 DB queue · Preview test-send는 in-memory (`preview-email-test:…`) 유지 · queue 없어도 Preview UI 동작
- idempotency v1: `checkin-email:v1:{user_id}:{checkin_id}:{milestone}:{kind}:email`
- DB status: pending/processing/sent/failed/skipped_duplicate/cancelled
- 메모리 매핑: scheduled→pending · sending→processing · retry_scheduled→pending(+retry_count/next_attempt) · duplicate→skipped_duplicate
- claim: `claim_checkin_email_jobs` · `FOR UPDATE SKIP LOCKED` · stale processing 복구 · service_role EXECUTE만
- persistence: enqueue/claim/markSent/markFailed/markCancelled · last_error sanitize · max retry 3
- dry-run worker: live provider 거부 · 실제 발송 없음
- 게이트 `npm run gate:checkin-email-queue-staging` **통과** (ref Staging · build · Care/selftest)
- Staging DB 적용: Dashboard SQL **완료** (2026-07-22) · `verify:checkin-email-queue-staging` **통과** · Production **미변경** · 실발송 **없음**
- 적용 후 수동 정리: synthetic fixture는 DELETE 자동 실행 금지 · `status='cancelled'` 권장

### Preview 체크인 이메일 테스트 UI 육안 확인

- Preview `/admin/care/check-in-email-test` 육안 **완료**
- 폼·미리보기 정상 · milestone / locale / kind 변경 정상
- migration / permission 오류 없음 · 깨진 화면 없음
- 실제 이메일 발송 없음 (발송 버튼 미클릭)
- `checkin_email_queue` Staging·Production **미적용** (당시 기준)

## 2026-07-21

### Care admin readiness · service_role SELECT grant (Staging migration 작성)

- `/admin/care`: `42501` → permission_missing · `PGRST205`/relation missing → migration_missing · 기타 → query_error
- migration `20260721100000_grant_service_role_care_read.sql`: care_check_ins, care_notifications, care_audit_events, care_analysis_sessions, care_routines, profiles에 service_role **SELECT만**
- self-test: `npm run test:admin-care-readiness` (Preview ref ≠ Production guard · probe 분류 · `care-dashboard-summary-selftest.ts --admin-care-readiness`)
- Staging apply 전: `npm run fix:utf16le-migration-grant` (Windows UTF-16LE migration 파일 보정)
- checkin_email_queue **미생성** · Production/Production DB 변경 없음 · Staging apply는 operator

### Care Staging service_role SELECT grant 적용·검증 (2026-07-21)

- Staging (`jfnj***gfd`)에 GRANT SELECT 적용 완료 · `care_check_ins` probe `ready`
- `getAdminCareOpsSummary` → `readiness=ready` · note=`counts only — no PII` (migration/permission 오표시 해소)
- self-test에 summary 경로 assert 추가
- Preview `/admin/care` 육안 **통과** (경고 없음 · 집계 카드 정상)
- Production·`checkin_email_queue` 변경 없음

### 체크인 이메일 큐 DRAFT Staging 검토 (적용 보류 · 2026-07-21)

- 대상: `DRAFT_DO_NOT_APPLY_checkin_email_queue.sql` · **테이블 미생성**
- 결론: Staging 적용 **불가** (보완 후 재승인)
- 차단: RLS/정책 미작성 · service_role GRANT 없음 · `recipient_hash` NOT NULL(v1 mask-only와 불일치) · idempotency `scheduleDate` 포함 vs v1 `checkin-email:v1:…:email` · status CHECK 미비
- Preview는 Schema A(in-memory) 유지 · Production/DB 변경 없음

### 체크인 이메일 큐 DRAFT v2 보완 (Staging 미적용 · 2026-07-21)

- Schema A: Production queue만 DB · Preview test-send in-memory 유지
- idempotency: `checkin-email:v1:{user_id}:{checkin_id}:{milestone}:{kind}:email` (scheduleDate/locale/template/recipient 제외)
- DRAFT: RLS ON · PUBLIC/anon/authenticated REVOKE · service_role SELECT/INSERT/UPDATE · DELETE/TRUNCATE 없음
- `recipient_hash` 제거 · `recipient_mask` NOT NULL · checkin_id/user_id FK · status/milestone/kind/channel CHECK
- self-test: `test:checkin-email-queue` · `test:checkin-email-queue-migration`
- Staging/Production DB 미적용 · 실발송 없음

## 2026-07-20

### 단계 5 — Preview 관리자 체크인 이메일 테스트 발송 UI/API (mock만 · 실발송 없음)

- `/admin/care/check-in-email-test` · `POST /api/admin/checkin-email/test-send`
- Production 404/403 · `VERCEL_ENV=preview` 필수 · 관리자 인증 · same-origin
- 수신자는 `EMAIL_STAGING_RECIPIENT_ALLOWLIST` 첫 유효 주소만 (클라이언트 recipient 무시)
- 테스트 payload: `preview-email-test` · care consent 고정 · 마케팅 미사용
- in-memory rate limit: 60초 1건 · 시간당 10건 (서버리스 임시 · DB audit 없음)
- self-test: `npm run test:checkin-email-test-api` (mock transport · resend.com fetch 차단)
- 실제 발송 없음 · Preview 재배포 후 관리자 UI 클릭 시에만 가능 · main 미병합 · Production 미배포

### 단계 5 — 체크인 이메일 Resend live adapter (코드만 · 실발송 없음)

- `resend` npm 패키지 추가 · live provider·게이트·allowlist·kill switch·Production 강제 차단
- `EMAIL_DELIVERY_MODE=live` + `EMAIL_PROVIDER=resend` + kill switch + API key + from address 필요 (Production은 항상 차단)
- Staging-only `EMAIL_STAGING_RECIPIENT_ALLOWLIST` · mock transport self-test만 (`npm run test:checkin-email-resend`)
- 실제 발송 없음 · API 키 미설정 · DNS 미변경 · Preview API 미구현 · main 미병합 · Production 미배포

### 단계 5 — 체크인 이메일 dry-run provider (실제 발송 없음)

- `disabled` / `dry_run` / `live` 모드 해석 · live는 `live_mode_blocked`만 반환 (실발송·SDK·API 키 없음)
- payload: 텍스트만 · 안전 경로 `/my/check-ins/{id}`, `/my/settings` · photo/health/affiliate/http URL 거부
- consent: care checkin + care email 필수 · marketing만이면 `marketing_only_consent`
- self-test: `npm run test:checkin-email-provider`
- admin UI·실제 provider 연동·DB migration 후순위 · main 미병합 · Production 미배포


### 단계 5 — 체크인 이메일 큐 정책 (발송 미연결)

- `checkinEmailQueuePolicy` · `checkinEmailCopy` 공용 순수 모듈 추가
- care 체크인 동의 + care 이메일 채널 동의 필수 (marketingConsent만으로는 후보 생성 금지)
- idempotency key · 상태 전이 · 재시도(5분/30분/2시간, 최대 3회) · dead_letter
- payload에 사진·건강상세 금지 · 수신자는 mask/hash만 (평문 email 미저장)
- DRAFT migration `DRAFT_DO_NOT_APPLY_checkin_email_queue.sql` (실제 DB 미적용)
- self-test: `npm run test:checkin-email-queue`
- 실제 이메일 provider 미연결 · main 미병합 · Production 미배포


### 단계 5 — 체크인 응답 기반 루틴 조정 제안 UI

- `routineAdjustmentPolicy` · `routineAdjustmentCopy` 공용 모듈 추가
- 응답별 조정안: keep / simplify / pause recent·new / restart_later / record_only / consultation_first
- 사용자 승인 전 루틴 불변 · 일시 중지≠삭제 · snapshot 되돌리기 · checkinId 중복 적용 방지
- 자외선 차단 자동 중단 금지 · 위험 신호 시 제품 조정 적용 차단
- 화면: `/my/check-ins/[id]` 완료 결과 아래 `RoutineAdjustmentPanel`
- 저장: localStorage `kbeautyCareStoreV1` + `routineAdjustmentHistory` (DB migration 실행 없음)
- self-test: `npm run test:routine-adjustment`
- Organic 점수·순위 불변 · main 미병합 · Production 미배포

### 단계 5 시작 — 체크인 응답 분기 정책·화면 연결

- `src/lib/retention/checkinPolicy.ts` · `checkinCopy.ts` 공용 순수 모듈 추가
- 3·7·15·30일 일정: 동의(`consentCareTracking`) 없으면 미생성 · 시작일 없으면 미생성 · 완료 기록 보존 · milestone 중복 방지
- 응답 6종(improved/unchanged/worsened/not_started/stopped/unsure)별 다음 행동 분기
- 위험 신호(통증·출혈·진물·감염 의심·화상 등) → 상담 우선 (`prioritizeConsultation`)
- 48시간 1회 재알림 정책 (`shouldRemind` · `reminderCount`) — 실제 발송 미연결
- 화면: `/my/check-ins` · `/my/check-ins/[id]` (응답 선택·다음 행동·위험 안내)
- careCheckinConsent ↔ `consentCareTracking` · marketingConsent ↔ `emailOptIn` 분리 매핑
- DB migration 실행 없음 · Production·main 미변경
- self-test: `npm run test:checkin-policy`

### 단계 4 코드 검증 완료 · Preview 운영 검수 잔여

- 단계 4 본기능(사용 가이드·부위 필터·disclosure·관리자 미디어 검수) 코드·자동 테스트·Staging build 검증 완료 (HEAD `555d317`)
- Preview 콘솔 localStorage 수동 주입 검수 중단
- Preview 수동 샘플 육안·관리자 Staging 미디어 육안·원격 검수 JSON 연결은 미완료 운영 검수 항목
- `/qa/usage-guide` 임시 QA 페이지는 본기능에 포함하지 않음
- main 미병합 · Production 미배포 · Production DB·환경변수 변경 없음

### AI 생성·광고·협찬 공용 disclosure 정책 보강

- `contentDisclosurePolicy` · `ContentDisclosure` 공용 모듈/UI 추가 (ko/en/ja)
- `ProductUsageGuide`·미디어 표시 자격·관리자 catalog 검수가 동일 정책 사용
- AI/광고/협찬 고지 없으면 미디어 비표시 · 공식 Organic은 광고로 오인 표시하지 않음
- Organic 점수·순위 불변 · DB migration 없음 · Production·main 미변경
- self-test: `test:content-disclosure` · `test:usage-media`에 포함

### 부위별 화면 검증된 사용 가이드 연결

- `/face-explorer` 존 선택 시 LocalStorage 검증 가이드를 `applicationArea` 교집합으로만 표시
- `/results?area=` 쿼리로 추천 카드 가이드 필터 · `/my/guidance`는 분석 부위 스냅샷 기준 필터
- 일치 가이드 없으면 기존 부위·카드 UI 유지 (`emptyMode=hidden`) · 사용법 추론 없음
- Organic 점수·순위 불변 · Production DB·배포·main 병합 미실행

### 관리자 사용 영상·가이드 검수 화면 (읽기 전용)

- 관리자 제품 상세에 `사용 영상·가이드 검수` 섹션 추가 (`catalog_product_media` SELECT)
- 표시 자격 순수 함수 `isUsageMediaDisplayEligible` · catalog 평가 `evaluateCatalogProductMediaDisplay`
- HTTPS만 클릭 가능 · iframe/자동재생/`dangerouslySetInnerHTML` 없음 · 승인·삭제 쓰기 없음
- 스키마 부족 항목은 UI·`DRAFT_DO_NOT_APPLY_usage_media_extensions.sql`에만 기록 (DB 미적용)
- self-test: `test:admin-usage-media` · `test:usage-media`에 포함
- Organic 점수·순위 불변 · Production DB·배포·main 병합 미실행

### 추천 카드·루틴 공용 사용 가이드 표시

- `src/components/usage/ProductUsageGuide.tsx` 공용 컴포넌트 분리
- `/routine` · `RecommendedProductCard`가 동일 검증·표시 로직 사용
- 추천 카드는 가이드 없을 때 영역 숨김(`emptyMode=hidden`), 루틴은 기존 빈 상태 유지
- HTTPS 미디어·검증 필드만 표시 · `dangerouslySetInnerHTML` 미사용 · 자동재생 없음
- Organic 점수 회귀 self-test 추가 (`usage-media-organic-score-regression-selftest`)
- Production 배포 · Production DB · main 병합 미실행

---

## 2026-07-16

### 로컬 출시 준비 검사 통과

- `check:production` · `check:release-security` · `test:smoke` 통과
- main 병합 · Production 배포는 명시 승인 대기

### Snail 96 Staging 이미지 복구 + 공개 9건 검증

- id=1 `Advanced Snail 96 Mucin Power Essence` primary 이미지 68B 플레이스홀더 → 공식 COSRX 26,610B JPEG
- Staging 공개 추천 9건 verified primary media signed fetch **9/9 OK**
- `scripts/fix-staging-snail96-official-image.mjs` · `scripts/verify-staging-public-product-images.mjs`
- Production / main 미변경

### A안 Production 신규 5건 INSERT 완료

- id **188~192** · 전원 `verified_at` NULL · 성분 링크 합계 111
- 중복 3건(Vitamin C / Snail 92 / Retinol) 스킵 · media/offer 없음
- main 병합 · Production 배포 미실행

### Preview /results 제품 이미지 복구

- 원인: anon이 `catalog_product_media` SELECT 불가(42501) + private `product-images` signed URL 미재발급
- `/api/catalog/product-images`에서 service role로 `storage://` canonical 재서명
- `fetchCandidateProducts`가 해당 API로 `image_url` 부착
- Preview 재배포 · main/Production 미실행

### A안 Production 스모크 1건 완료

- Production `products` id **188** · `cosrx-low-ph-good-morning-gel-cleanser`
- `verified_at` NULL · `product_ingredients` 27 (pending) · media/offer 없음
- ingredients 40→66 · main/배포 미실행 · 나머지 신규 4건 대기

### A안 Production dry-run 완료 (INSERT 없음)

- 「진행승인」후 Staging COSRX 시드 8건 vs Production 중복 조회
- 신규 5 · 중복 스킵 3 (Vitamin C / Snail 92 / Retinol) · media 테이블 없음 → 스킵
- 상세: `docs/RELEASE_KR_CATALOG_PRODUCTION_PLAN.md` · Production 쓰기·main·배포 미실행

### Preview SSO UI 수동 검수 완료

- 사용자 확인: `/analyze`→`/results` · `/admin/catalog/labels` · bulk-review
- Staging 대체 검증·품질 게이트 유지 · Production · main 미변경

### 잔여 heroes 공식 INCI 재탐색 (apply 없음)

- OBF 27건 · Banila/Isntree/espoir·rom&nd 등 공식몰 심층 확인 → harvested **0**
- Staging with_inci **57** 유지 · 잔여 27건 **BLOCKED** (공식 verbatim 미확보 · invent 금지)
- Production · main 미변경

### TOCOBO Cotton Soft Sun Stick 공식 INCI Staging 적용

- `tocobo.co.kr` Cosmetics Act 전성분 (Soft ≠ Airy) · EN INCI는 고시 순서 표준 매핑
- Staging: with_inci **57** · official_matched **58** · recommendable **58** · evidence_linked **44**
- Production · main 미변경

### espoir Pro Tailor Be Glow Cushion 3 shades 공식 INCI Staging 적용

- Beige / Ivory / Petal shade-level All ingredients (`espoir.com`)
- Staging: with_inci **56** · official_matched **57** · recommendable **57** · evidence_linked **44**
- Production · main 미변경

### innisfree Green Tea Seed Serum·SOME BY MI Miracle Toner 공식 INCI Staging 적용

- innisfree AU Full ingredients · SOME BY MI Global Cosmetics Act disclosure
- Staging: with_inci **53** · official_matched **54** · recommendable **54** · evidence_linked **41**
- HERA UV Mist는 공식 단종/후속 Black Cushion과 비매핑 · 립틴트 쉐이드별 미확보 · Production · main 미변경

### mise shampoo·goodal eye·ETUDE/CLIO/PERIPERA mascara 공식 INCI Staging 적용

- mise Perfect Serum Shampoo Original (`hk.miseenscene.com`) · goodal Vita C Dark Circle Eye Cream · ETUDE Curl Fix #01 · CLIO Kill Lash · PERIPERA Ink Black Cara (`clubclio.shop` / `int.etude.com`)
- Staging: with_inci **51** · official_matched **52** · recommendable **52** · evidence_linked **39**
- OBF 잔여 38건 harvest 0 · CLIO Extreme Volume 별도 공식 제외 · Production · main 미변경

### mise en scène Perfect Serum Original 공식 INCI Staging 적용

- Global Amore Mall ORIGINAL variant Ingredients
- Staging: with_inci **46** · official_matched **47** · recommendable **47** · evidence_linked **38**
- 제품등록은 별도 승인 없이 Staging만 계속 · Production · main 미변경

### Sulwhasoo·COSRX Clear Fit Patch 공식 INCI Staging 적용

- First Care Activating Serum VI · Clear Fit Master Patch
- Staging: with_inci **45** · official_matched **46** · recommendable **46** · evidence_linked **38**
- OBF 잔여 41건 harvest 0 · Soft≠Airy TOCOBO 등 스킵 · Production · main 미변경

### medicube·Dr.Jart Cicapair·MISSHA BB 공식 INCI Staging 적용

- medicube Zero Pore Pads US PDP · Dr.Jart Cicapair DailyMed · MISSHA Perfect Cover BB 13/21/23 DailyMed
- Staging: with_inci **43** · official_matched **44** · recommendable **44** · evidence_linked **37**
- 제품등록은 별도 승인 없이 Staging만 계속 · Production · main 미변경

### Lador Hydro LPP·Perfect Hair Fill-up 공식 INCI Staging 적용

- `en.lador.co.kr` INGREDIENTS accordion
- Staging: with_inci **38** · official_matched **39** · recommendable **39**
- 제품등록은 별도 승인 없이 Staging만 계속 · Production · main 미변경

### AMOREPACIFIC·Haruharu·Etude SoonJung 공식 INCI Staging 적용

- Time Response Skin Reserve Serum · Black Rice Hyaluronic Toner · SoonJung pH 6.5 Whip Cleanser
- Staging: with_inci **36** · official_matched **37** · recommendable **37** · evidence_linked **31**
- Staging slug SSOT는 `amortepacific-*` typo · 제품등록은 별도 승인 없이 Staging만 계속 · Production · main 미변경

### heimish All Clean Balm 공식 US INCI Staging 적용

- `heimish.us` All Clean Balm 120ml Skin-Loving Ingredients
- Staging: with_inci **33** · official_matched **33** · recommendable **33** · evidence_linked **29**
- Production · main 미변경

### SKIN1004 Hyalu-Cica Water-Fit Sun Serum DailyMed Staging 적용

- US DailyMed setid `38d8c1c9-86b5-1edd-e063-6394a90aeb47` (actives + inactive)
- Staging: with_inci **32** · official_matched **32** · recommendable **32** · evidence_linked **29**
- TOCOBO Soft·SOME BY MI·innisfree는 공식 SKU/전성분 미확보로 스킵 · Production · main 미변경

### mixsoon·Isntree 공식 INCI Staging 적용

- mixsoon Bean Essence (`mixsoon.us`)
- Isntree Hyaluronic Acid Watery Sunscreen US DailyMed (hero: watery sun gel)
- Staging: with_inci **31** · official_matched **31** · recommendable **31** · evidence_linked **28**
- Production · main 미변경

### numbuzin·PURITO sun·AXIS-Y sun 공식 INCI Staging 적용

- No.3 Skin Softening Serum · Daily Soft Touch Sunscreen · Complete No-Stress Physical Sunscreen
- Staging: with_inci **29** · official_matched **29** · recommendable **29** · evidence_linked **27**
- Production · main 미변경

### SKIN1004·PURITO·Klairs·AXIS-Y 공식 INCI Staging 적용

- Centella Ampoule · Wonder Releaf Centella Unscented · Vitamin Drop · Dark Spot Glow Serum
- Staging: with_inci **26** · official_matched **27** · recommendable **27** · evidence_linked **24**
- Production · main 미변경

### Beauty of Joseon·ROUND LAB 공식 INCI Staging 적용

- BoJ Glow Serum · Relief Sun · Ginseng Essence Water (공식 CPNP 페이지)
- ROUND LAB Dokdo Toner · Birch Moisturizing Sunscreen (roundlab.com)
- Staging: with_inci **22** · official_matched **23** · recommendable **23** · evidence_linked **21**
- Production · main 미변경

### Anua·Torriden US 공식 INCI Staging 적용

- Anua Heartleaf 77 Toner · Niacinamide 10%+TXA 4% Serum (`anua.us`)
- Torriden DIVE-IN Serum (`torriden.us`)
- Staging: with_inci **17** · official_matched **18** · recommendable **18** · evidence_linked **16**
- Shopify INCI 후보 수확 스크립트 추가 · Production · main 미변경

## 2026-07-15

### LANEIGE US 공식 INCI Staging 적용

- Cream Skin Refiner · Lip Sleeping Mask(BERRY) — us.laneige.com Ingredients
- Staging: with_inci **14** · official_matched **15** · recommendable **15** · evidence_linked **13**
- Production · main 미변경

### Banila·COSRX 라벨 Staging 적용 · match_class 보정

- Banila US PDP INCI + COSRX sunscreen/propolis hero upsert·apply
- Staging: with_inci **12** · official_matched **13** · recommendable **13** · evidence_linked **11**
- curated apply 시 `match_class`/`recommendable` 누락 보정
- Production · main 미변경

### Banila Clean It Zero Original 공식 INCI (시트)

- `banilausa.com` PDP Ingredients 메타필드에서 밤 SKU 전성분 21개 확인·시트 반영
- `applyReady=true` · OBF foam 오매칭 유지 거부 · Staging apply는 별도 승인 실행
- Production · main 미변경

### Banila 오매칭 제거 · Staging 이름 정리

- OBF foam INCI를 Clean It Zero Original에서 제거 (잘못된 SKU)
- Staging garbled `product_name_en` 5건 복구 · `catalog:labels:status`
- Production · main 미변경

### Admin Labels 검수·Staging 적용

- `/admin/catalog/labels` 검수 대기 필터 · 선택 preview/commit
- `POST /api/admin/catalog/labels/apply` (Staging gate · audit)
- 시트 JSON Git SSOT 유지 · Production · main 미변경

### Open Beauty Facts INCI 수확 채널

- `npm run catalog:labels:obf` — 누락 heroes 73 검색
- 브랜드/INCI형태/제형 충돌/유사도 가드 · Banila 후보 1건은 applyReady=false
- Staging 자동 적용 0 (오매칭 방지) · Production · main 미변경

### 라벨시트 히어로 확장 (COSRX seed → Staging)

- `catalog:labels:upsert-heroes` + `catalog:labels --force`
- Staging `with_inci` **9** · `official_matched` 9 · Evidence 9
- `1,2-Hexanediol` 파서 콤마 분리 수정
- `npm run catalog:labels:sync` 원샷 파이프라인
- Production · main 미변경

### 공식 전성분 라벨시트 채널

- `data/catalog/labels/official-inci-sheet.v1.json` + `npm run catalog:labels`
- Staging `with_inci` (1차 3 → 확장 9)
- Admin `/admin/catalog/labels` · `docs/92-official-inci-label-sheet.md`
- 추측 INCI 금지 · Production · main 미변경

### INCI/라벨 보강 스프린트 1차

- `extractLabeledIngredients` — `전성분`/`Ingredients`/`INCI` 라벨 뒤에서만 추출
- COSRX 공식몰 URL override (`cosrx-products.json` 검증분만) · 오매핑 pad 경로 제거
- `npm run catalog:inci` — Staging heroes 76 · 일시 실패(429 등) Staging 덮어쓰기 스킵
- Staging 결과: `official_matched` 3 · 전성분 0 · recommendable 3
- `/results` 도메인 문진 → 속성 예시 추천 패널 (구매 검증 주장 없음)
- Preview https://kbeauty-platform-aaczm021m-akscnl6521s-projects.vercel.app
- Production · main 미변경

### Discovery 보강 스프린트 1차

- 플레이스홀더 1085건 Staging `rejected` (추천 제외)
- robots 준수 공식 JSON-LD 수집 · 당시 `official_matched` 5 · 전성분 추측 저장 없음
- 브랜드 체크포인트 `data/catalog/enrichment/checkpoint.json` (재개: romand)
- 문진 `/quiz/mascara|lip|base|hair` · bulk API `/api/admin/catalog/bulk`
- Preview https://kbeauty-platform-7k9e5hhex-akscnl6521s-projects.vercel.app
- Production · main 미변경

## 2026-07-14

### Full Beauty 플랫폼 스프린트

- 카테고리·Staging migration `20260714100000_full_beauty_catalog_attributes.sql`
- KR 브랜드 35 · 후보 1161 · Staging discovery/staging upsert (`catalog:full-beauty`)
- 메이크업(마스카라·립·베이스) · 헤어/두피 랭커 selftest (`test:full-beauty`)
- Evidence 속성 가이드 `data/evidence/makeup-hair-attribute-guidance.json`
- Admin `/admin/catalog/bulk-review` · Results 도메인 탭 · 홈 카피 확장
- Preview https://kbeauty-platform-4mf5tlnjm-akscnl6521s-projects.vercel.app
- 공개 verified 자동 승격 없음 · Production · main 미변경

### Preview SSO 대체 검증 (Staging linked)

- `npm run check:preview-substitute` — Staging 제품 9 · offer 9 로 8고민 랭킹/근거/상담 분기
- `.env.local` 미사용 (Production URL 혼입 방지)
- Preview 브라우저 SSO는 여전히 수동
- Production · main 미변경

### Preview 품질 스모크 (SSO 한도)

- `npm run check:preview-quality` (`PREVIEW_BASE_URL=…`)
- Vercel Deployment Protection → SSO 수동 승인 대기 (bypass secret 없음)
- 로컬 `test:quality` · Staging `check:staging-quality` 회귀 유지
- Production · main 미변경

### Evidence·한국 제품 추천 품질 회귀

- `npm run test:quality` — 8고민 증상→근거→KR 랭킹→이유→주의→상담 분기
- 실패 조건: 테스트/미검수 제품 노출, 고민별 동일 fingerprint
- Staging: `npm run check:staging-quality` (probe leak 0 · PMID set 유일)
- `test:pipeline`에 quality regression 포함
- Production · main 미변경

### Evidence Layer 2차 보강 (색소·주름·모공·UV·acne)

- 정적 카탈로그·Staging 시드: pigmentation / antiaging / pores / uv + acne salicylic 보강
- `concernGuidance`로 고민별 주의사항 → `/results`
- 퀴즈 칩: 색소침착·주름·모공·자외선
- 검증: `evidence-concern-diff-selftest` · `staging-verify-evidence-concern-diff`
- Production · main 미변경

### Evidence Layer 2차 (admin CRUD + DB 조회)

- `GET/POST /api/admin/evidence`, `PATCH …/[id]` (approve/reject)
- `/admin/evidence` 목록·등록·승인 UI · 성분 상세 등록 폼
- 런타임: Staging 승인 근거 DB 우선, 정적 카탈로그 폴백
- acne concern + niacinamide PMID 17147561 Staging 시드
- Production · main 미변경

### Evidence Layer → 추천·결과 UI 연결

- 정적 카탈로그 `data/evidence/concern-ingredient-evidence.json` (실 PMID)
- `applyEvidenceToRecommendation` → `recommendedIngredients` 보강 + `evidenceLinks`
- `/results`·추천 카드에 증상→성분 citation (PMID) 표시 · 제품 효능 단정 금지
- Staging 시드: `skin_concerns` 3 · `ingredient_evidence` approved 8
- Production · main 미변경

### Staging: products 공개 SELECT 권한 수정

- 원인: anon 클라이언트 `products` 조회 시 table privilege 없음 → `permission denied for table products`
- Staging RLS: `active IS TRUE AND verified_at IS NOT NULL` (anon/authenticated SELECT)
- 컬럼 GRANT만 허용 · `data_confidence` 비공개 · INSERT/UPDATE/DELETE 거부
- `results` 페이지도 active+verified 필터 정렬 · probe `scripts/probe-staging-products-anon.mjs` 통과
- Production · main · Production DB 미변경

### 출시 차단 4항 판정

- AI_PROVIDER: Production에 설정 **존재**, 값(mock 여부) **미확인** → Dashboard 확인 필요
- 도메인: www 200 · apex→www · `kbeautymatch.com` Vercel 계정 연결
- Auth Redirect: Supabase 콘솔 수동 확인 필요 (자동 조회 불가)
- 한국 제품: **A안 권고** (Production 반영 후 출시) · 계획만 `docs/RELEASE_KR_CATALOG_PRODUCTION_PLAN.md`
- 종합: **BLOCKED** · main/Production 미실행

### 출시 직전 최종 점검

- 로컬: `build` · `test:pipeline` · `test:journey` · `test:smoke` · `check:production` · `check:deployment-env` · `check:release-security` · `check:responsive` 통과
- Preview 핵심 경로: Vercel Deployment Protection SSO로 302 (내용 미검증)
- Production: env **이름**만 확인 (`AI_PROVIDER` 존재, 값 mock 여부 미확인)
- 판정: **BLOCKED** · main 병합·Production 배포 미실행

### Staging catalog JSON 백업

- 경로: `data/backups/2026-07-14-catalog/`
- 읽기 전용 export · products 11 · ingredients 129 · 검증 통과
- signed URL 토큰 제거 · 민감정보 미검출 · SHA-256/복원 순서 문서화
- Staging/Production 데이터·배포·main 미변경

### COSRX catalog JSON → Search-to-Verified Staging 적용

- 입력 3개: Snail 96 / Snail 92 / Blemish Pad (`data/catalog/kr/cosrx-*.json`)
- 매칭 2 (productId 1, 10) · 신규 products 0 · Verified 전환 0 · needs_review 3
- source/candidate/queue/provenance/unverified offer 연결 · 4~11 본문 미변경 · 재실행 멱등
- 산출: `data/catalog-import/2026-07-cosrx-search-to-verified/`

### COSRX 시드 Staging 검증 완료

- 등록 가능 8건(`productId` 4~11) 상세 검증: 전성분·주요성분·signed 이미지·slug 일치 전부 통과
- 동일 CSV/ZIP bulk preview 재실행 → 8건 중복 차단 · commit 미실행
- 검수 2건 미등록 유지 · Preview `/admin/products/3` 재요청 안 함

### COSRX 공식 시드 Staging 등록 완료

- CLI `--reveal`로 Staging service_role 로드 후 등록 가능 8건만 commit (`scripts/run-register-cosrx-seed-staging.mjs`)
- `productId` 4~11 성공 · 실패 0 · 검수 2건(선크림·프로폴리스) 미등록
- Snail 96 / `productId=3` / Production / main 미변경
- 결과 JSON: `data/catalog-import/2026-07-cosrx-seed/staging-register-result.json`

### COSRX 공식 시드 수집

- `data/catalog-import/2026-07-cosrx-seed/` — 공식 cosrx.com 기준 10제품 CSV·이미지 ZIP·sources·validation
- Snail 96 Mucin Essence 제외 · 등록 가능 8 · 검수 필요 2


### 제품 일괄등록

- `/admin/products/import` · 양식 다운로드 · CSV/XLSX 분석 · ZIP/image_url · 행별 검증·선택 · 부분 성공 · 실패행 CSV
- `createAdminProduct` 재사용 · 최대 50건 · slug/브랜드명/출처/이미지해시 중복 차단
- deps: `xlsx`, `jszip` · Preview만 배포 · Staging 대량 가짜 등록 없음

### 관리자 제품 등록 UI 완성

- `/admin/products/new` 한 화면 등록: 브랜드 선택/입력 · slug 자동/수동 · 카테고리·사용부위 · 전성분 미리보기 · 이미지 미리보기 · 중복 slug 사전 안내 · 중복 클릭 방지
- 등록 완료 `/admin/products/new/complete` · 상세 offers/variants 빈 상태 한국어
- `createAdminProduct` slug 입력 재사용 · 전성분 줄바꿈 파싱 · `GET /api/admin/products/slug-check`
- `npm run build` · helper/selftest 통과 · 클라이언트 번들 service_role 미검출
- Preview만 배포 (Production/`main`/productId=3 미변경)

### Staging 관리자 제품 등록 · Preview 검증 대기

- Staging `product-images` private 버킷 · 공식 Storage API · signed URL · public URL 차단
- `createAdminProduct` Staging HTTP E2E 성공 · slug 중복 차단 · 전성분/주요성분 · `catalog_product_media`
- service_role 최소 SELECT: `ingredient_aliases`, `product_offers`, `product_variants` (UPDATE/DELETE·anon/authenticated·RLS·Storage 정책 미변경)
- 관리자 상세: offers/variants 0건을 빈 상태로 처리 · `productId=3` 로컬 Staging 조회 성공
- 재개 문서: `docs/NEXT_TASK_PREVIEW_VALIDATION.md` · `.cursor/rules/kbeauty-resume.mdc` · `PROJECT_STATUS`/`ROADMAP` 갱신
- **남은 단일 작업:** Preview Staging 확정 후 `/admin/products/3` 브라우저 E2E (main 병합·Production 배포 미실행)

---

## 2026-07-13

### Phase 10 UI · 반응형 · 접근성 최종

- sticky 헤더 높이 변수 · Hero overlap 수정 · skip link
- 홈/결과/온보딩/로그인/my UI 정리 · `check:responsive`
- docs/155~158 · Preview 수용·main 병합 준비 기록
- Cursor production 배포·main 병합 미실행

### Phase 9 Staging · Release 준비

- 환경 변수 presence 검증 · `/api/health` · static/HTTP smoke test · release security check
- 공개 보안 헤더/CSP · SEO metadata/robots · 사용자 오류 화면
- docs/149~154: Vercel 권장, 일반 Node `next start`, apex `kbeautymatch.com` canonical
- 배포·worker·실메일·운영 DB 쓰기·main 병합 미실행

### Phase 8 고객 여정 통합 · 실서비스 준비

- 공개 SiteHeader/Footer · 분석 중심 홈 · 여정 상태 머신
- auth callback 강화 · 온보딩 draft · 루틴 초안 `/my/routine/new`
- `test:journey` · `check:production` · docs/143~148
- Cursor 운영/실메일/운영 DB 쓰기 미실행

### 일반 사용자 인증 · 온보딩 · Care E2E

- `/login` `/signup` `/forgot-password` `/reset-password` `/logout`
- `/my`·`/onboarding` 보호 · safe `next` · `/auth/link-local` 익명 기록 연결
- `/onboarding` 단계형 · results CTA “내 피부 관리 시작하기”
- docs/138~142 · Cursor 운영/실메일 E2E 미실행

### Continuous Care 서버 영속화

- migration `create_continuous_care_persistence` 원격 적용 + DELETE privilege revoke
- CarePersistence · `/api/care/*` · 익명 local fallback · attach 연결
- worker care tick (due/expired/알림/audit) · `/admin/care` DB 집계
- docs/133~137 · Cursor 운영 worker 미실행

### Continuous Care (3·7·15·30일 지속 관리)

- `/my` 대시보드 · 분석 snapshot · 루틴 · 체크인 · 변화 · 설정
- Day 3/7/15/30 자동 일정 · 사이트 내 알림 · 루틴 조정 제안(확인 후 적용)
- 피부과 상담 권고 규칙(진단 아님) · `/admin/care` 익명 집계
- local store UX · 서버 스키마는 `docs/131` BLOCKER / `docs/132` rollback
- docs/123~130 · Cursor 운영 worker/SQL 미실행

### 운영 모니터링 · 알림센터

- /admin/operations health/alerts · rule registry · fingerprint 중복 억제
- 파일 기반 acknowledgement · durable alert migration은 BLOCKER SQL만
- safe auto-recovery allowlist · external adapter stub
- config v5 monitoring · docs/116~122
- Cursor 운영 worker/SQL 미실행

### 자율 제품 검증 · 활성화 · 추천 연결

- quality A/B draft → active=true + verified_at (published 금지)
- verified offer·공식 전성분·구조화 ingredients 필수
- stale/OOS는 제품 강등 없이 eligibility만 false
- Top5 패딩 금지 · fetchCandidateProducts는 verified catalog만
- config v4: allowProductAutoVerify/Activate/Reevaluation
- docs/104~109
- Cursor 운영 worker/SQL 미실행

### 자율 offer discovery · verification

- 판매처 등급·JSON-LD Offer 추출·가격/재고/배송 게이트
- `allowOfferCandidateInsert` / `allowVerifiedOfferUpsert` (ungated offer insert는 hard false)
- `/admin/offers` · marketplace seller 제외
- docs/98~103
- Cursor는 운영 worker/SQL 미실행

### 자율 draft catalog · 전성분 enrichment

- `allowDraftProductInsert` 등 config v2
- draft product (`active=false`) · variant · product_ingredients 자동 연결
- INCI 파서/매칭 · 카테고리 분류 · 추천 pool에서 draft 제외
- docs/90~97
- Cursor는 worker/SQL 미실행 (다음 스케줄부터 worker 적용)

### Cursor / worker 운영 분리

- `config/pipeline-operation.json` 고정 운영 설정
- 스케줄러 고정 명령: `node scripts/run-pipeline-worker.mjs` (가변 CLI 금지)
- `/admin/pipeline/settings` + overrides 파일
- Cursor는 개발·테스트·build·git만 · 운영 worker/Task/SQL 미실행
- `docs/79`, `docs/83`, `.cursor/rules/dev-ops-separation.mdc`

### 자율 파이프라인 무인 운영 전환

- migration `create_autonomous_pipeline_persistence` 원격 적용
- Supabase persistence adapter · claim/lock/heartbeat
- 관리자 pipeline 콘솔 DB 연결
- 쿠키 없는 로컬 worker (`run-pipeline-worker.mjs`)
- Task Scheduler 스크립트 (UAC 시 수동 1줄)
- dry_run 1회 검증 (products 186 / ingredients 40 유지, discovery INSERT 0)
- `docs/81`~`docs/85`

### 자율 카탈로그 파이프라인 1차

- 오케스트레이터·파일 checkpoint·retry/resume (`src/lib/pipeline/*`)
- 브랜드 seed (products/brands) · 사이트 crawl · 추출 · 중복 · 성분 · skin/tone/quality 점수
- 관리자 `/admin/pipeline` · `/admin/brands` · pipeline/brands API
- 로컬 worker 스크립트 · Task Scheduler 명령 생성만 (자동 등록 없음)
- 기본 dry_run · 자동 published 금지 · DELETE/migration 미적용
- BLOCKER SQL: `docs/80-pipeline-migration-blocker.sql`
- `docs/69`~`docs/79`

### URL 기반 discovery 빠른 등록

- `/admin/discovery/import` — URL 붙여넣기·CSV·미리보기·선택 등록
- `POST .../import/preview` · `POST .../import/commit`
- cheerio HTML 추출 (JSON-LD → OG → meta → title → path)
- SSRF 방어 · 중복 검사 · 부분 성공 · duplicate 큐 옵션
- `docs/66`~`docs/68`
- migration/DELETE/원격 테스트 INSERT 없음

### Search-to-Verified 쓰기 콘솔 1차

- 역할별 쓰기 권한 (`admin-permissions` / `write-guard`)
- POST/PATCH discovery · POST/PATCH verification
- workflow 서버 검증 (`workflow.ts`)
- 감사 로그: `product_change_history` (safe metadata, PII 없음)
- UI: `/admin/discovery/new`, discovery/verification 쓰기 패널
- DELETE·migration·가짜 offer/가격·main 병합 없음
- `docs/61`~`docs/65`

### 관리자 읽기 전용 운영 콘솔 완료

- ingredients 상세 · verification 목록/상세 · 대시보드 Verification 링크
- `AdminSubnav` 공통 내비 · `src/lib/admin/query.ts` 공통 헬퍼
- `docs/57`~`docs/60` · PROJECT_STATUS / ROADMAP / CHANGELOG 갱신
- Supabase 쓰기·migration·main 병합 없음

### 관리자 verification 상세 1차 — 읽기 전용

- `getAdminVerificationDetail` — queue + entity 연결 SELECT
- `GET /api/admin/verification/[id]` — 400/404/401
- `/admin/verification/[id]` UI — 승인/반려 버튼 없음
- `assigned_to` → `isAssigned`만
- `docs/60-admin-verification-detail-readonly.md`

### 관리자 verification 목록 1차 — 읽기 전용

- `getAdminVerificationQueue` — 검색·필터·정렬·페이지네이션
- `GET /api/admin/verification` · `/admin/verification`
- 큐 0건 빈 상태 정상 (seed 금지)
- `docs/59-admin-verification-readonly.md`

### 관리자 성분 상세 1차 — 읽기 전용

- `getAdminIngredientDetail` — aliases/evidence/cautions/linked products
- `GET /api/admin/ingredients/[id]` · `/admin/ingredients/[id]`
- verified vs evidence 존재 구분 · https URL만 활성
- `docs/58-admin-ingredient-detail-readonly.md`

### 관리자 성분 목록 1차 — 읽기 전용

- `getAdminIngredients` — ingredients + alias/evidence/caution/product counts
- `GET /api/admin/ingredients` — 검색·필터·정렬·페이지네이션
- `/admin/ingredients` UI — 실제 40건 조회
- ingredients에 active/verified_at/inci_name 컬럼 없음 → 필터·표시 규칙 문서화
- 대시보드 Ingredients 링크 활성화
- `docs/57-admin-ingredients-readonly.md`
- 쓰기·migration 없음

### 관리자 discovery 상세 1차 — 읽기 전용

- `getAdminDiscoveryDetail` — candidate + linked product + queue SELECT
- `GET /api/admin/discovery/[id]` — 400/404/401
- `/admin/discovery/[id]` UI — 기본/출처/workflow/중복/queue
- `canProceedToNextStage` 참고값만 (버튼 없음)
- 목록 상세 링크 연결
- `docs/56-admin-discovery-detail-readonly.md`
- 후보 0건 → 상세 200 E2E 미실행 (seed 금지)
- 쓰기·migration·commit/push 없음

### 관리자 discovery 목록 1차 — 읽기 전용

- `getAdminDiscoveryCandidates` — candidates + queue count (N+1 방지)
- `GET /api/admin/discovery` — 검색·필터·정렬·페이지네이션
- `/admin/discovery` UI — 0건 빈 상태 정상
- 대시보드 Discovery 링크 활성화
- 상세/상태변경/seed 없음
- `docs/55-admin-discovery-readonly.md`
- 쓰기·migration·commit/push 없음

### 관리자 제품 상세 1차 — 읽기 전용

- `getAdminProductDetail` — products + offers + variants + product_ingredients SELECT
- `GET /api/admin/products/[id]` — 400/404/401 처리
- `/admin/products/[id]` UI — 기본/검증/성분/offer/레거시/variant
- `recommendationEligible` 엄격 계산 (레거시 링크만으로 true 금지)
- 목록 ID·제품명 상세 링크 연결
- `docs/54-admin-product-detail-readonly.md`
- 쓰기·migration·commit/push 없음

### 관리자 제품 목록 1차 — 읽기 전용

- `getAdminProducts` — products SELECT + offer count (N+1 방지)
- `GET /api/admin/products` — 검색·필터·정렬·페이지네이션
- `/admin/products` UI — 읽기 전용 테이블
- 대시보드 Products 링크 활성화
- 쓰기·migration·원격 schema 변경 없음
- `docs/53-admin-products-readonly.md`
- commit/push 없음

### 관리자 대시보드 1차 — 읽기 전용 운영 현황

- `getAdminDashboardData()` — service_role SELECT/count만
- `GET /api/admin/dashboard` — 전 관리자 역할 허용
- `/admin` UI — catalog / pipeline / queue / quality / system
- 쓰기·migration·seed·원격 schema 변경 없음
- `docs/52-admin-dashboard-implementation.md`
- commit/push 없음

### 관리자 비밀번호 재설정 — token_hash verifyOtp 보완

- 실패 원인: 기본 ConfirmationURL → PKCE `code` 교환이 실패해 `recovery_failed` 반복
- `/auth/callback`: `token_hash` + `type=recovery` → `verifyOtp` 우선
- `code` → `exchangeCodeForSession` fallback 유지
- Email Template 권장 URL을 `docs/51`에 문서화 (변수만)
- commit/push·원격 DB 변경 없음

### 관리자 비밀번호 재설정 — PKCE callback 수정

- 원인: `redirectTo`가 `/admin/reset-password` 직행 → client code 교환으로 쿠키 세션 미성립
- `GET /auth/callback` — 서버 `exchangeCodeForSession` 후 cookie + redirect
- `redirectTo` → `/auth/callback?next=/admin/reset-password`
- reset-password는 `getUser`만 (code 교환 제거)
- proxy matcher에 `/auth/callback` 추가
- Dashboard Redirect URL: `http://localhost:3000/auth/callback` 수동 추가 필요
- `docs/51` 갱신 · commit/push 없음

### 관리자 비밀번호 재설정 최소 구현

- `/admin/forgot-password` — `resetPasswordForEmail` (origin 기반 redirectTo)
- `/admin/reset-password` — recovery 세션 확인 후 `updateUser({ password })`
- 로그인 화면 「비밀번호를 잊으셨나요?」 링크
- layout 가드 제외: forgot/reset-password (무한 redirect 방지)
- `docs/51-admin-password-reset.md`
- Dashboard Redirect URL은 수동 확인만 (자동 변경 없음)
- commit/push·원격 DB 변경 없음

### 관리자 로그인 페이지 최소 구현

- `/admin/login` — Supabase `signInWithPassword`
- `POST /admin/logout` — 세션 종료 후 로그인으로 이동
- 미로그인 `/admin` → `/admin/login`
- 비관리자 → `/admin/forbidden` (+ 로그아웃)
- 설정 누락 → `/admin/unavailable`
- 로그인 성공만으로 admin 인정하지 않음 (`admin_users` 재검증)
- `docs/50-admin-login-implementation.md`
- `Supabase service role key (env)` 로컬 missing → E2E BLOCKER
- commit/push·원격 DB 변경 없음

### 관리자 인증 가드 최소 구현

- `@supabase/ssr` / `server-only` 추가
- browser / server session / admin(service_role) client 분리
- `src/proxy.ts` — `/admin`, `/api/admin` 쿠키 갱신만 (role 판정 없음)
- `requireAdminUser` / `withAdminAuth` / `GET /api/admin/auth-check`
- `/admin` 가드 레이아웃 + unauthorized/forbidden
- `/admin/catalog-review` — development + **admin_users 필수**
- `profiles.role` 권한 판정 사용 안 함
- 문서: `docs/49-admin-auth-implementation.md`
- 로그인 UI·commit/push·원격 DB 변경 없음

### 제품 DB 구축 원칙 변경 — Search-to-Verified-Product Pipeline

- 브랜드별 대량 DB 선구축을 중단하고 **검색 우선·판매 확인·성분·논문 검증 후 등록** 방식 채택
- 공식 파이프라인명: **Search-to-Verified-Product Pipeline**
- 제품 상태 단계: `discovered` → `sale_checked` → `ingredients_checked` → `evidence_checked` → `safety_checked` → `verified` → `published`
- `published`만 핵심 추천 사용; 판매 미확인·가짜 데이터·근거 없는 효능 단정 금지
- Product / ProductVariant / ProductOffer / ProductIngredient / IngredientEvidence 분리
- 공식 API는 필수 아님 — 가격·재고 갱신·피드·비용 대비 효과가 충분할 때만 선택 사용
- `MASTER_PLAN.md` / `PROJECT_RULE.md` / `ROADMAP.md` / `PROJECT_STATUS.md` 동기화
- `docs/20-data-source-verification.md` / `docs/11-product-retailer-offer.md` 신설
- `.cursor/rules/search-to-verified-product.mdc` 신설
- Sprint 14 방향: COSRX 수동 입력 → 파이프라인 설계로 확장 (COSRX 3개는 첫 검증 사례)

### Supabase — product_offers migration 적용

- 원격 migration `20260713022607` (`create_product_offers_and_catalog_extensions`) 적용 완료
- `product_offers` 테이블 존재, 행 0; RLS: verified + in_stock + active만 SELECT

### 문서 복구 — Master Plan v3.1 / 운영 규칙 / 상태 동기화

- `MASTER_PLAN.md` 신설 (v3.1: 한국 MVP, 이중 저장, 검증 우선, 즉흥 수정 금지)
- `PROJECT_RULE.md` 신설 (GitHub/Supabase 규칙, 작업 순서, 백업 경로, 승인 절차)
- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md`를 실제 Sprint 진행에 맞게 갱신

### GitHub 백업 브랜치

- 브랜치 `backup-sprint14-20260713` 생성
- 커밋 `c73c135d92149f1c67b2b4c8209b750850792a03` — Backup Sprint 14 local work before Supabase migration
- `main` 미병합 상태로 로컬 작업 보존
- Supabase MCP 연결 완료 (쓰기 전 사용자 승인)

### Sprint 14 — COSRX 1차 등록·검증 대기 (진행 중)

- 로컬 `data/catalog/kr/cosrx-products.json` / `cosrx-offers.json` — 실제품 3개·offer 3개
- 가격 23,000 / 23,000 / 24,000 KRW, 공식몰 URL, 성분 임의 기입 없음
- offer: `unverified` + `stock unknown` → 핵심 Top 5 제외
- `/admin/catalog-review` 개발 전용 검증 대기 UI
- `product_offers` migration: `product_id bigint` FK, 최소 권한 RLS (원격 적용 완료)

---

## 2026-07-12

### `514f0f9` — Sprint 13
한국 카탈로그 템플릿·검증 도구

- `validateCatalogData` / `findDuplicateProducts`
- 한국 제품·offer CSV/JSON 템플릿 및 sample
- `docs/29-korean-product-data-guide.md`
- 가짜 실상품·임의 가격 없이 입력·검증 구조만 구축

### `f9ca6e7` — Sprint 12
canonical 브랜드명 표준화

- `displayBrandName` / `BrandDisplayName` 레지스트리
- 오번역·오타 복구 (Peach Slices, Beauty of Joseon 등)
- 제품명·브랜드명 분리 표시
- 브랜드명 자동 번역 차단

### `e001baf` — Sprint 10
현재 제품 등록과 루틴 점검

- `CurrentProductInput` 및 analyze CRUD UI
- `reviewCurrentRoutine` / 결과 페이지 「현재 루틴 점검」
- 프롬프트·mock과 연동

### `7136a88` — Sprint 9
알레르기·회피 성분 안전 필터

- 알레르기/회피 성분 입력·저장
- `filterCandidatesBySafety` 등 추천 전 안전 필터
- 결과 UI 반영

### `1895221` — Sprint 8
핵심 추천 제품 분리와 성분 표시명 표준화

- 결과 페이지 「나를 위한 핵심 추천 제품」Top 5와 「다른 제품 둘러보기」분리
- 탐색 목록 기본 미리보기 + 더 보기/접기
- Top 5와 중복되지 않도록 탐색 목록에서 핵심 추천 제품 제외
- 성분명 표준화 (한국어·영어·일본어 표시명, 한국어 UI에서 일본어 표기 혼입 방지)
- 추천 카드·분석 가이드·탐색 배지에 표준 표시명 적용

### `61393cd` — Sprint 7
확장된 AI 분석 결과 UI 개선

- 확장 필드 표시 규칙 정리 (빈 값은 숨김)
- 관리 단계(`managementLevel`) 한글 표기
- `expert_first` / `urgent_check` 최상단 경고
- 화장품의 한계·전문가 상담 사유를 제품 목록보다 앞에 배치
- 아침/저녁 루틴 구분, 분석 신뢰도 % 표시

### `53b1507` — Sprint 6
확장된 AI 분석 결과를 결과 페이지에 연결

- 분석/Mock 성공 후 `/results` 자동 이동
- 분석·추천·소스 정보를 LocalStorage에 저장
- 결과 페이지에서 확장 AI 가이드와 Top 5를 함께 표시
- 필요 시 분석 결과로 요약·피부 타입 폴백

### `b183fe4` — Sprint 5
AI 피부 관리 안내와 안전 응답 구조 확장

- Master Plan 기준 확장 Recommendation 필드 추가
- 안전 원칙 반영 프롬프트·응답 검증
- Mock 응답에 확장 필드 포함
- (관련) `063111c` — 멀티 프로바이더 서버 AI API, 브라우저 직접 AI 호출 제거

### 운영 문서

- `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md` 작성 및 UTF-8 한글 복구

---

## 이전 (요약)

| 커밋 | 요약 |
|------|------|
| `20fd9b2` | Sprint 4: 결과 페이지와 추천 파이프라인 연결 |
| `5b7c037` | Sprint 3 Phase 2C: 캐논컬 성분 매칭 개선 |
| `99932a6` | Sprint 3 Phase 2A: 성분 정규화 및 랭킹 개선 |

더 이른 Sprint 상세는 Git 이력과 `docs/`를 참고한다.
