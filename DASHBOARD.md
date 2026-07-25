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
| 추천하지 않는 제품과 이유 표시(제품 단위) | 15.4 | 부분 | `/results`에 일반 텍스트 불릿만 · `filterCandidatesBySafety.ts`는 건수만 반환, 어떤 제품이 왜 제외됐는지는 UI 미노출 |
| 루틴 유지/조정/중단 화면 | 20 | 완료 | `/my/check-ins/[id]`의 `RoutineAdjustmentPanel`(onKeepCurrent/onApply/onUndo) — 단, 체크인 화면 안에 있고 독립 상시 화면은 아님 |
| 재방문 개인 대시보드 | 19 | 완료 | `src/app/my/page.tsx` 존재 |
| 관리자 수익 대시보드 | 41 | 부분 | `/admin/commerce`에 클릭/리드/전환 카운트만 · 정산·고지 로그·금액 집계 없음 |
| AI 피부 코치 | 21 | 없음 | coach 관련 화면·코드 전체 미발견 (패치 기록, 소진 예상, 계절 조정, 재구매 비교 전부 부재) |
| 전신 부위별 분석 화면(손·팔·다리·겨드랑이·등 등) | 11 | 없음 | quiz는 `base`(얼굴)/`hair`/`lip`/`mascara`만 존재, 전신 부위 화면 없음 |
| 점진적 프로필 완성도 표시 | 19 | 없음 | `completionPercent` 등 관련 코드 미발견 |
| 제품 소진 예상 표시 | 19 | 없음 | 소진일·잔여량 관련 필드 없음 |
| 관리자 번역 관리 화면 | 26 | 없음 | 번역은 `src/locales/{ko,en,ja}.json` 정적 파일뿐, 검수 상태·이력 admin 화면 없음 |
| 스킨케어·메이크업 추천 분리 | 13 | 완료 | `quiz/base`(스킨케어) vs `quiz/lip`·`quiz/mascara`(메이크업) 분리 |
| 제품 버전 관리 | 17 | 완료 | `src/lib/catalog/variants/variantModel.ts` 존재 |
| 판매처 신뢰 등급 | 18 | 완료 | `src/lib/pipeline/offers/offer-source-class.ts` 존재 |

## 5. 다음 작업

전수 점검 완료, 이번엔 코드 변경 없음. 위 표에서 "없음"/"부분" 항목 중 사람이 우선순위를 정해서 다음 지시할 것.

---

*갱신 이력은 git 커밋 로그 참고. 이 파일이 최신 상태 요약의 단일 진실.*
