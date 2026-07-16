# 105 — Product Activation vs Published

- **verified/active**: 추천 후보 풀 진입 조건
- **published**: 스키마/정책상 자동 처리 금지 (`allowPublish=false`)

활성화 = `products.active=true` + `products.verified_at` 서버 시각.
published 컬럼/상태 자동 전환 없음.
