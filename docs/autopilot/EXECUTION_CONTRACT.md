# Autopilot Execution Contract — K-Beauty Match

최종 갱신: 2026-07-24
근거 명세: `KBEAUTY_MASTER_EXECUTION_PROMPT.md` (**읽기 전용 · 수정 금지**)
작업 브랜치: `feature/recommendation-usage-guide-display-20260720`
큐 문서: `docs/autopilot/MASTER_EXECUTION_QUEUE.md`

## 1. 목적

Autopilot/에이전트가 저장소에서 **검증된 사실만** 기준으로 다음 단일 작업 번들을 수행하도록 계약한다.
문서와 코드가 다르면 **코드가 진실**이다. 이미 완료·보존된 작업은 삭제·리셋·재구현하지 않는다.
T07-05(Admin dry-run · publishable 게이트) · P3-T01(공식 한국 제품 출처 온보딩) · P3-T02(검증 제품 풀·카테고리 확장)까지 코드 완료 · 실 live·Staging import·publishable은 `external_only`.

## 2. 절대 금지

- `main` 병합 · Production 배포
- Production DB / Storage / 환경변수 변경
- 유료 API 호출 · CAPTCHA/로그인 우회 · 고위험 스크래핑
- 파괴적 Git (`reset --hard`, `checkout --`, `restore`, `clean`, force push, `git add -A` / `.`)
- `KBEAUTY_MASTER_EXECUTION_PROMPT.md` 수정
- 비밀키·service role·전체 프로젝트 ref 출력
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 생성
- 운영 intake (`run-pipeline-worker` / Task Scheduler 등록) 실행
- 완료 위장 (외부 전용 항목을 `verified_complete`로 표기)

Windows outer runner가 Git을 담당할 때는 **commit/push를 에이전트가 수행하지 않는다**.

## 3. 허용

- feature 브랜치에서 소스·테스트·fixture·문서 편집
- 로컬 selftest / TypeScript / 변경 파일 lint / 안전한 production build
- SELECT-only · dry-run · Staging(승인된 범위만)
- 명시 경로만 `git add` (outer runner 규칙이 허용할 때)

## 4. 상태 분류 (필수)

| 분류 | 의미 | 완료로 쳐도 되는가 |
|------|------|-------------------|
| `verified_complete` | 코드·관련 selftest로 확인됨 | 예 (코드 범위) |
| `partial` | 구조/일부 UI·로직은 있으나 실데이터·실기기·실발송 등 미완 | 아니오 |
| `external_only` | 사람 Preview/실기기/정책·법무/공식 출처 승인/Production 게이트 | 아니오 · 에이전트 단독 완료 불가 |
| `remaining` | 아직 코드 번들로 남아 있는 구현 과제 | 아니오 |
| `deferred` | 의도적 보류 (예: Phase 3.1 flag OFF) | 아니오 |

위장 금지 예시:
- fixture 병원 ≠ 공식 publishable 병원
- dry-run 이메일 ≠ 실발송
- selftest 통과 ≠ Preview 육안 통과
- DRAFT migration ≠ Staging/Production 적용

## 5. 실행 순서

1. `PROJECT_STATUS.md` → `ROADMAP.md` → `CHANGELOG.md` → 본 계약 → `MASTER_EXECUTION_QUEUE.md` 읽기
2. 큐에서 **다음 단일 작업 1개**만 선택 (`next_task`)
3. 관련 파일만 읽고 구현 · 작업 유발 오류만 수정
4. 관련 selftest + 변경 파일 lint/TS 실행
5. STATUS / ROADMAP / CHANGELOG / 큐를 **검증된 사실**로만 갱신
6. 종료 토큰 출력:
   - `AUTOPILOT_RESULT: COMPLETE` — 번들 완료
   - `AUTOPILOT_RESULT: BLOCKED` — 치명적 차단만

## 6. 플랫폼 방향 (요약)

장기 맞춤 관리 루프를 강화한다: 이해 → 목표/상태 → 우선순위 → 성분·기능 → 실제품 추천 → 사용/루틴 → 저장 → 3/7/15/30 추적 → 조정 → 전문가 분기 → 프로필 갱신.
쇼핑몰·제휴 우선·목데이터 데모·일회성 추천·사진 의료진단 주장이 되면 안 된다.

## 7. 최소 완료 기준 매핑 (§26)

상세 상태는 큐 문서 §분류 표를 따른다. 요약:

| # | 기준 | 분류 |
|---|------|------|
| 1 | 스킨케어 여정 코드 연결 | `verified_complete` |
| 2 | red flag → 전문가 우선·추천 중단 | `verified_complete` |
| 3 | 장기 BeautyProfile | `verified_complete` (UI·체크인 반영·서버 경계·DRAFT · Staging 미적용) |
| 4 | 확장 taxonomy | `verified_complete` |
| 5 | 마스카라/립/샴푸 속성 로직 | `partial` (T03 안전 추천·추출기 코드 완료 · 실구매 verified SKU 부족) |
| 6 | 규제·기기·도구 분리 | `verified_complete` (구조) |
| 7 | 공통 모델 ↔ category attrs | `verified_complete` |
| 8 | 수집·정규화·중복·갱신 파이프라인 | `verified_complete` (코드·T03 ingestion dry-run) / live 공식·실운영은 별도 |
| 9 | Organic/Affiliate/Sponsored | `verified_complete` (T04 랭킹·API·지속화·UI·analytics·admin) · 실제휴 채널은 external |
| 10 | 증상 기반 전문 안내 | `partial` (라우팅·번들 verified · 실병원 미게시) |
| 11 | 3/7/15/30 체크인 | `verified_complete` (lifecycle·채널 dry-run 포함 · 실푸시/실메일/실SMS 제외) |
| 12 | 국가·언어·통화·판매처 | `verified_complete` (구조·T05 지역 offer 표시) |
| 13 | 관련 테스트·빌드 | `verified_complete` (T06 final-integration·journey·security·production build) · Preview/실기기는 external · 전체 ESLint 기존 실패 잔존은 partial |
| 14 | 외부 미연결 정직 보고 | 본 계약·큐로 유지 |
| 15 | main/Production 미터치 | 유지 중 |

## 8. 문서 단일 진실

| 문서 | 역할 |
|------|------|
| `docs/autopilot/EXECUTION_CONTRACT.md` | 규칙·분류·금지 |
| `docs/autopilot/MASTER_EXECUTION_QUEUE.md` | 작업 큐·다음 작업 |
| `docs/MASTER_EXECUTION_QUEUE.md` | 레거시 포인터 (내용 복제 금지) |
| `PROJECT_STATUS.md` / `ROADMAP.md` / `CHANGELOG.md` | 사용자용 상태 요약 |

## 9. Self-test

```bash
npm run test:autopilot-queue
```

계약·큐 파일 존재, 필수 섹션, 상태 토큰, 레거시 포인터, 핵심 경로 존재를 검증한다.
