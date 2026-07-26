# PROJECT_RULE.md — K-Beauty Match 운영 규칙

최종 갱신: 2026-07-26  
상위 계획: `MASTER_PLAN.md` (v3.1)

모든 기여자와 AI 어시스턴트는 아래 규칙을 우선 적용한다.  
상세 비전·코딩 스타일은 `docs/02_ProjectRule.md`를 참고하되, **저장·승인·작업 순서는 본 문서를 우선**한다.

---

## 1. Cursor와 반영의 구분

1. Cursor 수정은 **로컬 수정**일 뿐 자동 반영이 아니다.
2. GitHub push, Supabase migration/SQL 적용, 배포는 각각 별도 작업이다.
3. “코드가 바뀌었다” ≠ “원격 DB/운영에 반영됐다”.
4. **Cursor = 개발 도구**, **worker/Task Scheduler = 운영 실행기**.
5. Cursor 세션에서 운영 worker 실행 · Task Scheduler 반복 조회/수정 · 운영 SQL 쓰기를 하지 않는다 (Pending approval 루프 금지).
6. 단위 테스트·build·문서·commit·backup 브랜치 push는 Cursor가 수행한다.
7. 운영 설정은 `config/pipeline-operation.json` / `/admin/pipeline/settings`에서 관리한다.

---

## 2. GitHub / Supabase 이중 저장

1. **코드·문서·migration·비개인 카탈로그 원본**은 GitHub에 저장한다.
2. **실제 제품·성분·판매처·가격·재고·검증 상태**는 Supabase에 저장한다.
3. 중요 비개인 데이터는 JSON 또는 CSV로 GitHub에도 백업한다.
4. GitHub와 Supabase 중 **한쪽만** 반영된 상태는 완료가 아니다.
5. Supabase 쓰기 전 반드시 GitHub 백업을 확인한다.
6. Supabase 쓰기는 **사용자 승인 필수**이다.

---

## 3. Search-to-Verified + Autonomous Catalog

제품 DB를 브랜드별로 무작정·무검증 대량 구축하지 않는다.  
대량 데이터는 백엔드 후보 풀이며, 추천은 **recommendation scenario Top 10 → 개인 Top 3–5**로 한다.  
**자율 ingestion이 후보를 모으되**, 판매·성분·논문·안전 검증 후 관리자(needs_review) → `published`/`recommendation_ready`만 핵심 추천.

