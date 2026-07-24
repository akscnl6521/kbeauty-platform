# T07-05 — Admin dry-run and publishable gate

최종 갱신: 2026-07-24

## 목적

T07 전체 dry-run을 **HIRA 후보 수집 → 기관상세 보강 → 증상 근거 검수 → 관리자 publishable 게이트**까지 한 번에 실행하고, 공개 노출·게시 가능성을 정직하게 판정한다.

- fixture·실패·스테일·출처충돌·근거부족 기록은 **공개 금지**
- publishable(구조적)은 **필수 공식 근거 + 관리자 명시 승인** 후에만
- dry-run에서 `publishAllowed=false` · `publicVisible=false` 고정
- 유료 관계 필드는 **Organic 순위·clinical fit에 영향 없음**
- Staging/Production DB 쓰기 **없음**

## 단계

| 단계 | 재사용 | 역할 |
|------|--------|------|
| `hira_ingestion` | T07-02 | 서울 피부과 HIRA 후보 수집 |
| `institution_enrichment` | T07-03 | 진료과목·전문의 수·충돌/재시도 |
| `symptom_evidence_review` | T07-04 | 공식 사이트 증상 근거 큐 |
| `admin_publishable_gate` | T07-05 | 관리자 적격·구조적 publishable·감사 |

## 게이트 규칙

| 조건 | 결과 |
|------|------|
| fixture | `structurallyPublishable=false` · 공개 금지 |
| failed / stale / conflicting / insufficient-evidence | 공개 금지 · 구조적 publishable 불가 |
| 공식 근거 있음 + 관리자 미승인 | `admin_review_eligible` 가능 |
| 공식 근거 있음 + 관리자 승인 + 하드블록 없음 | `structurally_publishable` (여전히 `publishAllowed=false`) |
| dry-run 전체 | `publicVisible=false` |

## 감사 산출물

`artifacts/admin-dry-run-publishable-gate/`

- `audit-*.json` — 상태·사유 집계 · 단계 요약 · 상업 독립성 증명 · 사람 작업
- `records-*.json` — 레코드별 게이트 결과 (비밀키 없음)
- `summary-*.csv` — status/reason counts
- `human-actions-*.json` — 1회성 사람 작업

## 1회성 사람 작업 (에이전트 미실행)

1. **공식 사이트 증상 근거 사람 검수** (`HUMAN-T07-OFFICIAL-SITE-EVIDENCE`)
2. **Staging import 1회 승인** (`HUMAN-T07-STAGING-IMPORT-APPROVAL`)

Production 배포·main 병합·Production DB 쓰기는 **별도 명시 승인 전 금지**.

## 명령

```bash
npm run test:admin-dry-run-publishable-gate
npm run check:admin-dry-run-publishable-gate
npm run check:admin-dry-run-publishable-gate -- --mode=dry_run
```

## 코드

- `src/lib/publicData/adminDryRunPublishableGate/*`
- Selftest: `scripts/admin-dry-run-publishable-gate-selftest.ts`
- Runner: `scripts/run-admin-dry-run-publishable-gate.ts`

## 정직 한계

- fixture / dry-run 기본 · 실 HIRA live·실 공식 페이지 검수·Staging import·publishable 전환은 `external_only`
- `structurallyPublishable=true`여도 dry-run에서 `publishAllowed=false`
- Production 미터치
