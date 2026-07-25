# 백업 로그 (오토파일럿)

이 세션부터 "K-Beauty Match 오토파일럿" 지시에 따라 매 작업 단위(커밋+push, DB 변경)마다
아래 표에 한 줄씩 기록한다. 실사용자 개인정보(PII)는 백업 대상에서 제외한다.

형식: `날짜시각 | 종류(code/db-migration/db-data) | 대상 | 커밋 해시 또는 비고`

| 시각(UTC) | 종류 | 대상 | 커밋/비고 |
|---|---|---|---|
| 2026-07-25T (세션 시작) | code | 오토파일럿 시작 — 3개 백그라운드 에이전트 기동 (제품 승격 / 병원 후보 등록 / 클릭추적) | 아래 각 에이전트 완료 시 커밋 해시 기록 예정 |
| 2026-07-25T12:09:49Z | db-snapshot | Staging 요약 스냅샷 (row count만, PII 없음) — products=27(active 20), candidates=1319, ingredients=754, offers=28 | data/backups/staging-snapshots/snapshot-2026-07-25T12-09-49-215Z.json |

## 규칙
- 코드/문서/SQL/스크립트 변경: 작업 단위마다 git commit + push
- Staging DB 데이터 변경(대량): 사전 스냅샷 → 변경 → 로그 기록
- main 병합, Production 배포 전: 반드시 전체 백업 후 진행 (이번 세션에서는 도달 시 사용자 확인 필요 — 세션 시작 시 명시적으로 예외 처리함)
- 백업 자체가 실패하면 그 작업만 중단하고 사유를 기록, 세션 전체를 멈추지 않는다
