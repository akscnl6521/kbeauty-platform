# 97 — Recommendation Data Integration

`fetchCandidateProducts`는 `active=true` AND `verified_at IS NOT NULL`만. draft 제외.  
KR Top5는 verified offer 게이트 + allergy/avoid hard filter.  
조건 통과 제품이 5개 미만이면 패딩하지 않음. offer=0이면 구매 추천 불가.  
구조화 skin/tone 점수는 pipeline 테이블에 축적 후 점진 연결.  
상세: `docs/104`~`docs/109`.
