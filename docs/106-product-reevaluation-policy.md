# 106 — Product Reevaluation Policy

재평가 허용:
- draft → 게이트 재검사 → 활성화
- verified 제품의 offer freshness / stock → **recommendationEligible만** 변경

금지:
- verified → inactive 자동 강등
- verified_at null 재설정
- 동일 상태 재평가 시 중복 UPDATE / audit / queue
