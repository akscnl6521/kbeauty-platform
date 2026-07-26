# Revisit Dashboard (WQ-C)

`/my` 재방문 홈 — pure view-model + 클라이언트 조립.

## Pure modules

- `src/lib/care/revisitDashboard.ts` — `getCareProgressState`, `getNextRecommendedAction`, `getRevisitDashboardSummary`
- `src/lib/care/quickSkinCheck.ts` — 4버튼 자가 체크 (로컬 state만, 진단 아님)

## 데이터 흐름

1. `hydrateCareDashboard()` — care dashboard DTO
2. `GET /api/care/photo-consents` — `saveForComparison`, `migrationPending` (401이면 미로그인)
3. `getRevisitDashboardSummary(input)` — UI state·다음 액션·섹션 순서

별도 revisit API는 두지 않음 (복잡도 회피). pure 함수는 selftest 대상.

## UI 섹션 (모바일 우선)

1. 다음 할 일 (pink CTA border)
2. 오늘 상태 / 상담 필요
3. Quick skin check (4버튼, follow-up)
4. 다음 체크인
5. 현재 루틴
6. 고민·변화
7. 사진 비교 (`migrationPending` → 준비 중)
8. 통계

## 테스트

```bash
npm run test:revisit-dashboard
```

## Preview 메모

- Staging 로그인 후 `/my` — 다음 할 일 카드·체크인·루틴·사진 상태 문구 확인
- 사진 migration 미적용 시 「사진 저장 기능 준비 중」
- 실제 사진 업로드·Production·main 병합 없음
