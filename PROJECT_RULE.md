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

## 3. 표준 작업 순서

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

## 4. 오류·위험 작업 규칙

1. 오류 발생 시 **즉흥 수정 금지**. 원인 → 계획 → 최소 수정.
2. `DROP`, `TRUNCATE`, 대량 `DELETE`는 사용자 승인 없이 금지.
3. 가짜 제품·가격·판매처·재고·구매 링크 생성 금지.
4. 브랜드명 자동 번역 금지. `canonicalBrandName` 사용.
5. 제품명과 브랜드명을 분리한다.
6. 추천 점수·안전 필터·한국 offer 적격 로직을 요청 없이 변경하지 않는다.

---

## 5. 비밀정보

다음을 GitHub에 커밋·push 하지 않는다.

- `.env.local`
- 비밀번호
- API 키
- `service_role` 키
- Access Token / DB password

---

## 6. 제품 데이터 백업 경로

비개인 카탈로그 백업은 다음 경로를 사용한다.

- `data/backups/YYYY-MM-DD/products.json`
- `data/backups/YYYY-MM-DD/product-offers.json`
- `data/backups/YYYY-MM-DD/ingredients.json`
- `data/backups/YYYY-MM-DD/manifest.json`

로컬 원본 카탈로그 예: `data/catalog/kr/`, `data/templates/`

---

## 7. 작업 완료 조건

작업이 끝나면 반드시:

1. `PROJECT_STATUS.md`를 실제 상태에 맞게 갱신한다.
2. `CHANGELOG.md`에 변경을 기록한다.
3. 필요 시 `ROADMAP.md`의 완료/다음 작업을 갱신한다.

---

## 8. 문서 우선순위

1. `MASTER_PLAN.md` — 최상위 목표·원칙  
2. `PROJECT_RULE.md` — 본 운영 규칙  
3. `PROJECT_STATUS.md` — 현재 상태 (가장 최신 사실)  
4. `ROADMAP.md` / `CHANGELOG.md` — 순서·이력  
5. `docs/*` — 상세 초안 (충돌 시 상위 문서 우선)
