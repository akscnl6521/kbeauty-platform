# P3-T05 — Integrated Staging import package

최종 갱신: 2026-07-24
상태: **코드·fixture/dry-run·사람 검수 패키지 완료** · 실 Staging import·Production은 `external_only`

## 목적

현재 브랜치의 제품·병원 후보와 운영 메타를 **하나의 Staging import 검수 패키지**로 묶는다.

포함 섹션:

| 섹션 | 내용 |
|------|------|
| product_candidates | P3-T01/T02·P2-T04 제품 후보 |
| clinic_candidates | T07-02~05·P3-T03 병원 후보 |
| provenance | 출처/필드 완전성 |
| review_states | needs_review / admin_reviewed / blocked 등 |
| duplicates | duplicateOf · 미해소 중복 |
| rejection_reasons | 통합 거절 코드 |
| refresh_status | fresh / due / stale / needs_refresh |
| commercial_separation | Organic 정렬·유료 레인 독립 |
| publishable_gates | 구조적 publishable ≠ 공개/실 import |
| human_review_package | 이후 1회성 사람 승인 절차 |

## 구현 범위

| 항목 | 내용 |
|------|------|
| 통합 행 | `StagingImportRow` — lane·provenance·review·duplicate·rejection·refresh·commercial·gate |
| fixture | 비공개 · `structurallyStagingImportEligible=0` |
| dry-run | 메모리 구조적 적격 시나리오만 · 실 import 미실행 |
| 상업 분리 | 유료 레인으로 Staging 적격 부여 금지 · Organic 순서 불변 |
| 사람 패키지 | JSON + Markdown · 1회성 단계 6건 |
| 자동 스위트 | focused·integration·release-security·build |

## 금지 (강제)

- Staging/Production DB 쓰기 (`writeAttempted=false` · `databaseTouched=false`)
- Staging import 실행 위장 (`stagingImportExecuted=false`)
- 승인 완료 위장 (`stagingImportApprovalClaimed=false`)
- fixture 공개/import
- main 병합 · Production 배포
- 유료 API · CAPTCHA/로그인 우회

## 코드

| 경로 | 역할 |
|------|------|
| `src/lib/onboarding/stagingImportPackage/*` | 계약·매핑·게이트·상업분리·사람절차·리포트·파이프라인 |
| `scripts/staging-import-package-selftest.ts` | selftest |
| `scripts/run-staging-import-package.ts` | 통합 러너 + 아티팩트 |

## 명령

```bash
npm run test:staging-import-package
npm run check:staging-import-package
npm run check:staging-import-package -- --skip-commands
npm run check:staging-import-package -- --mode=dry_run
```

## 아티팩트

| 경로 | 내용 |
|------|------|
| `artifacts/staging-import-package/latest-result.json` | 사람 검수 패키지 machine-readable |
| `artifacts/staging-import-package/latest-summary.md` | 사람용 요약·1회성 절차 |
| `artifacts/staging-import-package/audit-latest.json` | 감사 |
| `artifacts/staging-import-package/rows-latest.json` / `.csv` | 통합 행 |

## 안전 플래그 (항상)

- `publishAllowed=false`
- `publicVisible=false`
- `stagingImportExecuted=false`
- `stagingImportApprovalClaimed=false`
- `databaseTouched=false`
- `writeAttempted=false`
- `productionTouched=false`
- `mainMergeAttempted=false`

## 운영 절차 (사람 · 에이전트 미실행)

1. 제품 후보·provenance·거절 사유 검수
2. 병원 후보·공식/증상 근거 검수
3. 갱신 상태·중복 해소
4. 상업 분리·Organic 비오염 확인
5. **Staging import 1회 승인 후 사람 실행**
6. Production/main은 **별도 명시 승인** 전 금지

## 미검증 (`external_only`)

- 실 공식 KR 제품 live · verified SKU (EX-11)
- 실 HIRA/병원 live · Staging import 승인·실행 (EX-04)
- 실제휴 URL·수익 채널 (EX-12)
- Preview/실기기 육안 · Production 배포

## 관련

- P3-T01~T04 · T07-02~05 · P2-T03/T04
- next_task: `T07` 공식 병원 실출처 live/사람 검수 · Staging import 승인
