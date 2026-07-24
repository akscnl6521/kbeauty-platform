# T07-03 — Institution detail enrichment + specialist evidence

최종 갱신: 2026-07-24

## 목적

T07 후보를 공식 HIRA **기관상세** 서비스(`MadmDtlInfoService` / `getDgsbjtInfo`)로 보강한다.

- 진료과목·전문의 수(`dgsbjtPrSftCnt`)만 **공식 필드**에서 수집
- 상호명만으로 피부과/전문의 **추론 금지** · 미확인 값은 `null`
- 피부과 전문의 근거 ↔ 증상 전문 주장 **분리** (기관상세만으로 증상 전문 주장 금지)
- 게시(publish) **금지** · Production / Staging DB 쓰기 **없음**

## 증거 모델

| 필드 | 의미 |
|------|------|
| `evidenceStrength` | `none` / `weak` / `moderate` / `strong` |
| `lastVerifiedAt` | 마지막 공식 검증 시각 |
| `conflictingSourceState` | `none` / `conflict` / `unresolved` |
| `failure.retryable` | 재시도 가능 실패 여부 |
| `manualReviewReasons` | 수동 검수 사유 코드 |

증상 전문 주장(`symptomExpertise`)은 항상 `claimedFromInstitutionDetail=false`, `claims=[]`.

## 파이프라인 기능

- **bounded concurrency** (기본 3 · 상한 8)
- **cache** (ykiho · TTL 24h) + **checkpoint** 재개
- dry-run **audit** 아티팩트
- fixture selftest

## 명령

```bash
npm run test:institution-detail-enrichment
npm run check:institution-detail-enrichment
npm run check:institution-detail-enrichment -- --mode=fixture --concurrency=3
```

아티팩트: `artifacts/institution-detail-enrichment/` (gitignore)

## 코드

- `src/lib/publicData/institutionDetailEnrichment/*`
- T07-01 클라이언트 재사용: `getDepartmentInfo` / `getFacilityInfo`

## 정직 한계

- fixture / dry-run 기본 · 실 API live는 키·승인 후
- 후보 보강 ≠ publishable · 사람 검수(T07) 별도
- Production 미터치
