# docs/66-url-based-discovery-import.md — URL 기반 빠른 후보 등록

최종 갱신: 2026-07-13

## 개요

관리자가 제품 URL을 붙여넣으면 JSON-LD / Open Graph / meta / title / path 순으로
제품 정보를 추출하고, 중복 검사 후 `product_discovery_candidates`에 등록한다.

## UI

- `/admin/discovery/import`
- 대시보드·Discovery 목록: **URL로 빠른 등록**

## API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/discovery/import/preview` | 분석만 (INSERT 없음) |
| POST | `/api/admin/discovery/import/commit` | 선택 항목 일괄 등록 |

## 추출 우선순위

1. JSON-LD Product  
2. Open Graph  
3. meta title/description  
4. HTML title  
5. URL path fallback  

가격·재고·이미지는 **미리보기 참고값**. `product_offers` 저장 금지.

## 등록 필드

discovered_name, discovered_brand, discovered_url, discovered_country, source_type, notes  
초기: workflow=discovered, checks=pending, linked=null

## 의존성

`cheerio` — script 실행 없이 HTML 파싱. 브라우저 자동화 없음.
