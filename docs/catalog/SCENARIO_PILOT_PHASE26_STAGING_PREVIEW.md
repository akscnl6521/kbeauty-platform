# Phase 2.6 — Staging Preview 실검증 보고

날짜: 2026-07-22  
기준 커밋(기능): `59b721c`  
검증 브랜치: `feature/recommendation-usage-guide-display-20260720`  
Staging ref: `jfnj***gfd`  
Production: **미사용** · DB write: **0** · migration 적용: **0**

## 안전 확인

| 항목 | 결과 |
|------|------|
| 브랜치 | feature (main/master 아님) |
| Staging ref | `jfnj***gfd` |
| Production ref | 차단 |
| DB | SELECT-only |
| Care/email/photo write | 없음 |

## 환경

- `RECOMMEND_COMMERCE_SEPARATION` 기본 ON (미설정 시 `1`)
- 공용 Preview env 덮어쓰기 **안 함**
- 롤백 검증: `PHASE26_MODE=off` → C Top 0 / insufficient (레거시 복원 확인)

## Staging SELECT 결과 (anon fetch 경로)

### A — 민감·홍조·크림 — **ok Top 5**

| Rank | slug | commerce | CTA |
|------|------|----------|-----|
| 1 | cosrx-advanced-snail-96-mucin-power-essence | in_stock | ON |
| 2 | cosrx-advanced-snail-92-all-in-one-cream | in_stock | ON |
| 3 | torriden-dive-in-serum | availability_unknown | OFF |
| 4 | round-lab-dokdo-cream | availability_unknown | OFF |
| 5 | aestura-atobarrier365-cream | in_stock | ON |

### B — 건성·장벽·세럼 — **ok Top 5**

| Rank | slug | commerce | CTA |
|------|------|----------|-----|
| 1 | torriden-dive-in-serum | availability_unknown | OFF |
| 2 | cosrx-advanced-snail-96-mucin-power-essence | in_stock | ON |
| 3 | cosrx-advanced-snail-92-all-in-one-cream | in_stock | ON |
| 4 | round-lab-dokdo-cream | availability_unknown | OFF |
| 5 | aestura-atobarrier365-cream | in_stock | ON |

### C — 여드름·피지·토너 — **ok Top 4** (목표 Top≥3 충족)

| Rank | slug | commerce (app) | CTA |
|------|------|----------------|-----|
| 1 | cosrx-aha-bha-clarifying-treatment-toner | in_stock | ON |
| 2 | beauty-of-joseon-green-plum-refreshing-toner | availability_unknown* | OFF |
| 3 | anua-heartleaf-77-soothing-toner | in_stock | OFF? → ON (KR offer) |
| 4 | haruharu-wonder-black-rice-hyaluronic-toner | availability_unknown | OFF |

\*DB(service_role)에는 BOJ 공식 KR offer `out_of_stock` / unverified 존재.  
anon RLS가 `verified+in_stock`만 허용해 **앱 경로에서는 offer가 숨겨짐** → UI는 `availability_unknown`(“판매 상태 확인 중”).

### D/E

- D/E: `insufficient_verified_candidates` **유지**

## 롤백 (`RECOMMEND_COMMERCE_SEPARATION=0`)

- A/B: in_stock만 Top 3 **유지**
- C: `verified_count=2`, Top 0, insufficient **복원** (레거시 게이트)
- D/E: insufficient 유지

## 회귀

| 항목 | 결과 |
|------|------|
| A/B Top≥3 | PASS |
| in_stock CTA ON | PASS |
| OOS/unknown CTA OFF | PASS (app-visible) |
| Organic 점수에 재고 가산 없음 | PASS (점수=성분 매칭) |
| affiliate/ad 점수 | PASS (`AFFILIATE_SCORE_FORBIDDEN`) |
| KR/US 혼합 구매 CTA | PASS (Anua US offer 존재하나 KR CTA는 KR offer) |
| Care cache version | `KR_SCENARIO_PILOT_PHASE25_COMMERCE_SEP_V1` (stale cache 무효화) |

## 발견 이슈 (다음 단계 후보)

**anon RLS가 official OOS offer를 숨김**  
→ BOJ가 추천에는 남지만 `commerce_status=out_of_stock` 대신 `availability_unknown` 표시.

대응(미적용):  
`supabase/migrations/DRAFT_DO_NOT_APPLY_20260722_product_offers_oos_read_policy.sql`

## 테스트

- `npm run test:recommendation-commerce-separation` — ok
- `npm run test:recommendation-scenario-phase2` — ok
- `npm run test:quality` — ok
- `npm run build` — ok (selftest 타입/exclude 수정 후)

## 아티팩트

- `data/.../phase26-staging-select.json`
- `data/.../phase26-staging-select-rollback.json`
- `data/.../phase26-offer-select.json`
