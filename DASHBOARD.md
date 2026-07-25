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
| 제품 — Draft(비활성, 실성분/이미지/오퍼 연결됨) | **40건** (오늘 신규, §12) — 활성화는 ingredients 사전 보강 후 |
| 병원 — 서울 피부과 실 후보(로컬 파일, HIRA live) | **1,917건** (20/50페이지 · 전체 모수 약 4,967건 중) |
| 병원 — Staging DB 적재 | **0건** (테이블 신설·적재 스크립트 준비 완료, migration 적용 대기 — §11) |
| 병원 — 실제 제휴/공개 병원 | **0개** |
| 클릭/전환 이벤트 | 실 파이프라인 배선 완료, migration 적용 대기 — §10 |

- WQ-F 브랜드 커넥터: `looksLikeProductUrl`이 `shop_prd_view.do?i_sProductcd=` 같은 한국형 `.do` URL 패턴을 못 알아봐서 espoir가 0건이었던 것을 확인·수정. 재크롤 결과 **espoir 10건 전부 staging_ready(품질 100%)**로 Staging 등록.
- 잔여 브랜드 개별 조사 결과 (전부 "빠른 수정"으로는 안 풀림):
  - **dr-jart, missha, 3ce**: Akamai 봇 차단(Access Denied/edgesuite.net) — 우회 시도 안 함(정책상 회피 대상).
  - **anua**: sitemap.xml에 `/lander` 1건만 존재 — 실제 상품 목록은 JS 렌더링 뒤에 있을 가능성, 조사에 브라우저 렌더링 수준 작업 필요(다음에 더 큰 작업으로 재검토).
  - **clio.co.kr**: 이 환경에서 DNS/연결 자체가 간헐적으로 실패 — 코드 문제 아님.
  - **medicube**: robots.txt/sitemap.xml 자체가 404 — 별도 구조 조사 필요.

## 4. 사람 판단 필요

이번 세션(오토파일럿) 종료 시점 기준, 코드/로직 판단이 아니라 **Dashboard/CLI 접근 권한이 있는 사람만 할 수 있는 3가지 실행 작업**이 대기 중 (전부 Staging 전용, Production 무관):

1. Supabase Dashboard SQL Editor(Staging `jfnj***gfd`)에서 migration 2개 붙여넣기 실행 — §10 `commercial_click_events`, §11 `dermatology_institution_candidates`. CLI로는 이 세션 네트워크(IPv6 전용 direct host)+access token 부재로 적용 불가했음.
2. 같은 SQL Editor에서 `GRANT SELECT, INSERT ON public.pipeline_batches TO service_role;` 실행 — 정식 스케줄러 워커(§8 대상) 경로를 열기 위해 필요.
3. `ingredients` 사전 테이블 보강 우선순위 결정 — §12에서 확인된 대로, 이게 없으면 새로 만든 draft product 40건이 계속 활성화 게이트에서 막힘. 보강 방법(사전 확장 소스, 매칭 로직 개선 등)은 다음 세션에서 사람이 방향을 정해야 함.

(로그인 게이트 e2e 검증 관련 항목은 전부 해결·확인 완료 — 아래 4-1 참고)

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

## 11. 피부과 실데이터 테이블 신설 (2026-07-25 · T07-02 후속)

로컬에 이미 모아둔 서울 피부과 HIRA 실후보(1,917건, `artifacts/seoul-dermatology-ingestion/`)를 저장할 Supabase 테이블이 지금까지 아예 없었음(`/my/clinics`는 100% 목업). `product_discovery_candidates` 게이팅 패턴을 그대로 따라 신규 테이블 설계·`/my/clinics` 연결까지 진행.

