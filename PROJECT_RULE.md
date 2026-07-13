# PROJECT_RULE.md — K-Beauty Match 운영 규칙

최종 갱신: 2026-07-13  
상위 계획: `MASTER_PLAN.md` (v3.1)

모든 기여자와 AI 어시스턴트는 아래 규칙을 우선 적용한다.  
상세 비전·코딩 스타일은 `docs/02_ProjectRule.md`를 참고하되, **저장·승인·작업 순서는 본 문서를 우선**한다.

---

## 1. Cursor와 반영의 구분

1. Cursor 수정은 **로컬 수정**일 뿐 자동 반영이 아니다.
2. GitHub push, Supabase migration/SQL 적용, 배포는 각각 별도 작업이다.
3. “코드가 바뀌었다” ≠ “원격 DB/운영에 반영됐다”.

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
**자율 파이프라인이 후보를 모으되**, 판매·성분·논문·안전 검증 후 관리자(needs_review) → `published`만 핵심 추천.

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
12. pipeline 운영 상태는 Supabase `pipeline_*` 테이블(service role). 스케줄러 기본 dry_run.
13. DELETE/TRUNCATE/RLS 완화/차단 우회/main 병합은 중단 조건.

상세: `docs/20-data-source-verification.md`, `docs/11-product-retailer-offer.md`, `docs/69-autonomous-catalog-pipeline.md`, `docs/82-pipeline-database-persistence.md`

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
