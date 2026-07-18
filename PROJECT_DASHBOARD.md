# PROJECT_DASHBOARD.md — K-Beauty Match 통합 현황판

최종 갱신: 2026-07-18  
기준 브랜치: `automation-mvp-completion` (main `2b17f5f`에서 분기)  
판정 원칙: 문서 체크박스만이 아니라 **코드 경로 + npm 스크립트/테스트 존재**를 함께 확인

---

## 한눈에 보는 진행률

| 구분 | 진행률 | 판정 |
|------|--------|------|
| 전체 최종 플랫폼 (KR+US+JP+운영) | **~66%** | 부분 완료 · 데이터 blocker |
| 한국 MVP (기능) | **~88%** | **NO-GO — 추천 제품 데이터 필요** |
| 디자인 (럭셔리 K-뷰티 UX) | **~72%** | `/results` 2단·빈 상태 보완 |
| 제품 데이터 (Staging 중심) | **~70%** | 핵심 추천 0 가능 · 출시 차단 |
| 지속 관리 (체크인·루틴) | **~88%** | 부분 완료 |
| Production 앱 배포 | **0% (미배포)** | 미완료 · **데이터·승인 보류** |
| Production DB 카탈로그 | **~5%** | 부분 (A안 COSRX 5건만) |

**다음 작업 (단일):** Staging recommendable(verified+KR offer+이미지) 확보 → Preview `/results` 재검수  
**다음이 아닌 것:** 무단 main 병합 · 무단 Production 배포 · Production DB 쓰기 · 가짜 추천 제품

---

## 영역별 상세

### 1. 전체 최종 플랫폼

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | KR 코어·관리자·파이프라인·Care 골격·PDP 기반. US/JP offer·다국어·프로덕션 운영 미완성 |
| 검증 | `npm run check:mvp` · `PROJECT_STATUS.md` |
| 다음 작업 | Phase D Care UX → E Production 준비 |
| 남은 작업량 | 대형 (수주) |

### 2. 한국 MVP

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | `/analyze`→`/results`·문진·인증·`/my`·Top5·`/products/[slug]`(verified만). 비교 UI·Prod 카탈로그 부족 |
| 검증 | `test:journey` · `test:smoke` · `test:recommendable` |
| 다음 작업 | Phase D 체크인 UX |
| 남은 작업량 | 중형 |

### 3. 디자인

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | Phase B 여정 + PDP 최소 공개면. 비교·Care polish 남음 |
| 검증 | `check:responsive` · 수동 모바일 375/390 |
| 다음 작업 | Phase D Care 화면 위계 |
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
| 근거 | `src/lib/recommend/*` · Evidence · KR offer · `recommendableCriteria` SSOT |
| 검증 | `npm run test:quality` · `test:recommendable` |
| 다음 작업 | Staging live 시 후보 풀 확대(게이트 유지) |
| 남은 작업량 | 소형 (엔진) / 중형 (데이터) |

### 6. 제품 데이터

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** · 일부 **BLOCKED** |
| 근거 | Heroes 84 · with_inci **57** · recommendable flag 58 · BLOCKED 27. Phase C offline 스냅샷·검수 큐. Live Staging 쓰기 SKIPPED · delta 0 |
| 검증 | `catalog:phase-c` · `docs/CATALOG_AUTOMATION_REPORT.md` |
| 다음 작업 | Staging link 후 안전 복구 재실행 · 공식 verbatim 시에만 INCI |
| 남은 작업량 | 중~대형 · BLOCKED는 외부 의존 |

### 7. 제품 이미지

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | backup 스캔 tiny 3건 검수 큐 · Staging 공개 9/9 이력 · Prod media 미첨부 |
| 검증 | `reports/catalog-images.json` · verify 스크립트 |
| 다음 작업 | Staging signed URL 재발급·primary 후보 (live 시) |
| 남은 작업량 | 중형 |

### 8. 판매처 (offers)

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | backup offer 2/2 OK · admin offers · KR Top5 verified offer 원칙 |
| 검증 | `reports/catalog-offers.json` · quality regression |
| 다음 작업 | live HEAD 검사·inactive 후보 (Staging만) |
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
| 근거 | `/admin/*` catalog/labels/pipeline/evidence/care · **Auto Queue** (`/admin/catalog/automation-queue`) |
| 검증 | admin auth routes · staging E2E 스크립트(승인 후) |
| 다음 작업 | 검수 큐 효율 · 대량 Verified 금지 유지 |
| 남은 작업량 | 소형 (MVP 범위) |

### 16. 자동 수집 파이프라인

| 항목 | 내용 |
|------|------|
| 상태 | **부분 완료** |
| 근거 | worker · `config/pipeline-operation.json` · discovery/enrich/labels · 자동 published 금지 |
| 검증 | `test:pipeline` · operation destructive flags false (`check:release-security`) |
| 다음 작업 | Staging live 자격증명 후 Phase C 재실행 · Prod ingestion 금지 |
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
| Phase C | offline 자동화 완료 · recommendable delta **0** · 자동 Verified 없음 |
| Phase D | 체크인·루틴·알림 UX 완료 · 이메일/크론 live 미연결 |
| Phase E | 출시 감사·환경 readiness·prod-safety · 이후 Preview 검수로 **NO-GO — 추천 제품 데이터 필요** |
| Preview results fix | `/results` 레이아웃·빈 상태·fixture 게이트 · 가짜 제품 미발명 |
| 지금 할 일 | **Production 승인 대기** (배포 아님 · 대시보드 확인 후 승인) |

자동화 진입점: `npm run check:mvp` · `catalog:phase-c` · CI · `docs/AUTOMATED_MVP_EXECUTION_PLAN.md`