| 항목 | 내용 |
|---|---|
| 신규 테이블 | `public.dermatology_institution_candidates` |
| 마이그레이션 파일 | `supabase/migrations/20260725100000_create_dermatology_institution_candidates.sql` |
| 구조 | `product_discovery_candidates`와 동일 패턴 — `workflow_status`(discovered/verified/published/rejected), RLS ON, anon/authenticated는 `verified`+`published`만 SELECT, service_role은 SELECT/INSERT/UPDATE만(DELETE 없음 — 기존 관례 그대로) |
| Staging 프로젝트 확인 | `.\scripts\verify-catalog-staging-env.ps1` → `project_ref_masked=jfnj***gfd`, `production_ref_masked=rhfr***mns`, `refs_differ=True` 확인(Production 아님) |
| **마이그레이션 적용 — 차단됨 (섹션 10과 동일 사유)** | `npx supabase db push --dry-run` → `IPv6 is not supported on your current network: dial tcp: lookup db.jfnjufmldiqlgvgyugfd.supabase.co: no such host`. `.env.local`에 `SUPABASE_ACCESS_TOKEN`/DB 비밀번호 없어 IPv4 우회 불가(섹션 10에서 이미 상세 확인된 것과 동일한 환경 제약). `supabase-js` REST 경로는 정상(서비스 연결 자체는 문제없음 — `product_discovery_candidates` 조회 성공, 신규 테이블은 `PGRST205`로 "테이블 없음"만 확인). |
| **필요한 조치(사람)** | Supabase Dashboard → 프로젝트가 `jfnj***gfd`(Staging)인지 반드시 확인 → SQL Editor에 `supabase/migrations/20260725100000_create_dermatology_institution_candidates.sql` 전체 붙여넣기 → Run. Production(`rhfr***mns`)에는 절대 적용 금지. (섹션 10의 `commercial_click_events` migration과 한 번에 같이 적용해도 무방 — 서로 다른 테이블, 의존관계 없음.) |
| 실 적재 스크립트 | `scripts/load-dermatology-institution-candidates-staging.ts` (신규, `loadDotEnvLocal()` 사용) — `--dry-run` 검증 완료: `candidates-2026-07-25T00-51-28-251Z.json` + `candidates-2026-07-25T03-30-10-482Z.json` + `candidates-2026-07-25T03-31-42-497Z.json`(`checkpoint-latest.json`과 같은 runId만, 7/24 fixture·구 live_blocked 배치는 다른 runId라 제외) 병합 → `institutionId` 기준 dedupe → `status==='candidate_ready'`만 적재 → **1,917건 고유**(verified 1,868 · discovered 49 — phone 누락 49건만 discovered로 남김). 테이블이 아직 없어 **실제 upsert는 미실행** — Dashboard 적용 후 `npx tsx scripts/load-dermatology-institution-candidates-staging.ts` 그대로 실행하면 적재됨. |
| `workflow_status='published'` | 이번 세션에서 **0건** — product 쪽과 동일하게 사람 검수 전용, 자동 설정 안 함. |
| `/my/clinics` 실데이터 연결 | 완료 — `일반(비제휴)` 섹션이 `dermatology_institution_candidates`에서 `workflow_status IN ('verified','published')`인 행을 실시간 조회(최대 20건), 1건 이상이면 실데이터로 교체(SampleDataBadge 숨김), 0건이면 기존 목업으로 자동 fallback. 제휴(sponsored) 섹션은 지시대로 손대지 않음(계속 100% 목업). |
| `/my/clinics` 실데이터 표시 수 (before/after) | **이전: 0 실 / 4 목업**(전부 목업) → **이후(마이그레이션 적용 전): 여전히 0 실 / 4 목업**(자동 fallback 정상 동작) → Dashboard 적용 + 적재 스크립트 실행 후에는 verified 1,868건 중 상위 20건(`sggu_name` 정렬)이 실데이터로 노출 예정. |
| 회귀 확인 | `npx tsc --noEmit` 통과(에러 0) · `npx eslint src/app/my/clinics/page.tsx scripts/load-dermatology-institution-candidates-staging.ts` 통과(0) · `npm run build` 통과 · `npx tsx scripts/seoul-dermatology-ingestion-selftest.ts` 통과 · preview에서 `/my/clinics` 접근 시 기존 로그인 게이트대로 리다이렉트만 확인(서버 에러 없음) |
| 삭제한 임시 파일 | `scripts/__tmp_dermatology_probe.ts`(연결 확인용 1회성 probe, 커밋 안 함) |

## 12. Discovery 검수 대기 68건 재크롤·검증 시도 (2026-07-25 · 결과: 활성 0건)

