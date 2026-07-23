# Product automation pipeline (T03)

최종 갱신: 2026-07-23

## 범위

공통 수집 계약 → 카테고리 추출기(마스카라·립·샴푸/두피) → 정규화·변형·이미지·INCI·오퍼·사용 미디어 메타 → 중복·검증·적격·검수·갱신/재개 → Staging/admin 링크(쓰기 없음).

코드: `src/lib/catalog/productAutomation/`
테스트: `npm run test:product-automation`

## 정직 경계

- fixture / dry-run만 사용. 라이브 공식 출처 검증·구매 verified SKU는 별도.
- `recommendation_ready`는 live official 검증 없이는 부여하지 않음.
- `autoPromote=false` · Staging/Production 쓰기 없음.
- 마스카라·립·샴푸 추천은 속성 매칭 + 안전 게이트. 구매 가능 주장 금지.
