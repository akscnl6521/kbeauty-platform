# 107 — Recommendation Verified Catalog

`fetchCandidateProducts`: `active=true` AND `verified_at IS NOT NULL`.

Top5:
1. KR verified offer
2. allergy/avoid hard filter
3. rank
4. `clampTopNWithoutPadding` — 5개 미만이면 그대로 (패딩 금지)

운영에서 mock AI 분석 결과는 실제 카탈로그 제품처럼 노출하지 않음.
`AI_PROVIDER=mock`은 production에서 거부.
