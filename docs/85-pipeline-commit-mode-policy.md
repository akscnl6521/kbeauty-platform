# 85 — Pipeline Commit Mode Policy

## 전환 금지

스케줄러/자동 실행이 dry_run → commit으로 전환하지 않는다.

## Commit 허용 조건

- 배치 `mode=commit` 명시 (UI/API)
- worker는 `--allowCommit=true` 필요
- 공식 출처·confidence·중복 검사 통과 항목만
- discovery candidate / verification queue / audit만
- **published 금지 · verified offer 자동 생성 금지**

## 상시 승인

정상 commit 배치는 브랜드/제품별 추가 승인 없이 실행 가능 (기존 상시 승인 범위).
이번 최초 검증에서는 commit을 실행하지 않는다.
