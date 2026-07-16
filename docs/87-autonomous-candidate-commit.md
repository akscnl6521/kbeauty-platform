# 87 — Autonomous Candidate Commit

## 범위

자동 commit은 **신규** `product_discovery_candidates` INSERT와 `verification_queue` INSERT만 한다.

## 금지

- 기존 candidate bulk UPDATE / workflow 일괄 변경 / URL 휴리스틱 재분류
- `products` INSERT·overwrite
- `product_offers` verified 저장
- 자동 `published`
- DELETE / TRUNCATE

## 품질 게이트 (통과 → `workflow_status=discovered`)

- 공식 사이트 crawl 허용 + confidence 기준
- https canonical URL + 제품 URL 패턴
- 제품명·브랜드명 (Unknown 거부)
- 제품 페이지 신호 (JSON-LD Product / shopdetail 등)
- 목록·게시판·카테고리 URL/제목 제외
- 중복 없음 (`create_candidate`)
- `publishEligible=false` 유지

## Soft path (신규만)

게이트 미통과이나 하드 차단이 아니면 신규 row를 `workflow_status=needs_review`로 INSERT할 수 있다.  
기존 row는 변경하지 않는다.

## 자동 생성

- duplicate `verification_queue`
- audit / provenance / quality score
- pipeline job 결과

## 승인 정책

- 브랜드별·제품별 추가 승인 없음
- 사람은 `needs_review`만 확인
