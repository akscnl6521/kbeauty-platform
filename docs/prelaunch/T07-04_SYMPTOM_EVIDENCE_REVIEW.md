# T07-04 — Official-site symptom evidence review bundle

최종 갱신: 2026-07-24

## 목적

여드름·주사/홍조·아토피피부염·색소침착 **증상 전문 주장**에 대한 관리자 검수 번들을 준비한다.

- 로그인 자동화·CAPTCHA 우회·제한 크롤·약관 위험 스크래핑 **금지**
- **공식 병원 페이지** 또는 **승인된 공개 근거**만 매니페스트로 접수
- 미검증 증상 전문 주장은 **게시 금지**
- Organic 적격과 제휴·스폰서·유료 관계 **큐 분리**
- Production / Staging DB 쓰기 **없음** · dry-run 기본

## 기록 필드 (필수)

| 필드 | 의미 |
|------|------|
| `evidenceUrl` | 정확한 근거 URL |
| `pageTitle` | 페이지 제목 |
| `claimCategory` | `acne` / `rosacea_redness` / `atopic_dermatitis` / `pigmentation` |
| `excerptSummary` | 발췌 요약 |
| `verifiedAt` | 확인일(ISO) |
| `reviewerStatus` | pending_review / approved / rejected / needs_more_evidence / stale |
| `staleAt` | 만료·재검수 기준일 |
| `rejectionReasonCode` / `rejectionReasonKo` | 거절 사유 |

추가: `commercialRelationship`, `organicEligibility`, `queueLane`, `publishEligible`(구조적) · `publishAllowed`는 항상 `false`(dry-run).

## 검수 큐 레인

| 레인 | 의미 |
|------|------|
| `organic_review` | Organic 적격(승인·비유료·비스테일) |
| `paid_relationship_review` | affiliate / sponsored / booking_fee / lead_fee |
| `pending` | 미검증·추가근거·스테일 |
| `rejected` | 거절·정책 차단(CAPTCHA/로그인/크롤/블로그 단독 등) |

유료 관계는 Organic 적격을 **부여하지 않습니다**.

## 관리자 dry-run 절차

1. 매니페스트에 공식 URL·제목·발췌·확인일·만료일·상업 관계를 **수동** 입력
2. `npm run check:symptom-evidence-review` 실행
3. `artifacts/symptom-evidence-review/queue-*.json`에서 Organic vs 유료 레인 확인
4. `rejected`의 `rejectionReasonKo` / `rejectionCodes` 확인
5. `publishAllowed=false` · `crawlAttempted=false` 유지 확인
6. 실 공개·publishable 전환은 **사람 검수(T07)** 별도 — 이 번들에서 위장하지 않음

## 명령

```bash
npm run test:symptom-evidence-review
npm run check:symptom-evidence-review
npm run check:symptom-evidence-review -- --mode=dry_run
```

아티팩트: `artifacts/symptom-evidence-review/` (gitignore)

## 코드

- `src/lib/publicData/symptomEvidenceReview/*`
- Selftest: `scripts/symptom-evidence-review-selftest.ts`
- Runner: `scripts/run-symptom-evidence-review.ts`

## 정직 한계

- fixture / dry-run 기본 · 실 공식 페이지 live 검수·게시는 `external_only`
- `publishEligible=true`여도 dry-run에서 `publishAllowed=false` · `publicVisible=false`
- Production 미터치
