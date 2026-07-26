# 백업 로그 (오토파일럿)

이 세션부터 "K-Beauty Match 오토파일럿" 지시에 따라 매 작업 단위(커밋+push, DB 변경)마다
아래 표에 한 줄씩 기록한다. 실사용자 개인정보(PII)는 백업 대상에서 제외한다.

형식: `날짜시각 | 종류(code/db-migration/db-data) | 대상 | 커밋 해시 또는 비고`

| 시각(UTC) | 종류 | 대상 | 커밋/비고 |
|---|---|---|---|
| 2026-07-25T (세션 시작) | code | 오토파일럿 시작 — 3개 백그라운드 에이전트 기동 (제품 승격 / 병원 후보 등록 / 클릭추적) | 아래 각 에이전트 완료 시 커밋 해시 기록 예정 |
| 2026-07-25T12:09:49Z | db-snapshot | Staging 요약 스냅샷 (row count만, PII 없음) — products=27(active 20), candidates=1319, ingredients=754, offers=28 | data/backups/staging-snapshots/snapshot-2026-07-25T12-09-49-215Z.json |
| 2026-07-25 | code | 백업 로그 체계 + snapshot 스크립트 commit+push | fda97cf |
| 2026-07-25 | db-data | HIRA 병원 후보 1,917건 dermatology_institution_candidates 적재 | 커밋 없음(데이터만, 스크립트는 기존 8d0a5f8) |
| 2026-07-25 | code | .env.local 중복 Supabase 블록 수정 기록 + 검증 결과 문서화 | 3e9a4ab |
| 2026-07-25 | db-data | ingredients 중복 309건 정리 + 40건 재매칭(product_ingredients 882→1996) | b21b7cd |
| 2026-07-25 | code | 오퍼 재수집 스크립트 + GRANT 요청(product_offers UPDATE) | 3ccd075 |
| 2026-07-25 | docs | 6단계 지리 목록 범위 확정 + 신규 브랜드 5개 시도 기록 | d1c78b5, 73b9c85 |
| 2026-07-25 | db-data | 실 오퍼 25건 verified + GRANT 요청(products/pipeline_batches UPDATE) | 70a4fca |
| 2026-07-25 | db-data | draft product 7건 실활성화(20→27) + 정식 워커 end-to-end 성공 | 971b86e |
| 2026-07-26T00:38:04Z | code | **배포 전 백업** — main 병합 직전 git 태그 2건 생성+push: `pre-deploy-backup-main-20260726-003804`(origin/main HEAD), `pre-deploy-backup-branch-20260726-003804`(배포 대상 브랜치 HEAD) | 태그, 커밋 아님 |
| 2026-07-26T00:38:28Z | db-snapshot | 배포 전 Staging 최종 스냅샷 — products=72(active 27), candidates=1345, ingredients=1996, offers=94, verification_queue=163, dermatology=1917, click_events=2 | data/backups/staging-snapshots/snapshot-2026-07-25T15-38-28-517Z.json |
| 2026-07-26 | db-backup | **Production DB 백업은 Supabase Dashboard/PITR 영역 — 이 세션 툴로 직접 접근 불가**(Production DB를 직접 건드리지 않기로 한 지시와 일치). 사람이 Supabase Dashboard → Database → Backups에서 배포 직전 수동 스냅샷/PITR 활성화 여부 확인 필요. 아래 최종 보고에 명시. | 확인 필요 |

## 규칙
- 코드/문서/SQL/스크립트 변경: 작업 단위마다 git commit + push
- Staging DB 데이터 변경(대량): 사전 스냅샷 → 변경 → 로그 기록
- main 병합, Production 배포 전: 반드시 전체 백업 후 진행 (이번 세션에서는 도달 시 사용자 확인 필요 — 세션 시작 시 명시적으로 예외 처리함)
- 백업 자체가 실패하면 그 작업만 중단하고 사유를 기록, 세션 전체를 멈추지 않는다
