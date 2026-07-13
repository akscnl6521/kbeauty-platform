# 69 — Autonomous Catalog Pipeline

최종 갱신: 2026-07-13

## 요약

K-Beauty Match는 **사람이 제품을 일일이 등록하는 도구**가 아니라  
**공개 화장품 데이터를 자동 구축하고, 낮은 신뢰도만 사람이 검토하는 플랫폼**으로 전환한다.

## 사람 vs 시스템

| 역할 | 책임 |
|------|------|
| 사람 | `needs_review`만 검토 (충돌·저신뢰·출처 불일치) |
| 시스템 | 브랜드/제품 발견·추출·정규화·점수·중복제거·재시도·checkpoint |

브랜드별/제품별 승인 요청 없음.

## 파이프라인 단계

`brand_seed` → `official_site_*` → sitemap/URL 수집 → 추출 → 중복 → 성분 → 안전 → skin match → offer 후보 → verification → publish_eligible

**자동 `published` 금지.** `product_offers` 0이면 publish 불가.

## 실행 모드

- `dry_run` (기본): 추출·분류·중복 결과만 파일 checkpoint
- `commit`: 품질 조건 통과 시 discovery candidate / 관계 / 큐만 (정책 범위 내)

## 상태 저장 (1차)

- 파일: `data/pipeline/runtime/` (gitignore)
- 운영 다중 인스턴스 / 원격 지속성 → **BLOCKER migration** (`docs/69` 부록 / `docs/79`)

## 중단 조건

migration/RLS/DELETE/대량 덮어쓰기/자동 published 정책 변경/유료 API/차단 우회/main 병합

## 관련 코드

- `src/lib/pipeline/*`
- `/admin/pipeline`, `/admin/brands`
- `scripts/run-pipeline.*`
