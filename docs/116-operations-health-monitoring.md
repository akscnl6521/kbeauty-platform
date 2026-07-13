# 116 — Operations Health Monitoring

관리자 `/admin/operations`에서 worker·수집·품질·검토·추천 상태를 계산한다.

- 등급: healthy / attention / warning / critical / unknown
- 데이터: 기존 `pipeline_batches` / `pipeline_jobs` / `verification_queue` / products / offers SELECT
- Cursor는 운영 명령·운영 DB 쓰기를 실행하지 않음
- 정상 상태에서는 사람 개입 없음
