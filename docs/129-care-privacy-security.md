# 129 — Care Privacy & Security

최종 갱신: 2026-07-13

## 필수

- 사용자 본인 데이터만 조회 (RLS owner)
- 관리자 일반 역할: 집계만, 개인 데이터 직접 조회 불가
- service role 서버 전용
- 최소 수집 · 동의 기록 · 삭제 요청 구조(서버 스키마에 준비)
- 이미지: private storage · signed URL · 형식/크기 검사 · EXIF 위치 금지
- 로그에 건강정보·메모·사진 URL 출력 금지

## Admin API 비노출

이메일 · 전체 UID · 자유 메모 원문 · 얼굴 사진 · 개인별 상세 건강정보

## Migration

원격 적용 완료 (`create_continuous_care_persistence`). Rollback 문서: `docs/132` (수동).
고객 인증·`/my` 보호: `docs/138`.
