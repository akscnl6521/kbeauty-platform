# Organic commerce · Professional routing (T04)

최종 갱신: 2026-07-23

## 범위

- Organic / Affiliate / Sponsored 분리: 랭킹 · API · in-memory 지속화 · UI 라벨 · 애널리틱스 · 관리자
- 유료 관계(`isAffiliate` / `isSponsored` / commission / campaign / fee)는 **Organic score에 미반영**
- 증상 기반 전문가 라우팅 + 일반 vs 제휴 병원 분리 + evidence/review/publishable · fixture 게시 차단 · `/my/guidance` 연결

## 핵심 경로

| 영역 | 경로 |
|------|------|
| 제휴 링크 구조 | `src/lib/commercial/affiliateLink.ts` |
| Organic 랭킹 | `src/lib/commercial/organicRanking.ts` |
| 광고 슬롯 | `src/lib/commercial/adSlotPolicy.ts` |
| 이벤트 | `src/lib/commercial/commerceAnalytics.ts` |
| 지속화 | `src/lib/commercial/commerceStore.ts` |
| 라벨 | `src/lib/commercial/commerceLabels.ts` |
| 전문가 번들 | `src/lib/care/professionalGuidanceBundle.ts` |
| API | `/api/commerce/presentation` · `/api/commerce/events` · `/api/admin/commerce` · `/api/care/professional-guidance` |
| Admin | `/admin/commerce` |
| UI | `CommerceLaneBadge` · `SponsoredCard` · `ClinicReferralPanel` 레인 배지 |

## 금지

- 가짜 제휴 URL 게시
- Organic 레인에 스폰서 카드 삽입
- 건강·피부 증상 프로필로 광고 타기팅
- fixture 병원 publishable 전환
- Production DB 쓰기

## 검증

```bash
npm run test:organic-commerce
npm run test:commercial-separation
npm run test:clinic-stage6
npm run test:symptom-safety
```
