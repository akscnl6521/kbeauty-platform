# DASHBOARD.md — K-Beauty Match 스캐폴드 진행 현황

최종 갱신: 2026-07-25 (자동 갱신 — 채팅 보고 대신 이 파일을 최신 상태로 유지)

---

## 1. 11단계 화면 상태

| # | 단계 | 상태 | 경로 |
|---|------|------|------|
| 1 | 접속 | 기존 완성 | `/` |
| 2 | 국가/언어/통화 | **스캐폴드 완료** (언어·통화 select 신규 추가) | `/onboarding` |
| 3 | 문진 | 기존 완성 | `/quiz`, `/quiz/base`, `/quiz/hair`, `/quiz/lip`, `/quiz/mascara` |
| 4 | 사진 분석(선택) | 기존 완성 (사진 없이 진행 가능) | `/analyze` |
| 5 | 추천 결과 | 기존 완성 | `/results` |
| 6 | 루틴(아침/저녁) | **스캐폴드 완료** (AM/PM 섹션 신규 추가, 실데이터) | `/routine` |
| 7 | 구매처 화면 | **스캐폴드 완료** (신규, 샘플 데이터) | `/routine/purchase` |
| 8 | 저장 | **스캐폴드 완료** (신규 확인 화면) | `/routine/save` |
| 9 | 체크인(3/7/15/30일) | 기존 완성 | `/my/check-ins` |
| 10 | 피부과 추천 | **스캐폴드 완료** (신규 전용 화면, 안전 필터 자리 포함) | `/my/clinics` |
| 11 | 상담 리포트 | **스캐폴드 완료** (신규, 샘플 데이터) | `/my/consultation-report` |

## 1-1. 화면 내부 하위 기능 스캐폴드 (2026-07-25)

11개 화면 연결 완료 후, 화면 안에 비어있던 하위 기능 4곳을 같은 방식(샘플 데이터 표시 + 실제 로직은 자리만)으로 채움:

| 하위 기능 | 위치 | 상태 |
|---|---|---|
| 제품 사용 영상 자리 | `/routine/purchase` (썸네일+재생 아이콘 모달, 도포량/순서/부위 더미) | 완료 · `UsageVideoModal` |
| 광고/제휴 뱃지 자리 | `/routine/purchase`, `/my/clinics` (`CommercialBadge`, 기본 `show=false`) | 완료 |
| 클릭 추적 자리 | 구매처 링크·피부과→상담리포트 CTA (`trackScaffoldClick`, console.log만) | 완료 |
| 마지막 확인일 표시 | 구매처 카드("마지막 확인일"), 피부과 카드("정보 확인일") | 완료 |
| 알림 동의 체크박스 | `/onboarding` 마지막 단계 (localStorage 저장만, 실 발송 없음) | 완료 |
| 상담 정보 전달 동의 체크박스 | `/onboarding` 마지막 단계 (localStorage 저장만, 실 전달 없음) | 완료 |

검수(discovery review) 작업은 사용자 지시로 이번엔 다루지 않음 — 플랫폼 구조와 무관, 별도 처리 예정.

## 2. 전체 진행률

**11 / 11 화면 클릭 연결 완료** (기존 완성 5 + 오늘 스캐폴드 신규 6)

- 접속 → 국가/언어/통화 → 문진 → 사진 분석 → 추천 결과 → 루틴(아침/저녁) → 구매처 → 저장 → 체크인 → 피부과 추천 → 상담 리포트, 전 구간 링크로 연결됨.
- 완료 기준 12가지(EXECUTION_CONTRACT.md §7)는 이번 스캐폴드 구간에는 **미적용** — 화면 존재·연결만 보장, 실데이터·검수·품질은 별도.

## 3. 데이터 현황 (2026-07-25 기준)

| 항목 | 수치 |
|------|------|
| 제품 — Staging 실 활성(`products`) | **20개** |
| 제품 — Discovery 검수 대기(`discovered`+`needs_review`) | **234건** |
| 제품 — Discovery 누적(대부분 과거 placeholder, rejected 1,085 포함) | 1,319건 |
| 병원 — 서울 피부과 실 후보(로컬 파일, HIRA live) | **1,917건** (20/50페이지 · 전체 모수 약 4,967건 중) |
| 병원 — 실제 제휴/공개 병원 | **0개** |