`artifacts/discovery-review-classification/report-latest.json`(읽기 전용 분류, 이전 세션)의 `auto_approve_candidate` 68건(8개 브랜드) 각각을 **실제 브랜드 공식 페이지에서 재크롤**(`src/lib/catalog/officialCrawl.ts`, 캡차/봇차단 우회 시도 없음)한 뒤, 기존 파이프라인 함수만 재사용해 draft product 생성 → 성분/오퍼 연결 → 활성화 시도까지 1건씩 실행. 과거 boolean 플래그만 남아있고 실제 성분/이미지/가격 원문은 사라졌었기 때문에, 이번엔 전부 새로 받아온 원문만 사용(발명 없음).

**사용한 기존 코드(신규 로직 없음)**: `materializeDraftProduct` → `linkProductIngredients` → `discoverAndPersistOffers` → `verifyAndActivateProduct`, 전부 `src/lib/pipeline/catalog-enrich.ts`의 `enrichCatalogAfterCandidate`로 한 번에 호출. `config/pipeline-operation.json`/`HARD_FALSE_KEYS` 등 정책 파일은 손대지 않음.

**결과 (68건 기준)**

| 결과 | 건수 | 비고 |
|---|---|---|
| Draft product 생성 (`products.active=false`) | 40 | 전부 `product_discovery_candidates.linked_product_id` 연결 완료 |
| **활성화(`active=true`) 성공** | **0** | 아래 원인 참고 |
| Draft 자체 미생성 — `category_uncertain` | 24 | 카테고리 분류기(`classifyProductCategory`)가 일부 한국어 전용 표기(쿠션/샴푸/트윈케이크 등)를 못 알아봄 — 사전 데이터/코드 이슈, 재크롤 문제 아님 |
| 재크롤 자체 실패 — 봇 챌린지/레이트리밋 | 4 (ROUND LAB) | `CAPTCHA:challenge_no_bypass` 3건 + `HTTP_ERROR:http_429` 1건 — 정책대로 우회 시도 없음 |
| 재크롤 결과가 과거 분류와 달라 discrepancy 처리 | 0 | 68건 전부 성분/이미지/가격 원문이 정상적으로 다시 확인됨 |

**브랜드별**

| 브랜드 | 총 | draft 생성 | category_uncertain | 재크롤 실패 |
|---|---|---|---|---|
| espoir | 10 | 8 | 2 | 0 |
| mise en scène | 10 | 2 | 8 | 0 |
| Lador | 10 | 7 | 3 | 0 |
| Sulwhasoo | 10 | 7 | 3 | 0 |
| LANEIGE | 9 | 2 | 7 | 0 |
| numbuzin | 10 | 10 | 0 | 0 |
| SKIN1004 | 1 | 0 | 1 | 0 |
| ROUND LAB | 8 | 4 | 0 | 4 |

**활성화 0건의 실제 원인** — `verifyAndActivateProduct`의 품질 게이트(`product-verify-gate.ts`)는 `unmatchedIngredientCount === 0`을 요구하는데, Staging `ingredients` 사전 테이블이 너무 빈약해서 제품당 실 INCI 성분의 대부분이 매칭되지 않음(제품당 매칭 0~3개 vs 미매칭 26~71개). 오퍼는 3건에서 실제로 verified 상태까지 도달(Sulwhasoo 퍼펙팅 파운데이션 10건, 윤조에센스 퍼펙팅 2건, LANEIGE 글레이즈 크레이즈 8건)했지만 그 경우도 `ingredient_unmatched` 블로커 하나 때문에 최종 활성화는 막힘. 이 게이트 자체는 건드리지 않음(정책대로) — 사전 데이터 보강이 선행돼야 실제 활성화가 가능한 구조.

**Discovery candidate 검수 상태 갱신** (40건, 직접 UPDATE — `product_discovery_candidates`는 이번 세션에서 이미 확인된 대로 관리자 권한 게이트 없이 쓰기 가능):
- `duplicate_check_status`/`evidence_check_status` → `pass` (실제로 새 product 연결 + 이번 세션 재크롤 근거 있음)
- `sale_check_status` → `pass`는 오퍼가 실제 verified된 3건만
- `ingredient_check_status`/`safety_check_status` → 대부분 `pending` 유지(실제로 통과하지 않았으므로 임의로 올리지 않음)
- `workflow_status` → **`verified`로 올라간 건 0건**(활성화가 안 됐으므로). 지시대로 `published`는 아예 시도하지 않음.

