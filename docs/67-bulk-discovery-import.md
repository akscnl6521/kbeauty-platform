# docs/67-bulk-discovery-import.md — 일괄·CSV 등록

최종 갱신: 2026-07-13

## 배치 제한

- URL 최대 50
- CSV 헤더 포함 최대 100행 / 200KB
- 항목별 timeout + 배치 전체 timeout
- 부분 성공: 한 건 실패로 전체 중단하지 않음

## 중복

- canonical / discovered_url
- name+brand 정규화
- 기존 candidates / products
- preview·commit 모두 서버 재검사
- 강제 중복 등록 불가

## CSV

컬럼: `url`(필수), `product_name`, `brand`, `country`, `source_type`, `notes`  
템플릿: `kbeauty-discovery-import-template.csv` (placeholder만)  
CSV 값은 추출값보다 우선. 바로 DB 저장 금지 → preview 후 commit.

## createDuplicateQueue

true면 성공 후보마다 duplicate 큐 생성 (열린 큐 있으면면 재생성 금지).
