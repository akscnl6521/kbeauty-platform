# 103 — Recommendation Offer Integration

Top5: 국가별 verified + in_stock + ships_to + 통화 일치 offer 필수.  
offer 없으면 구매 추천 제외. draft(`active=false`) 제외.  
선택 순위: 공식몰 → 인가 판매처 → 가격 → freshness.