- WQ-F 브랜드 커넥터: `looksLikeProductUrl`이 `shop_prd_view.do?i_sProductcd=` 같은 한국형 `.do` URL 패턴을 못 알아봐서 espoir가 0건이었던 것을 확인·수정. 재크롤 결과 **espoir 10건 전부 staging_ready(품질 100%)**로 Staging 등록.
- 잔여 브랜드 개별 조사 결과 (전부 "빠른 수정"으로는 안 풀림):
  - **dr-jart, missha, 3ce**: Akamai 봇 차단(Access Denied/edgesuite.net) — 우회 시도 안 함(정책상 회피 대상).
  - **anua**: sitemap.xml에 `/lander` 1건만 존재 — 실제 상품 목록은 JS 렌더링 뒤에 있을 가능성, 조사에 브라우저 렌더링 수준 작업 필요(다음에 더 큰 작업으로 재검토).
  - **clio.co.kr**: 이 환경에서 DNS/연결 자체가 간헐적으로 실패 — 코드 문제 아님.
  - **medicube**: robots.txt/sitemap.xml 자체가 404 — 별도 구조 조사 필요.

## 4. 사람 판단 필요

없음. (로그인 게이트 e2e 검증 관련 항목은 전부 해결·확인 완료 — 아래 4-1 참고)

## 4-1. 확인 완료 (더 이상 사람 판단 불필요)

- **로그인 게이트 화면 4/4 e2e 전부 통과** (customer + admin 양쪽). 사용자가 Staging Auth 이메일 자동 확인을 활성화하고, `docs/47-admin-auth-migration-review.md` §8 템플릿으로 고정 테스트 계정(`e2e-admin-reviewer@kbeauty-match-test.com`)을 `reviewer` role로 직접 bootstrap한 뒤, 실제 로그인 + Playwright 방문으로 최종 확인:
  - `/my/check-ins` (throwaway 고객 계정): "체크인" 렌더링, 빈 상태 정상 표시
  - `/my/clinics` (throwaway 고객 계정): "피부과 추천" + 샘플 데이터 배지 + 안전 필터 자리 3항목 전부 렌더링
  - `/my/consultation-report` (throwaway 고객 계정): "상담 리포트" + 샘플 데이터 배지 + 고민/루틴 요약 렌더링
  - `/admin/discovery` (고정 admin 계정): "제품 발견 후보" · "읽기 전용" · 실 후보 수 "총 1,319개" · workflow status 필터 전부 렌더링 확인
  - 과정에서 로컬 dev 서버 설정 문제 2건 발견·수정(둘 다 `.env.local`, gitignore 대상, 커밋 안 됨):
    1. `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` 누락 → 브라우저 클라이언트가 placeholder `example.supabase.co`로 요청 → 로그인 자체가 항상 실패.
    2. `SUPABASE_SERVICE_ROLE_KEY` 누락 → 서버 사이드 admin 세션 확인(`getAdminSession`)이 "서버 설정 미완료"로 실패 → `/admin/discovery`가 항상 차단 화면 표시.
  - 리포트: `artifacts/scaffold-journey-e2e/report-latest.json` (로컬, gitignore 대상)
  - 남은 부작용: throwaway 고객 테스트 계정들의 auth.users row가 Staging에 누적됨(Admin API로 삭제 불가 — 무해한 테스트 데이터, Production 아님). 고정 admin 계정(`e2e-admin-reviewer@...`)은 앞으로 재사용 가능.
- **검수 대기 234건용 관리자 화면은 이미 있고 실제로 작동함** — `/admin/discovery` (목록·검색·workflow status/국가/출처/연결/담당 필터·정렬·페이지네이션) + `/admin/discovery/[id]` (상세) + `DiscoveryWritePanel`(PATCH로 duplicate/sale/ingredients/evidence/safety/publish 검토 큐 생성, role 기반 `canPublish` 등 실제 쓰기 액션 포함). **새 화면을 만들 필요는 없음.**

## 6. 마스터플랜 전수 점검 (2026-07-25 · 조사만, 코드 변경 없음)

MASTER_PLAN.md 섹션 2~21(+26, 41 일부) 전체를 다시 훑어서, 지금까지 스캐폴드한 11개 화면·6개 하위 기능 외에 마스터플랜에 언급된 항목들의 실제 존재 여부만 확인. 품질 평가·구현 방법 제안 없음.

