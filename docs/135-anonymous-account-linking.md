# 135 — Anonymous Account Linking

최종 갱신: 2026-07-13

## 정책

- 익명: localStorage만 (서버에 anon UUID로 임의 조회 불가)
- 로그인 후: 서버 저장 우선
- 로컬→계정 연결: 사용자 확인 후 `POST /api/care/analyses/attach`
- 강제 병합 금지 · session+day / fingerprint 중복 방지
- 연결 후 localStorage 자동 삭제 금지

## 메시지

「이 기기의 기록을 계정에 연결했습니다」