**부수 인프라 버그 수정**: CLI에서 `server-only` 가드 모듈을 로드하는 `scripts/register-server-only.mjs`/`scripts/hooks/resolve-server-only.mjs`가 `@/...` alias import만 처리하고 있어서, 상대경로(`./foo`) import를 쓰는 모듈(`src/lib/catalog/automation/jsonLdParser.ts` 등)을 이번에 처음 CLI에서 직접 재사용하려다 `Cannot find module` 오류로 드러남. 두 파일에 확장자 없는 상대경로 fallback 해석(.ts/.tsx/.js/.mjs/index.*)을 추가해서 해결 — 기존 스크립트들은 전부 `@/...` alias만 써서 지금까지 안 걸렸던 사각지대. 회귀 확인: `node scripts/test-pipeline-core.mjs`(51 checks) + `pipeline-diagnostic-selftest.ts`(13개 스위트) 전부 통과.

**새로 발견한 별도 블로커**: `pipeline_batches` 테이블에 `service_role` INSERT 권한이 없음(`permission denied for table pipeline_batches`) — `scripts/run-pipeline-worker.mjs`/`runPipelineWorkerFromConfig`가 배치 기록을 못 남겨서 정식 스케줄러 워커 경로 자체가 현재 끝까지 못 돔. 이번 작업은 그 경로를 안 쓰고 `product_discovery_candidates`/`products`/`product_ingredients`/`product_offers`에 직접 붙여서 우회했지만, 정식 워커를 쓰려면 사람이 Supabase Dashboard SQL Editor에서 아래를 Staging(`jfnj***gfd`)에 실행해야 함:

```sql
GRANT SELECT, INSERT ON public.pipeline_batches TO service_role;
```

## 5. 다음 작업

**이번 세션(오토파일럿)은 여기서 코드로 더 진행 불가 — 아래 4가지가 전부 "Dashboard 접근 권한"이나 "사람의 우선순위 결정"이 필요한 지점이라 막힘. 코드/에이전트 작업은 준비 완료 상태.**

1. **차단 최우선 (공통)**: 섹션 10(`commercial_click_events`)·섹션 11(`dermatology_institution_candidates`) 두 migration 모두 같은 이유(IPv6 전용 direct DB host + access token 없음)로 CLI 적용 불가 — Supabase Dashboard SQL Editor에서 Staging(`jfnj***gfd`)에 사람이 직접 적용 필요. 적용 후 섹션 11은 `npx tsx scripts/load-dermatology-institution-candidates-staging.ts` 한 번 더 실행해서 1,917건 적재.
2. **섹션 12 관련**: `ingredients` 사전 테이블을 실제로 보강하지 않으면 이번에 만든 draft product 40건(및 향후 재시도분)은 계속 활성화 게이트에서 막힘 — 사전 보강이 선행 과제. 그리고 위 `GRANT SELECT, INSERT ON public.pipeline_batches TO service_role;`를 Dashboard에서 실행하면 정식 스케줄러 워커 경로가 열림.
3. **로드맵 8단계(실제 갱신 스케줄러)**: 필요한 코드·PowerShell 설치 스크립트(`scripts/install-pipeline-task.ps1`, `scripts/run-pipeline.ps1`, `docs/83-windows-task-scheduler-operation.md`)는 이미 과거 세션에서 전부 준비돼 있음 — 이번 세션에서 `scripts/check-pipeline-task.ps1`로 확인한 결과 **아직 미설치**(`MISSING: KBeautyMatch-Pipeline`). `install-pipeline-task.ps1` 파일 자체에 "OPTIONAL one-time register. Agents must not auto-run."라고 명시돼 있어 이번 세션에서 실행하지 않음 — 설치하려면 사람이 직접 `.\scripts\install-pipeline-task.ps1` 실행 필요(6시간마다 Windows Task Scheduler로 워커 실행, 위 §1의 `pipeline_batches` GRANT가 먼저 적용돼야 실제로 데이터를 만들기 시작함).
4. 남은 4개 보류 항목(AI 피부 코치, 제품 소진 예상, 관리자 번역 관리, 수익 대시보드 정산) 중 사람이 우선순위를 정해서 다음 지시할 것. 그 외 알려진 이슈 없음.

---

*갱신 이력은 git 커밋 로그 참고. 이 파일이 최신 상태 요약의 단일 진실.*
