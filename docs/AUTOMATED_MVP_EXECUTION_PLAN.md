# AUTOMATED_MVP_EXECUTION_PLAN.md — 자동화 실행 계획

최종 갱신: 2026-07-18  
정책: `docs/AUTOMATION_POLICY.md` · 현황: `PROJECT_DASHBOARD.md`

**지금 목표:** Production 승인 대기 (대시보드 확인 후 배포 승인)  
**지금 아님:** 무단 Production 배포 · main 병합 · Production DB 쓰기 · Production 스케줄 등록

---

## Phase A — 자동화·현황판·CI

| 항목 | 내용 |
|------|------|
| 자동 진행 범위 | `PROJECT_DASHBOARD` · `check:mvp` · CI 개선 · 자동화 정책/계획 문서 · 워크스테이션 성능 스크립트 |
| 사용자 확인 1회 | 없음 (브랜치 작업·문서·CI만) |
| 완료 조건 | `npm run check:mvp` 필수 항목 PASS · CI 워크플로에 브랜치/PR 게이트 · 정책 문서 존재 |
| 예상 작업일 | 0.5~1일 |
| 위험 | 로컬 `.env`가 Production ref를 가리키면 DB 옵션 검사 SKIPPED (정상) |
| 상태 | **본 브랜치에서 완료** |

---

## Phase B — 핵심 사용자 여정과 디자인

| 항목 | 내용 |
|------|------|
| 자동 진행 범위 | `docs/MVP_DESIGN_COMPLETION_PLAN.md` 순서 1~8 (홈→분석→문진→결과→인증→마이) · 반응형/a11y 수정 |
| 사용자 확인 1회 | Preview에서 핵심 여정 스크린 확인 1회 (SSO 필요 시) |
| 완료 조건 | 여정 끊김 없음 · `check:responsive` · `test:journey` · 디자인 완료 조건 충족 |
| 예상 작업일 | 3~5일 |
| 위험 | analyze/results 대형 파일 회귀 · 추천 로직 실수 변경 금지 |
| 상태 | **본 브랜치에서 완료** |

---

## Phase C — 제품·이미지·판매처 데이터

| 항목 | 내용 |
|------|------|
| 자동 진행 범위 | Staging 안전 확인 · 품질 스냅샷 · 이미지/offer/INCI/중복 · 검수 큐 · recommendable SSOT · PDP |
| 사용자 확인 1회 | Staging live 재실행 후 라벨 apply/공개 승격 묶음 승인 (자격증명 준비 시) |
| 완료 조건 | 게이트 유지 · 큐/보고 생성 · 잔여 INCI BLOCKED · Production 미터치 |
| 예상 작업일 | 4~7일 (외부 출처 의존) |
| 위험 | Production ref 오인 쓰기 · invent INCI · rate limit |
| 상태 | **본 브랜치에서 완료 (offline)** · live Staging 쓰기 SKIPPED · recommendable delta 0 |

---

## Phase D — 체크인과 지속 관리

| 항목 | 내용 |
|------|------|
| 자동 진행 범위 | 체크인 UI · Day별 질문 · 안전 분기 · 알림 센터 · 이메일 adapter · worker dry-run · admin 필터 |
| 사용자 확인 1회 | 로그인 계정으로 Day 플로우 스모크 1회 (Preview) |
| 완료 조건 | 3·7·15·30 완료/스킵 · 진단 문구 없음 · 루틴 강제 변경 없음 · dry-run PASS |
| 예상 작업일 | 2~3일 |
| 위험 | PII 로그 · admin 집계 노출 · 실제 이메일 오발송 |
| 상태 | **본 브랜치에서 완료** · Staging DB/이메일 live SKIPPED |

---

## Phase E — 최종 테스트와 Production 준비

| 항목 | 내용 |
|------|------|
| 자동 진행 범위 | 출시 감사 · 여정 A–H · env readiness · prod-safety · 체크리스트/롤백/판정 · check:mvp |
| 사용자 확인 | Preview 육안 · Vercel AI_PROVIDER/SITE_URL · Auth URL · 도메인 · **「Production 배포 진행」** |
| 완료 조건 | 정적 게이트 PASS · 문서 판정 기록 · **배포는 승인 후** |
| 상태 | **본 브랜치에서 완료** · 한국 MVP GO WITH MANUAL CHECKS · Production 배포 미실행 |

---

## 병렬화 가이드 (워크스테이션)

- Phase A/B: 문서·정적 검사 병렬 (`run-parallel-safe-checks`)
- Phase C: URL/이미지 검사 병렬 · HTTP 동시성 4~8 · CPU 워커 ≤75%
- 순차: install · migration · 동일 파일 수정 · commit/push · 최종 build · Prod 관련

설정: `scripts/catalog-worker-config.mjs` · 보고: `scripts/system-capability-report.mjs`
