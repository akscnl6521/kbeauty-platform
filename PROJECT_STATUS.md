# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-13

## 현재 컴퓨터 / 경로

| 항목 | 값 |
|------|-----|
| 현재 컴퓨터 | 보조컴퓨터 |
| 프로젝트 경로 | `C:\Users\조병선\Desktop\k뷰티사업\kbeauty-platform` |
| GitHub 저장소 | https://github.com/akscnl6521/kbeauty-platform.git |
| 현재 브랜치 | `backup-sprint14-20260713` |
| 최근 백업 커밋 | `c73c135d92149f1c67b2b4c8209b750850792a03` — Backup Sprint 14 local work before Supabase migration |
| 문서 복구 커밋 | `fd1840e` — Docs: Restore project governance and Sprint 14 status |
| main 최근 커밋 | `514f0f9` — Sprint 13: Add Korean catalog data templates and validation |
| Working tree | Cursor↔worker 운영 분리 · config-driven fixed scheduler |
| 빌드 | `npm run test:pipeline` · `npm run build` (개발 세션에서만) |
| Pipeline ops | `config/pipeline-operation.json` · `/admin/pipeline/settings` |
| Scheduler | `KBeautyMatch-Pipeline` → 고정 `run-pipeline-worker.mjs` (에이전트 미실행) |
| dry_run / gated | worker가 config `mode`로 자체 판단 |

## 제품 데이터 전략

- Search-to-Verified + **Autonomous Catalog Pipeline** (`docs/69`~`79`)
- 사람이 모든 URL을 등록하지 않음 · needs_review만 검토
- 자동 `published` 금지 · `product_offers` 0이면 publish 불가
- 1차 job 상태는 `data/pipeline/runtime` (운영 DB 지속성 = BLOCKER migration)
- 공식 API는 선택적 보조 수단 (필수 아님)
- 이중 저장(GitHub + Supabase) 원칙 유지

## Supabase

| 항목 | 값 |
|------|-----|
| Project ref | `rhfrmvkjsummaylpzmns` |
| MCP | 연결 가능 (쓰기 전 사용자 승인) |
| 원격 테이블 | `products` 186 / `ingredients` 40 / `profiles` 1 / `invite_codes` 3 / `product_offers` **0행** |
| Search-to-Verified | 11테이블 적용 완료 (`20260713034442`) |
| 관리자 인증 테이블 | `admin_users` / `admin_role_history` (`20260713041018`), 첫 admin bootstrap 완료 |
| `product_offers` | **적용 완료** (migration `20260713022607` / `create_product_offers_and_catalog_extensions`) |
| RLS | verified + in_stock + active 만 클라이언트 SELECT |
| `products.id` | `bigint` (IDENTITY ALWAYS) |

## 로컬 제품 데이터

| 항목 | 값 |
|------|-----|
| COSRX 제품 | 3개 (`data/catalog/kr/cosrx-products.json`) — 첫 검증 사례 후보 |
| COSRX offer | 3개 (`data/catalog/kr/cosrx-offers.json`) |
| offer 상태 | `unverified` / `unknown` / `verifiedAt=null` / `active=true` |
| 가격 | 23,000 / 23,000 / 24,000 KRW |
| 핵심 추천 포함 | **불가** (검증·published 전) |
| 원격 중복 매핑 | Snail 96→기존 id=4, Snail 92→기존 id=28, Pad→신규 필요 (쓰기 전 계획만) |
| `data/backups` | **미생성** |

## 실행 가능한 페이지

