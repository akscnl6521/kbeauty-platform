# 77 — Pipeline Monitoring

## 감지 목표

제품명/성분/URL/단종/가격·재고 후보 변경 · 사이트 실패 · 브랜드 이전

## 정책

해시 비교 후 **즉시 덮어쓰기 금지** → change candidate  
중요 성분 변경 → needs_review · 감사 로그

1차는 job checkpoint의 resultSummary로 관찰. 영구 change 테이블은 migration BLOCKER.
