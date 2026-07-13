# 97 — Recommendation Data Integration

`fetchCandidateProducts`는 `active=true|null`만. draft 제외.  
KR Top5는 계속 verified offer 게이트. offer=0이면 구매 추천 불가.  
구조화 skin/tone 점수는 pipeline 테이블에 축적 후 점진 연결.
