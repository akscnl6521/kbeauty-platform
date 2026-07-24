# P3-T04 — Affiliate and sponsored revenue readiness

최종 갱신: 2026-07-24
상태: **코드·fixture dry-run 완료** · 실 제휴 계약·수익 채널 연결은 `external_only`

## 목적

실 상업 계약을 **활성화하지 않은 채** 제휴·스폰서 **수익 준비 아키텍처**를 완성한다.

포함:

- affiliate offer ingestion
- sponsored placement contracts
- clear disclosure (Organic 이유로 위장 금지)
- click / conversion event contracts
- country-specific purchase links
- expiry handling
- admin approval (구조적 승인 ≠ 계약 활성화)
- analytics privacy boundaries (건강·증상 타기팅 금지)
- Organic 순위 · 증상/전문가 라우팅 독립성 증명

## 구현 범위

| 항목 | 내용 |
|------|------|
| Affiliate offer | 파트너·캠페인·국가별 구매 링크·disclosure · 수수료율 미발명 |
| Sponsored placement | `sponsored_rail` / `affiliate_aside` / `clinic_partner_aside` · Organic zone 금지 |
| Disclosure | 기본 문구 · Organic lookalike 거절 |
| Events | impression/click/lead/conversion · 건강 타기팅 거부 |
| Country links | KR/US 등 국가 코드 · fixture URL만 · 미검증 live URL 거절 |
| Expiry | startsAt / expiresAt · expired → 공개 유료 표면 불가 |
| Admin | needs_review → admin_approved(구조) → `activation_blocked` |
| Privacy | health/symptom/beautyProfile/photo 타기팅 금지 |
| Independence | Organic score·professional routing 유료 필드 독립 |

## 금지 (강제)

- 실 상업 계약 활성화 (`commercialAgreementsActivated=false`)
- 수수료율·실 URL 발명 (`inventedCommissionRates=false` · `inventedLiveUrls=false`)
- 공개 유료 표면 (`allowPublicPaidSurface=false` · `publicVisible=false`)
- DB/Production 쓰기 · 유료 API
- Organic 추천 레인에 스폰서 배치
- 건강·증상으로 광고 타기팅

## 코드

| 경로 | 역할 |
|------|------|
| `src/lib/commercial/revenueReadiness/*` | 계약·ingestion·disclosure·expiry·admin·events·privacy·independence·pipeline |
| `scripts/revenue-readiness-selftest.ts` | selftest |
| `scripts/run-revenue-readiness.ts` | dry-run 러너 |

## 명령

```bash
npm run test:revenue-readiness
npm run check:revenue-readiness
```

## 안전 플래그 (항상)

- `publishAllowed=false`
- `publicVisible=false`
- `commercialAgreementsActivated=false`
- `databaseTouched=false`
- `writeAttempted=false`
- `productionTouched=false`
- `paidApiUsed=false`
- `inventedCommissionRates=false`
- `inventedLiveUrls=false`

## 운영 절차 (사람 · 에이전트 미실행)

1. 실 파트너 계약·수수료율·실 URL 확보 (법무/사업)
2. 관리자 검수 → Staging dry-run import 승인
3. disclosure·국가별 링크·만료일 재확인
4. 수익 채널/트래킹 키 연결 (EX-12)
5. Production 활성화는 **별도 명시 승인** 후에만

## 미검증 (`external_only`)

- 실제휴 URL·실 수수료율·실 수익 채널
- Production 상업 계약 활성화
- 실 conversion 수익 정산

## 관련

- T04 Organic/Affiliate/Sponsored 분리 (`test:organic-commerce`)
- EX-12 실제 제휴 URL·수익 채널 연결
- RE-07 제휴·광고 계약 상태 갱신 · rollback (잔여)