1. 검색 노출만으로 재고·판매 가능을 단정하지 않는다.
2. 판매 상태 확인 전·`published` 이전 제품은 핵심 추천에 넣지 않는다.
3. 제품 상태: `discovered` → `sale_checked` → `ingredients_checked` → `evidence_checked` → `safety_checked` → `verified` → `published`
4. Product / ProductVariant / ProductOffer / ProductIngredient / IngredientEvidence를 분리한다.
5. 가짜 제품·가격·재고·링크·근거 없는 효능 설명 생성 금지.
6. 제품 등록보다 **검증 정확도**를 우선한다.
7. 공식 API는 필수가 아니며, 갱신·피드·비용 대비 효과가 충분할 때만 선택 사용한다.
8. 추천 근거 순서: 피부 상태 → 전성분 → 논문 → 제형·농도·부위 → 자극 → 알레르기/회피 → 구매 가능성.
9. 성분 하나 논문만으로 제품 전체 효과를 단정하지 않는다. 의약품·화장품 연구를 구분한다.
10. 홍조·심한 염증·통증·진물·지속 악화는 추천보다 전문가 상담 분기를 우선한다.
11. 자율 파이프라인: 브랜드/제품별 승인 없음 · 정상 자동 저장 · needs_review만 사람 · **자동 published 금지**.
12. pipeline 운영: 고정 worker + `config/pipeline-operation.json`. draft=`active=false`. 스케줄러 가변 인자 금지.
13. DELETE/TRUNCATE/RLS 완화/차단 우회/main 병합은 중단 조건.
14. 사람은 needs_review만 확인 · offer 없으면 추천 eligibility=false · marketplace seller 제외.
15. 제품 자동 검증: quality A/B + 공식 전성분 + verified offer → active/verified_at. published·강등 금지.
16. 운영: 정상은 개입 없음 · 장애/품질/적체만 알림 · destructive 자동 복구 금지 · Cursor는 운영 명령 미실행.
17. Care: Day 3/7/15/30 자동 체크인 · 정상 자동 · 위험/정보부족만 강조 · 진단 금지 · 루틴 강제 변경 금지 · 관리자 집계만(PII 비노출) · 로그인 사용자 Supabase 영속화 · 익명 local fallback · 삭제 API 미지원.
18. 일반 사용자 인증은 `/login` 이메일 흐름 · `/admin`과 분리 · `/my` 보호 · open redirect 차단 · 소셜 UI는 provider 없으면 미제공.
19. 공개 사이트 여정은 `resolveUserJourney` 공통 상태 · production check · Cursor는 실메일/운영 DB/worker 미실행.
20. 릴리스 전에는 환경 presence·보안·정적/HTTP smoke를 점검하고, health 응답·로그·문서에 비밀값·프로젝트 식별자·사용자 데이터를 기록하지 않는다.
21. 배포는 별도 승인 작업이며 Vercel을 권장한다. canonical은 `https://kbeautymatch.com` apex를 선호하고 `www`는 redirect로 정리한다.
22. 공개 UI는 `--site-header-height`로 sticky 헤더 offset을 공유하고, Hero/본문이 헤더에 가리지 않게 한다. 가짜 후기·통계·그래프·미구현 CTA 금지.
23. UI 스킬: kbeauty-match-design + frontend-design + ui-ux-pro-max 함께. 정체성/안전 우선. spa/ecommerce/SaaS 기본값 거부. Top 3–5 · Organic/제휴 분리. 추천/안전/케어 로직 보존. Preview 까지; main/Production 승인 필수. 기준: `design-system/MASTER.md`, `.cursor/rules/kbeauty-ui-design.mdc`.

상세: `docs/20-data-source-verification.md`, `docs/11-product-retailer-offer.md`, `docs/69-autonomous-catalog-pipeline.md`, `docs/82-pipeline-database-persistence.md`, `docs/123-user-care-lifecycle.md`, `docs/133-care-database-persistence.md`, `docs/138-user-authentication.md`, `docs/144-end-to-end-user-journey.md`, `docs/155-ui-responsive-final-review.md`

---

## 4. 표준 작업 순서

1. 상태 확인 (`git status`, 문서, 필요 시 Supabase 읽기)
2. 관련 코드와 DB 확인
3. 수정 계획
4. 최소 수정
5. `npm run build`
6. 화면 확인
7. GitHub 백업 (브랜치·커밋·필요 시 push)
8. 필요한 경우 Supabase 반영 (승인 후)
9. Supabase 검증 (읽기 조회로 확인)
10. 데이터 백업
11. 문서 최신화 (`PROJECT_STATUS.md`, `CHANGELOG.md` 등)

한 번에 한 작업만 수행한다. 연결 확인과 DB 변경을 같은 단계에 섞지 않는다.

---

## 5. 오류·위험 작업 규칙

1. 오류 발생 시 **즉흥 수정 금지**. 원인 → 계획 → 최소 수정.
2. `DROP`, `TRUNCATE`, 대량 `DELETE`는 사용자 승인 없이 금지.
3. 가짜 제품·가격·판매처·재고·구매 링크 생성 금지.
4. 브랜드명 자동 번역 금지. `canonicalBrandName` 사용.
5. 제품명과 브랜드명을 분리한다.
6. 추천 점수·안전 필터·한국 offer 적격 로직을 요청 없이 변경하지 않는다.

---

## 6. 비밀정보

다음을 GitHub에 커밋·push 하지 않는다.

- `.env.local`
- 비밀번호
- API 키
- `service_role` 키
- Access Token / DB password

---

## 7. 제품 데이터 백업 경로

비개인 카탈로그 백업은 다음 경로를 사용한다.

