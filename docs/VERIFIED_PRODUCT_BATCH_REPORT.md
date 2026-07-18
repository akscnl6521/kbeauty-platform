# VERIFIED_PRODUCT_BATCH_REPORT.md — 한국 공식 검증 제품 배치

최종 갱신: 2026-07-18  
브랜치: `automation-mvp-completion`  
배치 경로: `imports/verified-kbeauty-batch/`  
빌드: `npm run catalog:verified-batch`  
검증: `npm run test:verified-batch`

## 원칙 준수

| 원칙 | 상태 |
|------|------|
| 가짜 제품·가격·재고·후기 | **없음** |
| 추천 기준 하향 | **없음** |
| 자동 Verified | **금지** (`verified=false`, offer `unverified`) |
| Production DB 쓰기 | **없음** |
| Staging DB 쓰기 | **SKIPPED** (로컬 env = Production ref, SERVICE_ROLE 없음) |

## Staging import attempt (2026-07-18)

| 항목 | 결과 |
|------|------|
| Gate | **BLOCK_PRODUCTION** |
| DB write | **SKIPPED** |
| preview/commit | **NOT RUN** |
| Required env names | `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` |
| Expected Staging ref | `jfnjufmldiqlgvgyugfd` |
| Check command | `npm run check:verified-batch-staging` |

Staging env가 준비되면 `/admin/products/import`로 `needs_review`만 등록한다. 자동 Verified 금지.

## Staging 게이트

| 항목 | 값 |
|------|-----|
| 로컬 Supabase ref | Production (`rhfrm…`) |
| SERVICE_ROLE | 없음 |
| write_status | **SKIPPED** |
| skip_reason | `local_env_points_to_production_ref` |

→ import bundle만 완성. 관리자 `/admin/products/import`에서 Staging 연결 후 `needs_review`로만 등록.

## 조사 요약

| 구분 | 수 |
|------|----|
| 총 후보 | **12** |
| READY_FOR_REVIEW | **7** |
| REVIEW_REQUIRED | **1** |
| BLOCKED | **4** |
| DUPLICATE (명시 버킷) | **0** (seed overlap 메모만) |
| 공식 이미지 다운로드 | **7** |
| 공식 INCI 텍스트 | **8** (Torriden 포함, 구매불가로 offer BLOCKED) |
| KR offer 행 | **7** |

## READY_FOR_REVIEW (7)

모두 **COSRX 한국 공식몰 (cosrx.co.kr)** — 전성분·가격·판매 상태·공식 이미지 확인.

| # | 제품 | 카테고리 | 용량 | 판매가(KRW) | 재고 증거 |
|---|------|----------|------|-------------|-----------|
| 1 | Low pH Good Morning Gel Cleanser | cleanser | 150ml | 7,920 | 품절 문구 없음 |
| 2 | Full Fit Propolis Synergy Toner | toner | 280ml | 18,500 | 품절 문구 없음 |
| 3 | The Niacinamide 15 Serum | serum | 20ml | 20,800 | 품절 문구 없음 |
| 4 | Full Fit Propolis Light Ampoule | essence | 30ml | 20,000 | 품절 문구 없음 |
| 5 | Advanced Snail 92 All In One Cream | moisturizer | 100g | 23,000 | 품절 문구 없음 |
| 6 | Ultra-Light Invisible Sunserum | sunscreen | 50ml | 13,000 | 품절 문구 없음 |
| 7 | Full Fit Propolis Light Cream | moisturizer | 65g | 16,100 | 품절 문구 없음 |

등록 시: `verified=false`, `active=false`, `review_status=needs_review`. **자동 Verified 금지.**

## REVIEW_REQUIRED (1)

| 제품 | 사유 |
|------|------|
| ROUND LAB 1025 Dokdo Toner 200ml | 판매·가격·이미지 확인. **전성분 원문이 상세 이미지에만 있어 텍스트 미확보** |

## BLOCKED (4)

| 제품 | 사유 |
|------|------|
| ROUND LAB 자작나무 수분 선크림 50ml | **품절** + 전성분 텍스트 미확보 |
| Anua 어성초 77 HA 토너 250ml | **SOLD OUT** + 전성분 텍스트 미확보 |
| Torriden DIVE IN Cream 80ml | **구매 불가** (전성분은 페이지에 있음) |
| Isntree 초저분자 HA 토너 300ml | **품절** + 전성분 텍스트 미확보 |

재고를 `in_stock`으로 추정하지 않음.

## Preview / 출시 판정

| 항목 | 상태 |
|------|------|
| Preview 실제 추천 노출 수 | **0** (검수·Verified 전 · Staging 미등록) |
| 제품 상세 확인 | Staging/Verified 후 가능 |
| 출시 판정 | **NO-GO — 추천 제품 데이터 필요** 유지 |

완전 검증 **bundle 7건**은 확보했으나, Preview에 표시되려면 Staging `needs_review` → 수동 Verified + verified KR offer가 필요. 기준 하향으로 숫자 맞추지 않음.

## 관리자 등록 절차 (Staging 연결 후)

1. Staging ref + SERVICE_ROLE 확인 (Production 차단)
2. `/admin/products/import`에 `products.csv` + images zip
3. `needs_review` 행만 선택 커밋
4. offers.csv 기준으로 공식몰 offer 수동 연결 (`unverified` → 검수 후 verified)
5. 추천 dry-run → 수동 Verified (자동 금지)
6. Preview `/results` 재검수

## 산출물

- `imports/verified-kbeauty-batch/products.csv`
- `imports/verified-kbeauty-batch/offers.csv`
- `imports/verified-kbeauty-batch/media.csv`
- `imports/verified-kbeauty-batch/ingredients.json`
- `imports/verified-kbeauty-batch/sources.json`
- `imports/verified-kbeauty-batch/manifest.json`
- `imports/verified-kbeauty-batch/images/` (7)
