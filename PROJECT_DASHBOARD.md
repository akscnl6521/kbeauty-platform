# PROJECT_DASHBOARD.md — K-Beauty Match 통합 현황판

최종 갱신: 2026-07-18  
기준 브랜치: `automation-mvp-completion` (main `2b17f5f`에서 분기)  
판정 원칙: 문서 체크박스만이 아니라 **코드 경로 + npm 스크립트/테스트 존재**를 함께 확인

---

## 한눈에 보는 진행률

| 구분 | 진행률 | 판정 |
|------|--------|------|
| 전체 최종 플랫폼 (KR+US+JP+운영) | **~58%** | 부분 완료 |
| 한국 MVP (기능) | **~72%** | 부분 완료 |
| 디자인 (럭셔리 K-뷰티 UX) | **~42%** | 부분 완료 |
| 제품 데이터 (Staging 중심) | **~68%** | 부분 완료 · INCI 잔여 BLOCKED |
| 지속 관리 (체크인·루틴) | **~65%** | 부분 완료 · UX 미완성 |
| Production 앱 배포 | **0% (미배포)** | 미완료 |
| Production DB 카탈로그 | **~5%** | 부분 (A안 COSRX 5건만) |

**다음 작업 (단일):** 한국 MVP 디자인 및 핵심 사용자 여정 완성  
**다음이 아닌 것:** Production 배포 · main 병합 · Production DB 쓰기

---

## 영역별 상세

### 1. 전체 최종 플랫폼

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | KR 코어·관리자·파이프라인·Care 골격 있음. US/JP offer·다국어·프로덕션 운영 미완성 |
| 검증 | `npm run check:mvp` · `PROJECT_STATUS.md` |
| 다음 작업 | Phase B 여정/디자인 → C 데이터 → D Care UX → E Production 준비 |
| 남은 작업량 | 대형 (수주) |

### 2. 한국 MVP

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/analyze`→`/results`·문진·인증·`/my`·추천 Top5·Evidence 존재. 공개 제품 상세/비교·디자인 polish·Prod 카탈로그 부족 |
| 검증 | `test:journey` · `test:smoke` · Preview SSO 검수 이력 |
| 다음 작업 | 디자인 실행 순서 Phase B (`docs/MVP_DESIGN_COMPLETION_PLAN.md`) |
| 남은 작업량 | 중~대형 |

### 3. 디자인

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | cream/`#C2185B` 톤·SiteHeader·responsive 정적 검사 있음. analyze/results가 길고 카드·폼 밀도 높음. 공개 PDP/비교 없음 |
| 검증 | `check:responsive` · 수동 모바일 375/390 |
| 다음 작업 | 홈→분석→결과→인증→마이 순 리파인 (전면 재디자인 금지) |
| 남은 작업량 | 중형 |

### 4. 사용자 분석

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `src/app/analyze/page.tsx` · `POST /api/analyze` · Mock/OpenAI/Anthropic 경로. `AI_PROVIDER=mock` prod 금지 |
| 검증 | `test:smoke` (route) · 로컬 `/analyze` |
| 다음 작업 | UX 단축·럭셔리 레이아웃 · 서버 키만 사용 유지 |
| 남은 작업량 | 소~중형 |

### 5. 추천 엔진

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** (코어 강함) |
| 근거 | `src/lib/recommend/*` · Evidence · KR offer 적격 · `test:quality` selftest |
| 검증 | `npm run test:quality` · Staging `check:staging-quality` (시크릿 필요) |
| 다음 작업 | 결과 UI 가독성 · 공개 상세 연결 |
| 남은 작업량 | 소형 (엔진) / 중형 (UI) |

### 6. 제품 데이터

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** · 일부 **BLOCKED** |
| 근거 | Staging heroes~84 · with_inci **57** · 잔여 27 공식 INCI **BLOCKED**. Production A안 5건만 |
| 검증 | `catalog:labels:status` · Staging 읽기 스크립트 |
| 다음 작업 | 공식 verbatim 확보 시에만 INCI 재개 · 공개용 verified+offer 확대는 Staging 먼저 |
| 남은 작업량 | 중~대형 · BLOCKED 구간은 외부 의존 |

