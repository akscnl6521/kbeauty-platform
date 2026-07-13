# 146 — User State Machine

최종 갱신: 2026-07-13

`src/lib/user/journey.ts` — home/results/my 공통.

상태: anonymous_new · anonymous_analyzed · signed_up_unconfirmed · authenticated_no_onboarding · authenticated_onboarding_partial · authenticated_no_routine · care_active · checkin_due · referral_attention · sync_error

우선순위: 상담 권고 → due 체크인 → 이메일 → 온보딩 → 루틴/동기화 → 케어 활성 → 분석 이어보기.
