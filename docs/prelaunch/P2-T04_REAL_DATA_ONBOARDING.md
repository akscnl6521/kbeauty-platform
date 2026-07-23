# P2-T04 — Real data onboarding readiness

최종 갱신: 2026-07-24
분류: `verified_complete` (계약·비공개 fixture·dry-run selftest) · 실공식 KR 제품·실병원 publishable·Staging/Production 쓰기는 `external_only`

## 목적

실제 데이터를 **발명하지 않고** 온보딩할 수 있도록 준비한다.

| 항목 | 내용 |
|------|------|
| source manifests | 허용/차단 출처 · tier · accessMode |
| field provenance | 필드별 출처·상태 |
| official-source priority | tier1 공식 > 인증판매 > 마켓/피드 > fixture |
| stale/refresh rules | 제품·병원 만료·재확인·게시 차단 |
| review checklists | KR 제품·병원/전문가 검수 항목 |
| import templates | CSV 헤더·비공개 샘플 행 |
| dry-run validation | 메모리 검증 · 쓰기 없음 |
| rejection reasons | 거절 코드 카탈로그 |

**유료 API · 로그인 스크랩 · CAPTCHA 우회 · Production 쓰기 금지.**

## 명령

```bash
npm run test:real-data-onboarding
```

## 계약·경로

| 경로 | 역할 |
|------|------|
| `src/lib/onboarding/realDataOnboarding/*` | 계약·매니페스트·dry-run·적격성 |
| `scripts/real-data-onboarding-selftest.ts` | selftest |
| `docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md` | 본 문서 |

## 정직 경계 (위장 금지)

| 주장 | 사실 |
|------|------|
| fixture 제품/병원 | **비공개** · publishable/추천 불가 |
| dry-run 공식 예시 | 메모리 시나리오만 · 실출처·실게시 아님 |
| `eligible_for_staging_review` | 스테이징 검수 후보 가능 ≠ 핵심 추천 공개 |
| 마켓 단독 출처 | 거절 (`official_source_not_priority`) |
| 유료 API / CAPTCHA 우회 | `blocked_policy` |
| 가격·재고 발명 | 거절 |
| Staging/Production DB 쓰기 | **미실행** |
| 실공식 KR 제품·실병원 | **미연결** (`external_only` · T07/EX-11) |

## 금지

- 가짜 제품·가격·재고·병원·예약 URL 발명
- fixture를 공식 publishable로 표기
- 유료 API·인증 스크랩·CAPTCHA 우회
- Production INSERT/UPDATE/DELETE

## 관련

- T03 제품 자동화: `docs/catalog-product-automation.md`
- P2-T03 Admin review E2E: `docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md`
- Stage 6 clinic: `test:clinic-stage6`
- next_task: T07 공식 병원 실출처 (`external_only`)