| 마스터플랜 항목 | 섹션 번호 | 현재 상태 | 비고 |
|---|---|---|---|
| 화장품 관리 가능/불가능 범위 설명 화면 | 14 | 완료 | `src/app/results/page.tsx`에 "화장품으로 관리 가능한 범위"·"화장품의 한계" 블록 존재 |
| 알레르기·회피 성분 입력 화면(온보딩과 별개) | 15.1 | 완료 | `src/app/my/profile/page.tsx`에 알레르기·회피 성분 전용 텍스트 입력 필드 존재 |
| 현재 제품 중복·충돌·과도한 단계 점검 로직 | 16 | 완료 | `src/lib/care/conflicts.ts`, `src/lib/care/routine-suggestions.ts` 존재 · `/my/routine`에 표시 |
| 추천하지 않는 제품과 이유 표시(제품 단위) | 15.4 | **완료 (2026-07-25)** | `/results`에 "추천 후보에서 제외된 제품" 블록 추가 · `filterCandidatesBySafety.ts`가 제품별 사유(알레르기·회피 성분/정보 부족) 반환하도록 확장 |
| 루틴 유지/조정/중단 화면 | 20 | 완료 | `/my/check-ins/[id]`의 `RoutineAdjustmentPanel`(onKeepCurrent/onApply/onUndo) — 단, 체크인 화면 안에 있고 독립 상시 화면은 아님 |
| 재방문 개인 대시보드 | 19 | 완료 | `src/app/my/page.tsx` 존재 |
| 관리자 수익 대시보드 | 41 | 부분 | `/admin/commerce`에 클릭/리드/전환 카운트만 · 정산·고지 로그·금액 집계 없음 (정산 부분은 보류 — 로드맵 후반) |
| AI 피부 코치 | 21 | 없음 | (보류 — 로드맵 후반) |
| 전신 부위별 분석 화면(손·팔·다리·겨드랑이·등 등) | 11 | **완료 (2026-07-25)** | `/quiz/body` 신규 (다중 선택, localStorage 저장만·추천 로직 미반영) · 홈에 "전신 부위 문진" 링크 추가 |
| 점진적 프로필 완성도 표시 | 19 | **완료 (2026-07-25)** | `/my`에 진행바 + "O%" + 미입력 항목 링크(최대 3개) 추가. 계산 기준 5개(문진·분석, 알레르기/회피 성분, 전신 부위 문진, 현재 사용 제품, 알림 동의) — 전부 기존 저장값 조합만 사용, 새 수집 로직 없음. "추천 정확도 영향" 같은 과장 문구 없음 |
| 제품 소진 예상 표시 | 19 | 없음 | (보류 — 로드맵 후반) |
| 관리자 번역 관리 화면 | 26 | 없음 | (보류 — 로드맵 후반) |
| 스킨케어·메이크업 추천 분리 | 13 | 완료 | `quiz/base`(스킨케어) vs `quiz/lip`·`quiz/mascara`(메이크업) 분리 |
| 제품 버전 관리 | 17 | 완료 | `src/lib/catalog/variants/variantModel.ts` 존재 |
| 판매처 신뢰 등급 | 18 | 완료 | `src/lib/pipeline/offers/offer-source-class.ts` 존재 |

## 1-2. 마스터플랜 갭 처리 (2026-07-25)

전수 점검(섹션 6) 15개 중 2개 처리, 5개 보류:

| 항목 | 처리 |
|---|---|
| 전신 부위별 분석 화면 | **완료** — `/quiz/body` 신규 |
| 추천하지 않는 제품과 이유 표시(제품 단위) | **완료** — `/results`에 제품별 제외 사유 노출 |
| 점진적 프로필 완성도 표시 | **완료 (2026-07-25)** — `/my`에 진행바 추가 |
| AI 피부 코치 | 보류 — 로드맵 후반 |
| 제품 소진 예상 표시 | 보류 — 로드맵 후반 |
| 관리자 번역 관리 화면 | 보류 — 로드맵 후반 |
| 관리자 수익 대시보드 정산 | 보류 — 로드맵 후반 |

## 7. 통합 검증 1차 점검 (2026-07-25 · 로드맵 9단계 중 가벼운 항목만)

오늘 신규 화면 6개(`/onboarding`, `/routine/purchase`, `/routine/save`, `/my/clinics`, `/my/consultation-report`, `/quiz/body`) 대상. 전체 접근성 감사·성능 튜닝·보안 하드닝은 출시 직전 별도 작업으로 **미실시**.