- `data/backups/YYYY-MM-DD/products.json`
- `data/backups/YYYY-MM-DD/product-offers.json`
- `data/backups/YYYY-MM-DD/ingredients.json`
- `data/backups/YYYY-MM-DD/manifest.json`

로컬 원본 카탈로그 예: `data/catalog/kr/`, `data/templates/`

---

## 8. 작업 완료 조건

작업이 끝나면 반드시:

1. `PROJECT_STATUS.md`를 실제 상태에 맞게 갱신한다.
2. `CHANGELOG.md`에 변경을 기록한다.
3. 필요 시 `ROADMAP.md`의 완료/다음 작업을 갱신한다.

---

## 9. 문서 우선순위

1. `MASTER_PLAN.md` — 최상위 목표·원칙  
2. `PROJECT_RULE.md` — 본 운영 규칙  
3. `PROJECT_STATUS.md` — 현재 상태 (가장 최신 사실)  
4. `ROADMAP.md` / `CHANGELOG.md` — 순서·이력  
5. `docs/*` — 상세 초안 (충돌 시 상위 문서 우선)

---

## 10. SQL 실행 원칙

- Production 스키마/데이터를 변경하는 쓰기 쿼리(INSERT/UPDATE/DELETE/DROP/TRUNCATE 등)는
  Supabase SQL Editor에서 직접 실행하지 않는다.
- 모든 쓰기 쿼리는 `supabase/migrations/`에 `날짜_설명.sql` 파일로 작성하고
  git commit → PR 리뷰 → 승인 후에만 적용한다.
- Supabase SQL Editor는 조회(SELECT)용으로만 사용한다.
- 승인된 migration의 실제 적용은 `supabase db push`로 한다. CLI를 쓸 수 없는 예외
  상황에서만, 이미 commit·승인된 `supabase/migrations/` 파일에 한해 SQL Editor 실행을
  허용하고, 적용 후 반드시 행 수를 검증한다.
- SQL Editor의 저장된 쿼리와 History는 분기마다(3개월) 한 번씩 비운다.

### 배경 (2026-07-26)

병원 데이터 1,917행을 SQL Editor에 4개 파트로 나눠 붙여넣어 적용했다고 판단했으나,
실제로는 **한 행도 커밋되지 않았다**. 각 파트가 `BEGIN; … COMMIT;` 단일 트랜잭션이라
중간 오류 시 파트 전체가 조용히 롤백되는데, 화면상으로는 성공과 구분이 어려웠다.
붙여넣기 실행은 (1) 실행 여부가 git에 남지 않고 (2) 리뷰를 거치지 않으며
(3) 부분 실패를 사람이 알아채기 어렵다. 위 원칙은 이 세 가지를 막기 위한 것이다.

---

## 11. 작업 정리 원칙

작업할 때마다 필요 없는 것이 쌓이지 않게 **그때그때 정리한다.** 작업 종료 조건(§8)에
아래 정리를 포함하며, 미루지 않는다.

- **비밀정보**: 안 쓰는 secret key·access token·환경변수는 즉시 제거한다.
  일회성으로 받은 Production 키는 사용 직후 로컬에서 지우고, 발급한 토큰은 revoke한다.
- **브랜치**: 병합·폐기된 로컬/원격 브랜치는 삭제한다. 미병합 브랜치는 남긴다.
- **임시 산출물**: 임시 스크립트·임시 env 파일·scratchpad·일회성 로그는 저장소 밖에
  두고, 작업이 끝나면 지운다. 저장소에 커밋하지 않는다.
- **문서**: 중복 문서와 옛 세션 기록은 통합한다. 같은 사실을 여러 곳에 복사하지 않고,
  `PROJECT_STATUS.md`(현재 상태)와 `CHANGELOG.md`(이력)의 역할을 지킨다.
- **의존성**: 안 쓰는 dependency는 제거한다.

정리 대상이 **파괴적이거나 되돌리기 어려우면**(운영 키 삭제, 미병합 브랜치, 데이터)
지우기 전에 근거를 확인하고 사용자에게 목록을 보여준 뒤 승인을 받는다.
