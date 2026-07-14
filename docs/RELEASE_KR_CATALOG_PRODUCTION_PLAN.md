# Production 한국 카탈로그 반영 계획 (미실행)

최종 갱신: 2026-07-14  
**상태:** 계획만. Production DB 쓰기·배포·main 병합 금지.

## 권고

**A. Staging COSRX 한국 제품 8건(+필요 시 성분/미디어/offer)을 Production에 반영한 뒤 출시**

이유: 사용자는 실제 제품 추천·구매 연결을 기대함. 코드만 출시(B)하면 Production에 Staging 시드 8건이 없어 신규 COSRX 시나리오가 빈약해짐. 완전 무데이터(C)는 아님(기존 Production products 다수 존재)이나, 이번 Sprint 한국 시드 가치는 Staging에만 있음.

## Staging 소스(참조)

| 항목 | 건수(백업 기준) |
|------|----------------:|
| products (전체 Staging) | 11 |
| 그중 COSRX 시드 | 8 (id 4~11) |
| ingredients | 129 |
| product_ingredients | 257 |
| catalog_product_media | 11 |
| product_offers | 2 |
| S2V candidates | 3 (needs_review) |

백업: `data/backups/2026-07-14-catalog/`

## 반영 전 체크리스트 (승인 후)

1. Production 명시 승인 (DB 쓰기)
2. Staging ↔ Production slug/이름 중복 조회 (특히 Snail 96/92)
3. migration 갭 확인 (Staging에만 있는 GRANT/미디어 스키마)
4. 복원 순서: ingredients → products → product_ingredients → media → offers (provenances/S2V는 선택)
5. signed URL 재발급 · `storage://` → Production Storage 재업로드
6. offer는 unverified 유지 가능 · **자동 Verified 금지**
7. S2V needs_review 3건은 후보만 · 제품 Verified 자동 승격 금지
8. dry-run 리포트 → 승인 → 소량 1건 스모크 → 나머지
9. Production 추천 Top5에 unverified offer **미포함** 재확인

## 이번 세션

Production INSERT/UPDATE/DELETE **미실행**.