### 7. 제품 이미지

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/api/catalog/product-images` · Staging 공개 9/9 검증 이력 · Snail 96 복구. Prod media 미첨부 |
| 검증 | `scripts/verify-staging-public-product-images.mjs` |
| 다음 작업 | 결과·상세 히어로 품질 · 누락 이미지 큐 |
| 남은 작업량 | 중형 |

### 8. 판매처 (offers)

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `product_offers` · admin offers · pipeline verified offer 게이트. KR Top5 verified offer 원칙 |
| 검증 | admin `/admin/offers` · quality regression |
| 다음 작업 | KR verified offer 밀도 · freshness 모니터링 |
| 남은 작업량 | 중형 |

### 9. 사용자 인증

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/login` `/signup` `/forgot-password` · Supabase Auth · `/my` 보호 · open redirect 차단 selftest |
| 검증 | `test:journey` · `test:smoke` |
| 다음 작업 | 럭셔리 폼 UI · Prod Auth URL 확인은 Phase E |
| 남은 작업량 | 소형 |

### 10. 마이페이지

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/my` · analyses · recommendations · settings · progress |
| 검증 | smoke inventory · 로그인 후 수동 |
| 다음 작업 | 정보 계층·여백·다음 액션 명확화 |
| 남은 작업량 | 소~중형 |

### 11. 루틴

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/my/routine` · `/routine` · `/my/routine/new` |
| 검증 | 라우트 존재 · care API |
| 다음 작업 | 루틴 UX·빈 상태·모바일 |
| 남은 작업량 | 중형 |

### 12. 3·7·15·30일 체크인

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/my/check-ins` · care persistence · schedule 로직 · admin care |
| 검증 | care API routes · journey 관련 selftest |
| 다음 작업 | 체크인 플로우 디자인 완성 (Phase D) |
| 남은 작업량 | 중형 |

### 13. 피부과 상담 분기

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | 홈/결과/헤어 문진·Evidence guidance·care `referralLevel` / dermatologyHints |
| 검증 | 코드 경로 grep · 결과 카피 |
| 다음 작업 | 분석·결과에서 상담 분기 UI를 더 명시적·접근성 있게 |
| 남은 작업량 | 소형 |

### 14. AI 피부 코치

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | 분석 API + Care suggestions. “코치” 전용 지속 대화 UX는 약함 |
| 검증 | `/api/analyze` · `/api/care/suggestions` |
| 다음 작업 | 체크인 피드백 문장·안전 가드레일 유지 |
| 남은 작업량 | 중형 |

### 15. 관리자

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** (기능 풍부 · UX 운영용) |
| 근거 | `/admin/*` catalog/labels/pipeline/evidence/care 다수 페이지 |
| 검증 | admin auth routes · staging E2E 스크립트(승인 후) |
| 다음 작업 | MVP 공개 UX 우선 · admin은 검수 효율만 소폭 |
| 남은 작업량 | 소형 (MVP 범위) |

### 16. 자동 수집 파이프라인

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | worker · `config/pipeline-operation.json` · discovery/enrich/labels · 자동 published 금지 |
| 검증 | `test:pipeline` · operation destructive flags false (`check:release-security`) |
| 다음 작업 | Phase C에서 Staging 비파괴 수집만 · Prod ingestion 금지 |
| 남은 작업량 | 중형 |

### 17. Production 준비 상태

| 항목 | 내용 |
|------|------|
| 상태 | **미완료** (준비 검사만 통과) |
| 근거 | main 코드 병합 **완료**. 앱 Production 배포 **미실행**. DB A안 5건만. `check:production` 정적 통과 |
| 검증 | `check:production` · `check:release-security` · 라이브 배포 여부(별도) |
| 다음 작업 | Phase E에서만 체크리스트 정리 · **배포는 사용자 승인 후** |
| 남은 작업량 | 중형 (승인 게이트) |

---

## 사실 정리 (혼선 제거)

| 사실 | 상태 |
|------|------|
| `backup-sprint14` → **main 병합** | 완료 (`2b17f5f`) |
| Production **애플리케이션** 배포 | **안 함** |
| Production **DB** 일부 데이터 | A안 COSRX **5건** (verified_at NULL, media/offer 없음) |
| Preview 검증 | SSO UI + Staging 대체 검증 **완료** 이력 |
| 지금 할 일 | **디자인·핵심 여정** (배포 아님) |

자동화 진입점: `npm run check:mvp` · CI (이 브랜치 push / main PR) · `docs/AUTOMATED_MVP_EXECUTION_PLAN.md`