| 점검 항목 | 결과 | 조치 |
|---|---|---|
| 모바일 375px 반응형 | **확인함, 문제없음** — 6개 화면 전부 가로 스크롤/overflow 없음(Playwright + DOM `scrollWidth` 실측, 로그인 게이트 3곳은 실 로그인 후 확인) | 없음 |
| 의료 표현 문구 | 6개 화면 grep 점검("~병입니다/치료하세요/확진" 등) — 매칭 없음. 다만 `/my/consultation-report`의 "위험 신호 점검" 항목이 단정적으로 읽힐 수 있어 문구 조정 | **수정**: "최근 2주 내 급격한 악화 없음" → "사용자 응답 기준 최근 2주 내 급격한 악화 보고 없음" |
| 광고·제휴 고지 노출 | `CommercialBadge`가 "광고"/"제휴" 단어만 표시하고 의미 설명이 없었음 | **수정**: 배지에 전체 문구 tooltip(`title`) 추가 + `/my/clinics` 제휴 섹션 헤더를 "제휴 병원 · 상담 연결 시 병원이 운영사에 수수료를 지급할 수 있습니다..." 명시 문구로 교체 |

## 8. 오늘 마무리 (2026-07-25)

새 기능 추가 없음 — 안전 저장 + 문서 정리만.

**전체 회귀 테스트**
- `tsc` (전체): **통과**, 에러 0
- `eslint` (전체): **통과**, 에러/경고 0
- `npm run build` (전체): **통과**, 에러 0
- 기존 test suite 108건 (오늘 안 만진 파일 포함 전체):
  - 104건 **통과** (`test:scaffold-journey-e2e` 포함 105건 실행 기준으로는 105건 통과)
  - 3건 **실패**(당시): `test:checkin-email-provider`, `test:checkin-email-resend`, `test:checkin-email-test-api` — 원인은 `SITE_URL` 미설정. **→ 섹션 9에서 해결, 현재 108/108 통과.**

**Push**
- 원격(`origin/feature/recommendation-usage-guide-display-20260720`)과 동기화 확인 — 오늘 세션 전체 커밋이 이미 매 단계 push되어 있었음(추가 push 불필요, 확인만).
- 오늘 세션 시작 커밋: `a4f4a6f`(스캐폴드 첫 화면) → 최신 `1b236e1`(문서 갱신), 총 20개 커밋.
- main 병합·Production 배포 없음.

**문서 갱신**
- `PROJECT_STATUS.md`: 2026-07-25 항목 추가 완료.
- `CHANGELOG.md`: 2026-07-25 항목 추가 완료.
- `DASHBOARD.md`: 이 섹션 포함 최신.

## 9. 후속 처리 (2026-07-25 · SITE_URL + 프로필 완성도)

- **이메일 테스트 3건 전부 통과, 108/108** — `.env.local`에 `SITE_URL`만 추가하는 걸로는 안 됐음: `checkin-email-*-selftest.ts`는 `npx tsx`로 바로 실행되는 스크립트라 Next.js처럼 `.env.local`을 자동으로 안 읽음. `scripts/_loadDotEnvLocal.ts`(신규, 의존성 추가 없이 기존 코드 스타일 그대로)를 만들어 3개 selftest 맨 위에서 호출하도록 수정 — 그 다음에야 통과. `SITE_URL` 값 자체는 비밀 아님(Staging 브랜치 alias URL), `.env.local`은 gitignore 대상이라 커밋 안 됨.
- **프로필 완성도 표시 완료** — `/my` 대시보드에 진행바 추가. 위 표(섹션 6, 1-2) 참고.

## 10. 클릭/전환 추적 실 파이프라인 배선 (2026-07-25 · 로드맵 7단계 "수익화 구조")

기존에 잘 설계돼 있던 순수 함수 계층(`src/lib/commercial/revenueReadiness/clickConversionEvents.ts` — `validateClickConversionEvent`/`scrubEventForAnalytics`, 건강/증상 타기팅 금지 경계)을 실제 영속 계층에 배선.

**신규 테이블 + migration**
- `supabase/migrations/20260725130000_create_commercial_click_events.sql`
- 테이블: `public.commercial_click_events` (append-only, `event_id` UNIQUE로 재시도 dedup)
  - 컬럼: `event_id, kind, lane, entity_type, entity_id, offer_or_placement_id, country_code, revenue_amount, currency, session_ref, screen, created_at` — `ANALYTICS_ALLOWED_EVENT_FIELDS`와 1:1 대응 + 최소 추가(익명 `session_ref`, `screen`). 건강/증상/뷰티프로필 필드는 컬럼 자체가 없음(저장 자체가 불가능한 구조).
  - RLS: `ENABLE ROW LEVEL SECURITY` + anon/authenticated 전체 REVOKE. `service_role`에 `SELECT, INSERT`만 GRANT — `UPDATE`/`DELETE` 없음(append-only, checkin_email_queue보다 더 엄격).

