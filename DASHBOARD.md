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

## 2. 전체 진행률

**11 / 11 화면 클릭 연결 완료** (기존 완성 5 + 오늘 스캐폴드 신규 6)

- 접속 → 국가/언어/통화 → 문진 → 사진 분석 → 추천 결과 → 루틴(아침/저녁) → 구매처 → 저장 → 체크인 → 피부과 추천 → 상담 리포트, 전 구간 링크로 연결됨.
- 완료 기준 12가지(EXECUTION_CONTRACT.md §7)는 이번 스캐폴드 구간에는 **미적용** — 화면 존재·연결만 보장, 실데이터·검수·품질은 별도.

## 3. 데이터 현황 (2026-07-25 기준)

| 항목 | 수치 |
|------|------|
| 제품 — Staging 실 활성(`products`) | **20개** |
| 제품 — Discovery 검수 대기(`discovered`+`needs_review`) | **224건** |
| 제품 — Discovery 누적(대부분 과거 placeholder, rejected 1,085 포함) | 1,309건 |
| 병원 — 서울 피부과 실 후보(로컬 파일, HIRA live) | **932건** |
| 병원 — 실제 제휴/공개 병원 | **0개** |

## 4. 사람 판단 필요

- **Staging Supabase Auth Admin API 키 형식 비호환** — `SUPABASE_SERVICE_ROLE_KEY`가 신형 `sb_secret_...` 포맷이라 GoTrue Admin API(`auth.admin.createUser`/`listUsers`)가 전부 `unrecognized JWT kid` 오류로 거부됨 (일반 테이블 조회 PostgREST 호출은 정상 동작). 이 때문에 로그인 게이트 화면(`/my/check-ins`, `/my/clinics`, `/my/consultation-report`) 3곳을 테스트 계정으로 자동 로그인해 렌더링 검증하는 작업이 **아직 실행되지 못했음** (화면 자체의 결함이 아니라 테스트 계정 생성이 막힌 것). 해결 경로 중 하나 필요:
  1. Supabase Dashboard에서 레거시 JWT 포맷 `service_role` 키 재발급, 또는
  2. Staging Auth에서 이메일 자동 확인(auto-confirm) 활성화, 또는
  3. 실제 로그인 가능한 테스트 계정(이메일/비밀번호) 제공.
  - 참고: `tsc`/`eslint`/`npm run build`/`test:journey`/`test:smoke`는 전부 통과했고, 로그인 불필요 구간(온보딩·구매처·저장)은 브라우저로 직접 확인함.

## 5. 다음 작업

WQ-F 미해결 브랜드(missha, clio, espoir, dr-jart, medicube, anua — Shopify 아닌 자체 플랫폼) 중 하나를 골라 전용 커넥터 추가 시도.

---

*갱신 이력은 git 커밋 로그 참고. 이 파일이 최신 상태 요약의 단일 진실.*
