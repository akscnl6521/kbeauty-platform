# ROADMAP.md — K-Beauty Match

최종 갱신: 2026-07-13

상세 기술 초안은 `docs/07_Roadmap.md`에도 있으나, **현재 실제 진행 상태는 본 문서를 우선**한다.

---

## 1. 완료

- [x] GitHub 연결
- [x] 기본 프로젝트 구조
- [x] Supabase 제품 조회
- [x] 추천 파이프라인
- [x] AI 분석 API (`POST /api/analyze`)
- [x] Mock AI
- [x] 확장 분석 결과 구조
- [x] 결과 페이지 연결
- [x] 핵심 추천 Top 5
- [x] 일반 제품 탐색 분리
- [x] 성분 표시명 표준화
- [x] 빌드 검증
- [x] **Sprint 9** — 알레르기·회피 성분 안전 필터
- [x] **Sprint 10** — 현재 제품 등록·루틴 점검
- [x] **Sprint 12** — canonical 브랜드명 표준화 (오번역 복구)
- [x] **Sprint 13** — 한국 카탈로그 템플릿·검증 도구

---

## 2. 진행 중 — Sprint 14

- [x] COSRX 실제품 3개·offer 3개 로컬 등록 (검증 대기)
- [x] `/admin/catalog-review` 개발용 검토 UI
- [x] `product_offers` migration 로컬 정리 (bigint FK, 최소 권한 RLS)
- [x] GitHub 백업 브랜치 `backup-sprint14-20260713` 생성·push
- [ ] 최상위 문서 복구·최신화 (`MASTER_PLAN` / `PROJECT_RULE` / status·roadmap·changelog)
- [ ] `product_offers` 원격 적용
- [ ] COSRX 데이터 원격 반영
- [ ] `data/backups` JSON 백업

### 현재 단계 (2026-07-13)

- GitHub 백업: **완료** (`c73c135` on `backup-sprint14-20260713`)
- Supabase migration: **미적용** (`product_offers` 원격 없음)
- main 병합: **아직 안 함**

---

## 3. 다음 순서

1. 문서 복구 (본 작업)
2. main 병합 검토
3. `product_offers` migration 적용
4. 원격 검증 (테이블·RLS·정책·인덱스)
5. COSRX 3개 데이터 반영
6. JSON 백업 생성 (`data/backups/YYYY-MM-DD/`)
7. GitHub 최종 push

---

## 4. 이후 단계

- 실제 Anthropic / OpenAI / Ollama 연결
- 국가·언어·통화 고도화
- 사용자 계정과 분석 결과 DB 저장
- 3일·7일·15일·30일 안부 확인
- 관리자 권한·업로드 UI
- 사진 분석 (비전)
- 테스트·보안·배포
