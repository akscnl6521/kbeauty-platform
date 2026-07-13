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
- [x] `product_offers` 원격 migration 적용 (`20260713022607`)

---

## 2. 진행 중 — Sprint 14

방향: 단순 COSRX 수동 입력에서 **Search-to-Verified-Product Pipeline** 설계로 확장.

- [x] COSRX 실제품 3개·offer 3개 로컬 등록 (검증 대기 사례)
- [x] `/admin/catalog-review` 개발용 검토 UI
- [x] `product_offers` migration (bigint FK, 최소 권한 RLS) 원격 적용
- [x] GitHub 백업 브랜치 `backup-sprint14-20260713`
- [x] 검색 우선·검증 후 등록 원칙을 Master Plan / Project Rule에 공식화
- [x] Search-to-Verified 11테이블 + admin_users/history migration·bootstrap
- [x] 관리자 인증 가드 최소 구현 (clients / proxy / layout / auth-check)
- [x] 관리자 로그인 페이지 최소 구현 (`/admin/login`, logout)
- [x] 관리자 비밀번호 재설정 최소 구현 (`/admin/forgot-password`, `/admin/reset-password`)
- [x] 비밀번호 재설정 PKCE callback (`/auth/callback` → cookie 세션)
- [x] 비밀번호 재설정 `token_hash` + `verifyOtp(recovery)` 보완
- [x] 관리자 대시보드 1차 (읽기 전용 `/admin` + `/api/admin/dashboard`)
- [x] 관리자 제품 목록 1차 (읽기 전용 `/admin/products` + API)
- [ ] 읽기 전용 제품 상세
- [ ] 읽기 전용 discovery/ingredients 목록
- [ ] Search-to-Verified 관리자 쓰기 UI/API
- [ ] COSRX 3개를 첫 실제 검증 사례로 파이프라인에 적용
- [ ] Supabase 제품/offer 반영 (승인 후)
- [ ] `data/backups` JSON 백업

### 현재 단계 (2026-07-13)

- 제품 데이터 전략: **검색 우선·검증 후 등록**
- 관리자 대시보드·제품 목록(읽기 전용): **로컬 구현**
- products 186 · offers 0 · verified_at 전부 0
- main 병합 / 이번 작업 commit·push: **아직 안 함**

---

## 3. 다음 순서 (Search-to-Verified-Product Pipeline)

1. 파이프라인 데이터 모델 설계  
2. 검색 후보 저장 구조  
3. 판매 검증 상태  
4. 전성분 구조  
5. 논문 근거 DB  
6. 관리자 검증 화면  
7. COSRX 3개를 첫 실제 검증 사례로 적용  
8. Supabase 반영  
9. JSON 백업  
10. GitHub push  

세부 개발 항목:

- 실제 제품 검색 계층  
- 판매 상태 검증  
- 전성분 수집  
- 성분 표준화  
- 논문 근거 연결  
- 중복 검사  
- 관리자 승인  
- Supabase 등록  
- 정기 재검증  

---

## 4. 이후 단계

- 실제 Anthropic / OpenAI / Ollama 연결
- 국가·언어·통화 고도화
- 사용자 계정과 분석 결과 DB 저장
- 3일·7일·15일·30일 안부 확인
- 관리자 권한·업로드 UI
- 사진 분석 (비전)
- 테스트·보안·배포