| 경로 | 역할 |
|------|------|
| `/` | 메인 |
| `/analyze` | AI 피부 분석 (사진·수동·Mock) |
| `/results` | 분석 가이드 + Top 5 + 제품 탐색 |
| `/quiz` | 설문 |
| `/routine` | 루틴 |
| `/face-explorer` | 얼굴 영역 탐색 |
| `/ingredients/[slug]` | 성분 상세 |
| `/admin` | 관리자 대시보드 (읽기 전용 count) |
| `/admin/products` | 제품 목록 (읽기 전용 · 검색/필터/페이지) |
| `/admin/products/[id]` | 제품 상세 (읽기 전용) |
| `/admin/discovery` | 발견 후보 목록 (읽기 전용) |
| `/admin/discovery/import` | URL/CSV 빠른 후보 등록 |
| `/admin/discovery/new` | 제품 후보 수동 등록 (쓰기) |
| `/admin/discovery/[id]` | 발견 후보 상세 + 제한 쓰기 |
| `/admin/ingredients` | 성분 목록 (읽기 전용) |
| `/admin/ingredients/[id]` | 성분 상세 (읽기 전용) |
| `/admin/verification` | 검증 큐 목록 (읽기 전용) |
| `/admin/verification/[id]` | 검증 큐 상세 (읽기 전용) |
| `/admin/login` | 관리자 이메일/비밀번호 로그인 |
| `/admin/forgot-password` | 관리자 비밀번호 재설정 메일 요청 |
| `/admin/reset-password` | 메일 링크 후 새 비밀번호 설정 |
| `/auth/callback` | 복구: `verifyOtp(recovery)` + PKCE `code` fallback |
| `/admin/pipeline` | 자율 카탈로그 파이프라인 콘솔 (dry_run/commit) |
| `/admin/pipeline/batches/[id]` | 배치·job 진행 |
| `/admin/brands` | 브랜드 seed 목록 (products/brands 자동) |
| `/admin/brands/[id]` | 브랜드 seed 상세 |
| `/admin/forbidden` | 비관리자 안내 |
| `/admin/unavailable` | 서버 설정 누락 안내 |
| `/privacy`, `/terms` | 약관 |
| `/api/analyze` | 서버 AI 분석 API |
| `/api/admin/auth-check` | 관리자 세션 테스트 (GET) |
| `/api/admin/dashboard` | 관리자 대시보드 count (GET, 읽기 전용) |
| `/api/admin/products` | 관리자 제품 목록 (GET, 읽기 전용) |
| `/api/admin/products/[id]` | 관리자 제품 상세 (GET, 읽기 전용) |
| `/api/admin/discovery` | 관리자 discovery 목록 (GET, 읽기 전용) |
| `/api/admin/discovery/[id]` | 관리자 discovery 상세 (GET, 읽기 전용) |
| `/api/admin/ingredients` | 관리자 성분 목록 (GET, 읽기 전용) |
| `/api/admin/ingredients/[id]` | 관리자 성분 상세 (GET, 읽기 전용) |
| `/api/admin/verification` | 관리자 검증 큐 목록 (GET, 읽기 전용) |
| `/api/admin/verification/[id]` | 관리자 검증 큐 상세 (GET, 읽기 전용) |

## 현재 주요 기능

- 피부 분석 (Mock AI 포함)
- 추천 결과 (핵심 Top 5 + 둘러보기)
- 알레르기·회피 성분 안전 필터
- 현재 제품 등록
- 루틴 점검
- 브랜드명 표준화
- 한국 offer 구조·적격 필터
- 관리자 catalog review
- 한국 카탈로그 템플릿·검증 유틸

## 현재 문제

1. Supabase Reset Password 이메일 템플릿을 token_hash URL로 **수동 변경 필요**
2. Redirect URLs에 `http://localhost:3000/auth/callback` 유지 필요
3. 로컬 `SUPABASE_SERVICE_ROLE_KEY` **missing** 가능 → 관리자 영역 E2E 차단
4. COSRX 로컬 데이터는 등록됐으나 Supabase 미반영
5. `data/backups` 폴더 미생성
6. 실제 AI 공급자 연결 미완
7. 관리자 쓰기 콘솔 1차 완료 (discovery/verification). offers 자동생성·대량수정·DELETE 미지원

## 다음 작업

1. 운영 UI에서 실제 후보 1건 E2E (사용자)
2. COSRX 파이프라인 적용 (승인 후)
3. offer 생성·게시 전제조건 강화 (승인 후)
4. main 병합은 별도 승인 후

## 참고 문서

- `docs/43`~`docs/65` — 관리자 인증·읽기·쓰기 콘솔
- `docs/61`~`docs/65` — Search-to-Verified 쓰기
- `docs/29-korean-product-data-guide.md` — 한국 데이터 입력
- `docs/30-github-supabase-backup.md` — 백업 연동
