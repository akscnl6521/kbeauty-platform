# docs/65-admin-write-console.md — 쓰기 콘솔 종합

최종 갱신: 2026-07-13

## 범위

Search-to-Verified **1차 쓰기 콘솔** + **URL/CSV 빠른 등록**.

빠른 등록: `/admin/discovery/import` · `docs/66`~`68`

## 감사 로그

`product_change_history`:
- change_type: source|status|other만 사용
- product_id: 연결 시 FK, 없으면 null
- new_value에 action/actorRole/safe metadata
- **UID·이메일·assigned_to·토큰 미저장**

candidate/queue 전용 FK 없음 → schema 변경 없이 metadata로 기록.

## 보안

- service role 서버 전용
- browser client 쓰기 금지
- DELETE/TRUNCATE/migration/RLS 변경 없음
- 민감정보 API/UI 비노출

## 운영 E2E (사용자 직접)

1. admin 로그인
2. `/admin/discovery/new`에서 실제 후보 1건 등록
3. 상세에서 duplicate 큐 생성 → 검토 시작 → 승인
4. sale→…→safety→other(verified)→(admin) publish 순
5. `/admin/verification`·history 확인
6. **테스트 행 DELETE 금지** — 운영 등록은 실데이터만

## 미지원

- reopen, unlink, offers 자동 생성, 가짜 가격/링크
- ingredients/products 대량 수정
- main 병합

## 관련 문서

docs/61–64
