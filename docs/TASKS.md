# TASKS — K-Beauty Match 개발 태스크 보드

> 최종 갱신: 2026-07-11  
> 코드 변경 없이 문서만 관리. 완료 시 `[x]`, 진행/예정은 `[ ]`로 표시.

---

# Sprint 1

**초점:** 프로젝트 이해 · 문서화 · 추천 파이프라인 Phase 1 (AI → Recommendation 객체)

## Completed

- [x] 프로젝트 전체 구조·페이지·Supabase·AI 현황 분석
- [x] `docs/` 기초 문서 세트 작성 (Vision, ProjectRule, Architecture, DB, AI, API, Roadmap)
- [x] `README.md` K-Beauty Match 전용으로 재작성
- [x] `docs/ProjectInventory.md` 기술 인벤토리 작성
- [x] `docs/AIAnalysis_Current.md` analyze 페이지 동작 문서화
- [x] `docs/AI_Security_Migration.md` AI 보안 마이그레이션 계획 작성
- [x] `docs/RecommendationEngine.md` 추천 엔진 설계
- [x] `docs/RecommendationFlow_ImplementationPlan.md` 연결 구현 계획 작성
- [x] Phase 1: AI 응답 → `Recommendation` 구조화 (`src/lib/recommend/*`)
- [x] Phase 1: `skinRecommendation` localStorage 저장 (UI 동작 유지)

## In Progress

- [ ] Sprint 태스크 보드(`TASKS.md`) 운영 시작
- [ ] Phase 1 산출물(`Recommendation`)을 이후 Phase와 계약으로 고정할지 팀 확인

## Next Tasks

- [ ] Phase 2: 성분 추천(R+) — AI 성분 ↔ DB/`key_ingredients` 매칭
- [ ] Phase 1 보강: analyze → results로 `Recommendation` 전달 계약 확정
- [ ] `/ingredients` 목록 404 또는 홈 링크 수정
- [ ] AI 보안 Phase 1: `POST /api/analyze` 설계 착수 (키 서버 이전)

## Bugs

- [ ] 홈 `/ingredients` 링크 → 목록 페이지 없음 (404)
- [ ] analyze 「성분별로 보기」가 `href="#"`
- [ ] 퀴즈 `age` / `warmth` 쿼리가 results에서 미사용
- [ ] 사진 모드 results 이동 시 `tone`이 항상 `Medium`
- [ ] 사이트맵에 `/analyze`, `/routine`, `/face-explorer` 누락

## Ideas

- [ ] `Recommendation`에 `engineVersion` 필드 추가
- [ ] analyze UI에 confidenceScore를 작게 표시할지 검토 (현재는 저장만)
- [ ] Ollama 로컬 분석 경로를 Sprint 2 보안에 넣을지 결정

---

# Sprint 2

**초점:** 추천 파이프라인 연결 (성분 → 제품 검색 → 랭킹) · AI 키 서버 이전

## Completed

- [ ] (아직 없음 — Sprint 2 시작 시 이동)

## In Progress

- [ ] (대기)

## Next Tasks

- [ ] Phase 2: `src/lib/recommend`에 성분 정규화·매칭 모듈 추가
- [ ] Phase 3: Supabase 제품 후보 검색 (전량 1만 건 로드 축소)
- [ ] Phase 4: 제품 스코어링·정렬 (`match_breakdown`)
- [ ] Phase 5: `/results` UI에 매칭 성분·고민 근거 표시
- [ ] `POST /api/analyze`로 Anthropic 브라우저 직접 호출 제거
- [ ] `NEXT_PUBLIC_ANTHROPIC_API_KEY` 제거 및 키 로테이션
- [ ] 퀴즈·face-explorer 진입을 동일 `Recommendation`/쿼리 계약에 맞춤
- [ ] `docs/05_AI.md`, `docs/06_API.md` 구현 반영 갱신

## Bugs

- [ ] (Sprint 2에서 발견 시 추가)
- [ ] results 구매 링크(`link_*`) select만 하고 UI 미연결 — 노출 여부 결정 필요

## Ideas

- [ ] `POST /api/recommend`로 검색+랭킹 일괄 API
- [ ] 성분 동의어 사전 테이블
- [ ] 로컬 `AI_PROVIDER=ollama` 개발 기본값
- [ ] 결과 카드 컴포넌트 (`src/components`) 분리

---

# Sprint 3

**초점:** 루틴·제휴 링크·피드백 · SEO/다국어 · 고도화 준비

## Completed

- [ ] (아직 없음 — Sprint 3 시작 시 이동)

## In Progress

- [ ] (대기)

## Next Tasks

- [ ] 루틴 엔진: 슬롯 배치 + 성분 충돌 검사 (`routine/page.tsx` 연동)
- [ ] 제휴 링크 셀렉터 (국가·로케일 우선순위)
- [ ] 피드백 이벤트 수집 초안 (즐겨찾기·숨김·클릭)
- [ ] URL locale / `<html lang>` 동적화 검토
- [ ] 사이트맵·메타데이터 SEO 보강
- [ ] 번역 키 `locales/*.json` 통합
- [ ] (선택) 인증·즐겨찾기 서버 동기화 설계
- [ ] (선택) pgvector / RAG 설명 보강 PoC

## Bugs

- [ ] (Sprint 3에서 발견 시 추가)
- [ ] i18n 불일치 (results 자체 메시지, face-explorer 한국어 고정 등)

## Ideas

- [ ] 대화형 스킨케어 어시스턴트 (도구 호출 → recommend API)
- [ ] 추천 A/B (`engine_version`)
- [ ] 관리자용 성분·제품 맵 검수 UI
- [ ] E2E 스모크 (analyze → recommendation → results)

---

## 사용 방법

1. 작업 시작 시 해당 항목을 **In Progress**로 옮기고 `[ ]` 유지  
2. 완료 시 **Completed**로 옮기고 `[x]`  
3. 버그/아이디어는 발견 즉시 해당 Sprint에 추가  
4. Sprint 종료 시 미완료 **Next Tasks**는 다음 Sprint로 이동  

## 관련 문서

- [`RecommendationFlow_ImplementationPlan.md`](./RecommendationFlow_ImplementationPlan.md)
- [`AI_Security_Migration.md`](./AI_Security_Migration.md)
- [`RecommendationEngine.md`](./RecommendationEngine.md)
- [`ProjectInventory.md`](./ProjectInventory.md)
