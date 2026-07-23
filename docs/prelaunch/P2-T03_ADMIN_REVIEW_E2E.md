# P2-T03 — Admin review end-to-end verification

최종 갱신: 2026-07-24
분류: `verified_complete` (로컬 fixture · Staging-safe dry-run · selftest) · Preview 관리자 로그인 육안·공식 병원 실출처는 `external_only`

## 목적

제품·병원/전문가 후보 검수의 **끝단 검증 하네스**로 아래를 증명한다.

| 단계 | 내용 |
|------|------|
| candidate | 후보 시드(fixture) 적재 |
| evidence_review | 근거 검토 · 병원 필드 검증 |
| duplicate_decision | 중복 병합/유지 |
| needs_review | 검수 중 상태 |
| admin_reviewed | 관리자 검수 완료(제품=`approved_staging` · 병원=`admin_reviewed`) |
| publishable | 게시 가능 평가(fixture 차단 · dry-run 공식만 허용) |
| public_visibility | fixture·미승인 비공개 |
| organic_ranking | 유료 관계가 Organic 순위를 바꾸지 않음 |

**기본은 local fixture / Staging dry-run.** Production·Staging DB 쓰기 없음.

## 명령

```bash
# 계약·시나리오·공개성·Organic 회귀 selftest
npm run test:admin-review-e2e
```

## 계약·재사용

| 경로 | 역할 |
|------|------|
| `src/lib/admin/adminReviewE2E.ts` | E2E 하네스·공개 게이트·리포트 |
| `src/lib/catalog/adminOps/*` | 제품/사용가이드 후보·근거·중복·전환 dry-run |
| `src/lib/clinic/clinicVerification.ts` | 병원 `admin_reviewed`→`publishable` |
| `src/lib/clinic/clinicCollection.ts` | fixture 시드 · fixtureOnly |
| `src/lib/commercial/organicRanking.ts` | Organic 순위 · 유료 필드 불변 |
| `/admin/review` · `/admin/clinics` · `/admin/catalog/ops` | 관리자 UI 진입점 |

## 정직 경계 (위장 금지)

| 주장 | 사실 |
|------|------|
| fixture 병원 publishable | **불가** (`fixtureOnly`) |
| dry-run 공식 병원 publishable | 메모리 시나리오만 · 실출처 아님 |
| admin ops `approved_staging` | Staging 검수 완료 ≠ 핵심 추천 공개 |
| 제품 공개 | `publicationStatus=published` + 비fixture + 근거 완료 + 승인 상태 |
| Preview 관리자 로그인 육안 | **미검증** (`external_only`) |
| 공식 병원 실출처 | **미연결** (`external_only` · T07) |

## 금지

- Staging/Production INSERT·UPDATE·DELETE
- fixture를 공식 publishable로 표기
- 유료/제휴 필드로 Organic score·순위 변경
- Preview SSO/로그인 우회

## 관련

- T05 admin ops: `docs/usage-media-localization-admin-ops.md`
- T04 Organic: `docs/organic-commerce-professional-routing.md`
- Stage 6 clinic: `test:clinic-stage6`
- P2-T01/T02: Preview 라우트 · Staging 릴리스 게이트