**실제 배선**
- `src/app/api/track/click/route.ts` (신규) — 클라이언트 POST를 받아 `validateClickConversionEvent` → `scrubEventForAnalytics` 통과 후 `createSupabaseAdminClient()`로 `commercial_click_events`에 INSERT. 거부 사유(건강 타기팅 등)는 400으로 반환, 중복 `event_id`(23505)는 `deduped:true`로 성공 처리.
- `src/lib/scaffold/clickTrackingStub.ts` — `trackScaffoldClick`의 본문을 실제 `fetch("/api/track/click", { keepalive: true })` fire-and-forget 호출로 교체. `console.log`는 개발 확인용으로 유지. 세션 참조는 `sessionStorage`에 저장하는 익명 `crypto.randomUUID()`(실 유저 id/이메일 아님).
- 호출부 변경 없음(시그니처 동일) — `src/app/routine/purchase/page.tsx`, `src/app/my/clinics/page.tsx` 두 곳이 그대로 실 이벤트를 생성.

**검증 시도 및 차단 사유 (그대로 기록)**
- `npx tsc --noEmit` 전체 통과, 에러 0.
- REST 연결은 정상 확인: `NEXT_PUBLIC_SUPABASE_URL`(Staging `jfnj***gfd`)로 `supabase-js` SELECT/INSERT 요청 시 `PGRST205`(테이블 없음)만 반환 — 즉 인증·네트워크·연결 자체는 문제없고, **migration이 실제로 Staging DB에 적용되지 않은 상태**만 확인됨.
- **migration 적용 자체가 이번 세션 환경에서 차단됨**: `npx supabase db push --dry-run`, `npx supabase db query --linked` 둘 다 `LegacyDbConfigIpv6Error`(`IPv6 is not supported on your current network`) — direct DB host(`db.jfnjufmldiqlgvgyugfd.supabase.co`)가 IPv6 전용이라 이 네트워크에서 연결 불가. CLI 제안대로 `supabase link --project-ref jfnjufmldiqlgvgyugfd`(IPv4 pooler 설정)를 시도하면 `LegacyPlatformAuthRequiredError`(`SUPABASE_ACCESS_TOKEN` 필요) — 이 저장소/환경 어디에도(`.env.local`, `.env.staging`, OS 환경변수, `~/.supabase/`) Personal Access Token이나 DB 비밀번호가 없어 IPv4 경로 설정도 불가능.
- **정확한 해결 방법**: 다음 중 하나가 있는 세션/환경에서 재실행하면 즉시 풀림.
  1. `SUPABASE_ACCESS_TOKEN` 환경변수 설정 후 `supabase link --project-ref jfnjufmldiqlgvgyugfd` → `npx supabase db push`
  2. 또는 IPv6 라우팅이 되는 네트워크에서 그대로 `npx supabase db push`
  3. 적용 후 재검증: `commercial_click_events`에 대해 `select`/`insert` 재시도 — 이번 세션에서 이미 확인했듯 `PGRST205`가 사라지면 성공.
- 코드(테이블 스키마, RLS, API route, 클릭 배선)는 전부 준비 완료 — **DB에 실제로 테이블만 아직 없는 상태**이며, 위 명령 1~2개만 실행하면 그대로 실제 row가 쌓임(로직 변경 불필요).

## 5. 다음 작업

1. **차단 최우선**: 위 섹션 10의 migration 적용(`SUPABASE_ACCESS_TOKEN` 확보 또는 IPv6 네트워크)만 하면 클릭 추적이 실제로 살아남 — 사람이 로컬(IPv6 되는 네트워크) 또는 access token 있는 환경에서 `npx supabase db push` 한 번 실행 필요.
2. 남은 4개 보류 항목(AI 피부 코치, 제품 소진 예상, 관리자 번역 관리, 수익 대시보드 정산) 중 사람이 우선순위를 정해서 다음 지시할 것. 그 외 알려진 이슈 없음.

---

*갱신 이력은 git 커밋 로그 참고. 이 파일이 최신 상태 요약의 단일 진실.*
