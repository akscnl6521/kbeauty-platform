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
| Working tree | 관리자 제품 상세 1차 읽기 전용 (commit/push 전) |
| 빌드 | `npm run build` (product detail 구현 후 재검증) |

## 제품 데이터 전략

- **검색 우선·검증 후 등록** (Search-to-Verified-Product Pipeline)
- 브랜드별 대량 DB 선구축 금지
- 판매 확인·전성분·논문·안전·관리자 검증 후 `published`만 핵심 추천
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
| `/admin/login` | 관리자 이메일/비밀번호 로그인 |
| `/admin/forgot-password` | 관리자 비밀번호 재설정 메일 요청 |
| `/admin/reset-password` | 메일 링크 후 새 비밀번호 설정 |
| `/auth/callback` | 복구: `verifyOtp(recovery)` + PKCE `code` fallback |
| `/admin/catalog-review` | 카탈로그 검증 대기 (development + admin 필수) |
| `/admin/forbidden` | 비관리자 안내 |
| `/admin/unavailable` | 서버 설정 누락 안내 |
| `/privacy`, `/terms` | 약관 |
| `/api/analyze` | 서버 AI 분석 API |
| `/api/admin/auth-check` | 관리자 세션 테스트 (GET) |
| `/api/admin/dashboard` | 관리자 대시보드 count (GET, 읽기 전용) |
| `/api/admin/products` | 관리자 제품 목록 (GET, 읽기 전용) |
| `/api/admin/products/[id]` | 관리자 제품 상세 (GET, 읽기 전용) |

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
7. 관리자 검증 UI/API 본체 미구현

## 다음 작업

1. **`/admin/products/[id]` 로그인 후 상세·API E2E**
2. 읽기 전용 ingredients / discovery 목록
3. Search-to-Verified 관리자 쓰기 UI/API (별도 승인)
4. COSRX 3개 파이프라인 적용
5. JSON 백업 · GitHub push (승인 시)

## 참고 문서

- `MASTER_PLAN.md` — Master Plan v3.1
- `PROJECT_RULE.md` — 운영 규칙
- `ROADMAP.md` — 완료 / 진행 / 다음
- `CHANGELOG.md` — Sprint 이력
- `docs/43`~`docs/54` — 관리자 인증·대시보드·제품 목록/상세
- `docs/11-product-retailer-offer.md` — Product/Offer 분리
- `docs/20-data-source-verification.md` — 검색·검증 파이프라인
- `docs/29-korean-product-data-guide.md` — 한국 데이터 입력
- `docs/30-github-supabase-backup.md` — 백업 연동
