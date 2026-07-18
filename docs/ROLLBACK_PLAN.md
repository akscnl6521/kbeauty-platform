# ROLLBACK_PLAN.md

최종 갱신: 2026-07-18  
**실제 롤백/배포는 본 Phase에서 실행하지 않음.**

## 1. 앱만 배포된 경우 (DB 변경 없음) — 단순

1. Vercel에서 이전 Production 배포로 Instant Rollback
2. 필요 시 `main` revert 커밋 (승인 후)
3. 환경변수 변경이 있었다면 직전 값으로 원복 (값은 채팅에 붙이지 않음)
4. `/api/health` · 홈 · 로그인 스모크

## 2. Production DB를 변경한 경우

1. **신규 migration 적용 전 백업**이 전제
2. 롤백 SQL은 migration별 문서/스크립트만 사용 (임의 DELETE 금지)
3. 카탈로그는 삭제보다 `active=false` / offer inactive 우선
4. Care 데이터는 DELETE 권한 REVOKE — 상태 취소·알림 중지 우선

## 3. 이메일 / cron

1. `CARE_EMAIL_PROVIDER` 제거 또는 dry-run 강제
2. Vercel cron / Edge cron 비활성
3. worker lock 확인 후 중복 발송 중단

## 4. 카탈로그·추천

1. 문제 제품 `active=false`
2. 추천은 verified+offer 게이트 유지 (패딩 금지)
3. 필요 시 결과 페이지 안내 문구만 추가

## 5. 장애 공지 기준 (예시)

- 로그인 전면 장애
- 분석 API 5xx 지속
- 잘못된 의료·효능 단정 노출
- 대량 오발송

공지 채널·문구는 운영자 결정 (본 문서는 법률 자문 아님).
