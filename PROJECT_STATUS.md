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
| main 최근 커밋 | `514f0f9` — Sprint 13: Add Korean catalog data templates and validation |
| Working tree | 문서 복구 작업 중 (본 갱신 포함, commit/push 전) |
| 빌드 | `npm run build` 성공 |

## Supabase

| 항목 | 값 |
|------|-----|
| Project ref | `rhfrmvkjsummaylpzmns` |
| MCP | 연결 완료, 쓰기 도구(`apply_migration`, `execute_sql`) 사용 가능 |
| 원격 테이블 | `products` 186 / `ingredients` 40 / `profiles` 1 / `invite_codes` 3 |
| `product_offers` | **아직 없음** (로컬 migration 준비됨, 원격 미적용) |
| `products.id` | `bigint` (IDENTITY ALWAYS) |

## 로컬 제품 데이터

| 항목 | 값 |
|------|-----|
| COSRX 제품 | 3개 (`data/catalog/kr/cosrx-products.json`) |
| COSRX offer | 3개 (`data/catalog/kr/cosrx-offers.json`) |
| offer 상태 | `verificationStatus=unverified`, `stockStatus=unknown`, `verifiedAt=null` |
| 가격 | 23,000 / 23,000 / 24,000 KRW (공식 확인가) |
| 핵심 추천 포함 | **불가** (검증 대기) |
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
| `/admin/catalog-review` | 카탈로그 검증 대기 (development only) |
| `/privacy`, `/terms` | 약관 |
| `/api/analyze` | 서버 AI 분석 API |

## 현재 주요 기능

- 피부 분석 (Mock AI 포함)
- 추천 결과 (핵심 Top 5 + 둘러보기)
- 알레르기·회피 성분 안전 필터
- 현재 제품 등록
- 루틴 점검
- 브랜드명 표준화 (`canonicalBrandName`, 번역 차단)
- 한국 offer 구조·적격 필터
- 관리자 catalog review
- 한국 카탈로그 입력 템플릿·검증 유틸

## 환경 / AI

| 항목 | 값 |
|------|-----|
| `.env.local` | 프로젝트 루트 (GitHub 커밋 금지) |
| AI 실행 | 서버 `POST /api/analyze` — 현재 **mock fallback** 가능 |
| 비고 | 브라우저 직접 AI 키 사용 없음 |

## 현재 문제

1. `product_offers` 원격 미적용
2. `data/backups` 폴더 미생성
3. (이전) 문서 불일치 → 본 Sprint에서 문서 복구 중
4. COSRX 로컬 데이터는 등록됐으나 Supabase 미반영
5. 실제 Anthropic / OpenAI / Ollama 연결 미완

## 다음 작업

1. **문서 복구 완료** (본 작업)
2. main 병합 검토
3. `product_offers` migration 안전 적용 준비
4. 원격 검증
5. COSRX 3개 데이터 반영
6. JSON 백업 생성 (`data/backups/YYYY-MM-DD/`)
7. GitHub 최종 push

## 참고 문서

- `MASTER_PLAN.md` — Master Plan v3.1
- `PROJECT_RULE.md` — 운영 규칙
- `ROADMAP.md` — 완료 / 진행 / 다음
- `CHANGELOG.md` — Sprint 이력
- `docs/29-korean-product-data-guide.md` — 한국 데이터 입력
- `docs/30-github-supabase-backup.md` — 백업 연동
