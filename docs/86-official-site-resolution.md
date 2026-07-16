# 86 — Official Site Resolution

## 목적

외부 검색 API 없이 내부 카탈로그·시드·페이지 신호로 브랜드 공식 사이트를 자동 판별한다.

## 후보 생성 순서

1. brands / brand seed의 `officialWebsite`
2. `data/pipeline/brand-official-seeds.json` 시드 URL
3. products legacy / retailer 링크 도메인 (낮은 점수)
4. 브랜드명 기반 도메인 패턴 (`brand.com`, `brand.co.kr` 등)
5. 동일 브랜드 제품에서 반복되는 도메인
6. sitemap / robots / about 페이지 검증

## 점수·분류

| 분류 | 자동 crawl |
|------|------------|
| `verified_official` | 허용 |
| `likely_official` (고신뢰) | 허용 |
| `retailer` / `marketplace` / `social` / `unrelated` / `blocked` | 금지 |
| `needs_review` | 금지 |

점수 요소: 브랜드명↔호스트 일치, title/JSON-LD brand, About 일치, marketplace/social 여부, Product 페이지 밀도.

## 저장

`brand_official_site_state`에 domain, 판정, confidence, 이유, source, checked_at, connector를 UPSERT한다.  
같은 `brand_key`로 중복 row를 만들지 않는다.

## 운영 원칙

- 공식 사이트 미확인 ≠ BLOCKER → `needs_review` 후 다음 브랜드 계속
- 가짜 URL 생성 금지
- captcha/403 우회 금지
