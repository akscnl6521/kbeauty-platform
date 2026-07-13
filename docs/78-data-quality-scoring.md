# 78 — Data Quality Scoring

## 차원

identity · source · ingredients · offer · evidence · safety · tone · freshness · dedupe

## 등급

A/B/C/D / Review Required

## Publish eligible

항상 서버에서 재계산. **이 단계 `publishEligible=false` 고정.**  
`product_offers` 0 → publish 차단.
