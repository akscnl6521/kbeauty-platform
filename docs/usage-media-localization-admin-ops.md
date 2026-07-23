# Usage media localization · Admin ops (T05)

최종 갱신: 2026-07-23

## 범위

- 사용 가이드 메타: 도포량·순서·빈도·주의·패치 테스트·도포 영상 + 정직한 fallback
- 국가·언어별 offer 표시: 재고·가격·판매처 **미발명** · 미확인 지역은 빈 상태
- 관리자 운영: 후보 검수 · 중복 병합 · 근거 검토 · 상태 전환 · 만료 갱신 큐 · 재시도 · 감사 기록 · local/Staging dry-run

## 핵심 경로

| 영역 | 경로 |
|------|------|
| 가이드 메타·fallback | `src/lib/media/usageGuidanceComplete.ts` |
| 지역 offer | `src/lib/commerce/localizedOffers.ts` |
| Admin ops | `src/lib/catalog/adminOps/*` |
| UI | `src/components/usage/ProductUsageGuide.tsx` |
| Admin | `/admin/catalog/ops` |
| API | `/api/admin/catalog-ops` |

## 금지

- 없는 재고·가격·판매처 행 생성
- 미검증 패치 테스트·영상 자동 완성
- Production / Staging DB 쓰기 (dry-run in-memory만)
- fixture를 publishable로 위장

## 검증

```bash
npm run test:usage-media-admin-ops
npm run test:usage-media
```
