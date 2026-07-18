# AUTOMATION_POLICY.md — 자동 작업 안전장치

최종 갱신: 2026-07-18  
상위: `PROJECT_RULE.md` · `MASTER_PLAN.md`

이 문서는 Cursor/CI/로컬 워커가 **승인 없이 진행해도 되는 범위**와  
**반드시 사용자 승인이 필요한 범위**를 분리한다.

---

## 1. 목적

사용자가 개발 중간 전달자가 되지 않도록 자동화를 확대하되,  
Production·개인정보·파괴적 변경은 절대 자동으로 넘기지 않는다.

---

## 2. 자동 진행 가능

다음만 승인 없이 진행한다.

| 유형 | 예시 |
|------|------|
| 코드 읽기 | 저장소·문서·마이그레이션 파일 조회 |
| 문서 갱신 | `PROJECT_STATUS` · `CHANGELOG` · 대시보드 · 계획서 |
| 별도 브랜치 작업 | `automation-mvp-completion` 등 feature 브랜치 |
| 로컬 테스트 | `lint` · `build` · `test:*` · `check:mvp` |
| CI | GitHub Actions 정적 게이트 (DB write 없음) |
| Preview | Vercel Preview 빌드/확인 (Production 아님) |
| Staging 읽기 | 조회·품질 스모크·이미지 HEAD 검증 |
| Staging 비파괴 작업 | dry-run · 검수 큐 후보 생성 · 라벨 sheet 초안 |
| 제품 후보 수집 | discovery 후보·URL 상태 검사 (자동 `published` 금지) |
| 검수 대기 후보 생성 | `needs_review` 큐 항목 |

원칙:

- 동일 파일 동시 수정 금지 · 독립 작업만 병렬
- Production URL/ref가 감지되면 **쓰기 경로 즉시 중단**
- CI / pull_request 에서는 DB write 금지
- 비밀키·`.env.local` 값 출력·커밋 금지

---

## 3. 사용자 승인 필수

채팅에 명시적 승인 문구가 있을 때만 진행한다.

| 유형 | 예시 승인 문구 |
|------|----------------|
| main 병합 | 「main 병합 진행」 |
| Production 배포 | 「Production 배포 진행」 |
| Production 환경변수 변경 | 「Production env 변경 승인」 |
| Production DB 쓰기 | 「Production DB 쓰기 승인」 |
| 대량 수정/삭제 | 「대량 삭제 승인」 등 |
| 파괴적 migration | `DROP`/`TRUNCATE`/대량 `DELETE` |
| 개인정보 처리 정책 변경 | privacy/terms 실질 변경 |
| 유료 API 대량 호출 | 비용이 크게 발생하는 수집·AI 배치 |

승인 없이 위 작업을 시작하지 않는다. “편의상” 예외 없음.

---

## 4. 환경 가드

다음이면 **DB write / ingestion / promote 즉시 중단**:

1. `CI=true` 또는 `GITHUB_ACTIONS=true`
2. `pull_request` 이벤트
3. Production 사이트 URL을 쓰기로 사용하는 작업
4. Supabase project ref가 Production과 일치 (`PRODUCTION_SUPABASE_PROJECT_REF` / 알려진 Production ref)
5. `APP_ENV=production` 또는 `CATALOG_DATABASE_ENV=production` + 쓰기 의도
6. `CATALOG_INGESTION_ENABLED=true` 이면서 Production ref

허용 대체:

- CI build용 placeholder Supabase URL/anon key
- Staging 전용 시크릿 (CI에 넣을 경우 Production과 분리)

---

## 5. 추천·카탈로그 안전

- 자동 `published` 금지
- Top5는 verified catalog + verified offer 필수
- 가짜 가격·재고·INCI invent 금지
- 추천 점수·안전 필터는 규칙 엔진 유지 (로컬 AI는 초안·분류 보조만)

---

## 6. 워크스테이션 병렬

- 논리 CPU의 약 70~80% · 기본 워커 `min(75% CPU, 32)`
- 외부 HTTP 동시성 4~8 · rate limit 준수
- GPU는 로컬 AI에만 · 개인정보/얼굴 사진 외부 전송 금지
- 개발 서버 1개 · 동일 npm 테스트 중복 금지
- worker lock (`data/pipeline/runtime/worker.lock` 등) 존중

상세: `scripts/catalog-worker-config.mjs` · `scripts/system-capability-report.mjs`

---

## 7. 완료 보고

자동화 작업이 끝나면 한 번에 보고한다.

- 생성·수정 파일
- 테스트 PASS/FAIL/SKIPPED
- 브랜치·커밋·push 여부
- main/Production/Prod DB 미변경 확인
