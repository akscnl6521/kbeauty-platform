# Production 189건 — 브랜드별 수집 우선순위 + 전성분 확보 실행계획 (2026-07-28)

단계 0 실측을 마치고 세운 실행계획이다. **아직 크롤·쓰기를 하지 않았다.**
전제가 되는 배경은 [PRODUCTION_189_OFFER_PLAN.md](PRODUCTION_189_OFFER_PLAN.md) 참고.

---

## 1. 단계 0 실측 요약 — 작업 성격이 바뀌었다

| 항목 | 실측 |
|---|---:|
| `products` 전체 | 191 |
| `verified_at IS NULL` | **189** |
| `product_offers` 전체 | **2** |
| `key_ingredients` 있음 | 189 ✅ |
| **`full_ingredients` 있음** | **5** ❌ |
| 레거시 구매 링크 하나라도 | 62 |
| ↳ 그중 **국내(올리브영·쿠팡)** | **0** |
| ↳ 아마존US 40 · 세포라 23 | 해외뿐 |
| 브랜드 수 | **55** |
| 생성 시점 | 2026-03-16 ~ 07-16 |

세 가지가 확정됐다:

1. **오퍼만의 문제가 아니다.** 184건에 전성분이 없어, 오퍼를 다 구해도 활성화
   게이트(`hasOfficialIngredientsText`)를 못 넘는다.
2. **레거시 링크는 KR 오퍼에 못 쓴다.** 62건이 전부 아마존US·세포라다. 핵심 추천은
   KR verified offer 를 요구한다(`CORE_RECOMMEND_OFFER_COUNTRY = "KR"`).
3. **브랜드가 비용을 지배한다.** 55개 브랜드에 평균 3.4건씩 흩어져 있다. Staging 은
   abib 한 곳에 118건이 몰려 있어 자사몰 하나로 해결됐지만, 여기는 정반대다.

**따라서 단위 작업은 «제품 1건» 이 아니라 «브랜드 1개» 다.** 브랜드 하나를 뚫으면
평균 3.4건을 얻고, 못 뚫으면 그 브랜드 전체가 0이다.

---

## 2. 방침 반영 (2026-07-28 확정)

### 2-1. K-뷰티 스코프 밖 브랜드 제외

`availability_status = 'blocked_by_policy'` 로 표시만 하고 수집하지 않는다.
`active=false` 유지. 마이그레이션에 값을 추가했다
([DRAFT](../../supabase/migrations/DRAFT_DO_NOT_APPLY_20260728_products_availability_status.sql)).

`unavailable`·`discontinued` 와 **반드시 구분한다** — 섞으면 나중에 «판매처가 없어서»
인지 «안 하기로 해서» 인지 알 수 없게 된다.

**제외 확정 (15건 / 8개 브랜드)** — 본사·소유주가 한국 밖인 것이 명확한 브랜드:

| 브랜드 | 건수 | 근거 |
|---|---:|---|
| The Ordinary | 6 | DECIEM · 캐나다 |
| Clinique | 2 | Estée Lauder · 미국 |
| Kiehl's (`Kiehls`) | 2 | L'Oréal · 미국 |
| Bioderma | 1 | NAOS · 프랑스 |
| Elizabeth Arden | 1 | 미국 |
| Caudalie | 1 | 프랑스 |
| SK-II | 1 | P&G · 일본 |
| Youth To The People | 1 | 미국 |

**판단 보류 (7건 / 3개 브랜드)** — 한국 제조·K뷰티 포지셔닝이지만 법인이 한국 밖이다.
어느 쪽으로 볼지는 스코프 정의에 달린 문제라 **임의로 정하지 않고 남긴다**:

| 브랜드 | 건수 | 성격 |
|---|---:|---|
| Glow Recipe | 4 | 미국 법인 · 한국 제조 · K뷰티 표방 |
| Erborian | 2 | 프랑스 법인(L'Oréal) · 한국 제조 · "Korean skincare" 표방 |
| Peach Slices | 1 | 미국 법인(Peach & Lily) · 한국 제조 |

→ **스코프를 «한국 법인» 으로 볼지 «한국 제조» 로 볼지** 결정 필요. 그 전까지는
`availability_status` 를 건드리지 않고 대기.

**수집 대상: 189 − 15 = 174건 (보류 7건 제외 시 167건)**

### 2-2. category·brand 표기 통일

Staging 소문자 규칙으로 맞추되, **매칭 안 되는 값은 덮어쓰지 않고 needs_review 로 남긴다.**

**바로 매핑 (Staging·시나리오 어휘에 이미 있음)**

| Production 표기 | → | 건수 |
|---|---|---:|
| `Serum` · `serum` | `serum` | 53 |
| `Cream` | `cream` | 41 |
| `Toner` · `toner` | `toner` | 27 |
| `Ampoule` | `ampoule` | 11 |
| `Essence` | `essence` | 11 |
| `SPF` · `Sunscreen` | `sunscreen` | 13 |
| `Cleanser` | `cleanser` | 6 |
| `Mask` | `mask` | 4 |
| `Eye Cream` | `eye_cream` | 5 |

`eye_cream` 은 §29 시나리오(`kr-aging-eye-cream`)가 이미 쓰는 값이라 신규 생성이 아니다.

**needs_review (어휘에 없음 — 덮어쓰지 않음)**

| 표기 | 건수 | 왜 |
|---|---:|---|
| `Cushion` | 4 | 베이스 메이크업인데 `makeup/base` 로 볼지 별도 값으로 둘지 불명 |
| `Exfoliator` | 2 | 대응 값 없음 |
| `Powder` | 2 | `makeup/base` · `makeup/color` 어느 쪽인지 불명 |

**brand 표기 흔들림 — 같은 브랜드가 갈려 있다**

| Production | 건수 | 비고 |
|---|---:|---|
| `COSRX` / `CosRX` | 12 / 1 | 같은 브랜드가 2개로 집계됨 |
| `Banila Co` | 1 | Staging 은 `banila co.` |
| `Numbuzin` | 2 | Staging 은 `넘버즈인` |
| `Abib` | 4 | Staging 은 `Abib Cosmetic` |

브랜드 통일은 §35.3 상 **공식 표기를 먼저 확인한 뒤** 진행한다(07-27 Round Lab·SIORIS
때와 같은 절차). 확인 없이 Staging 표기로 맞추지 않는다 — Staging 쪽이 틀렸을 수도 있다.

---

## 3. 브랜드별 수집 우선순위

단위가 브랜드이므로, **«자사몰이 Cafe24 인가» 와 «건수» 로 정렬**한다. Cafe24 는
이번 세션에서 커넥터가 검증된 유일한 플랫폼이다(`xans-` · `/exec/front/` · `ec-base-`).

### Tier 1 — Staging 에서 이미 성공한 브랜드 (즉시 착수)

같은 커넥터가 그대로 동작한다. 위험이 가장 낮다.

| 브랜드 | Production 건수 | Staging 실적 |
|---|---:|---|
| COSRX (+CosRX) | 13 | 18건 수집 · 9건 활성 |
| Round Lab | 5 | 7건 · 7건 활성 |
| Anua | 5 | 1건 · 1건 활성 |
| Beauty of Joseon | 5 | 2건 · 2건 활성 |
| Laneige | 5 | 2건 · 1건 활성 |
| Abib | 4 | 118건 · 43건 활성 |
| Torriden | 4 | 1건 · 1건 활성 |
| Isntree | 4 | 1건 · 1건 활성 |
| Sulwhasoo | 3 | 7건 · 7건 활성 |
| Numbuzin | 2 | 10건 · 8건 활성 |
| Banila Co | 1 | 1건 · 1건 활성 |
| SKIN1004 | 6 | 1건 수집(오퍼 0) |
| **소계** | **57건** | |

### Tier 2 — 건수 상위 미검증 브랜드 (커넥터 확인 필요)

Tier 1 이 끝나면 건수 순으로 자사몰 접근성을 확인한다. **브랜드당 먼저 dry-run 1회**
로 수집 가능 여부만 보고, 되는 곳만 본수집한다.

Some By Mi 8 · Dr. Jart+ 7 · Innisfree 7 · Purito 6 · Axis-Y 6 · Klairs 5 ·
Haruharu Wonder 5 · Missha 5 · Etude House 5 · Goodal 4 · TIRTIR 4 · Medicube 4 ·
Ma:nyo 4 · Benton 4 → **소계 74건**

### Tier 3 — 소량 브랜드 (3건 이하)

Heimish 3 · Neogen 3 · Rovectin 3 · Tocobo 3 · Nacific 3 · IOPE 3 · mixsoon 3 ·
I Am From 2 · Holika Holika 2 · Belif 2 · Medi-Peel 2 · Pyunkang Yul 2 ·
Skinfood 1 · Atopalm 1 · Hyggee 1 · Lagom 1 · Tonymoly 1 → **소계 36건**

건당 비용이 가장 높다. Tier 1·2 결과를 보고 **계속할지 여기서 멈출지 판단**한다.

### 합계

| Tier | 브랜드 | 건수 |
|---|---:|---:|
| 1 (검증된 커넥터) | 12 | 57 |
| 2 (건수 상위) | 14 | 74 |
| 3 (소량) | 17 | 36 |
| 정책 제외 | 8 | 15 |
| 판단 보류 | 3 | 7 |
| **합계** | **54** | **189** |

---

## 4. 전성분 확보 방안

184건에 전성분이 없다. **오퍼와 전성분은 같은 제품 페이지에서 함께 나오므로 한 번의
크롤로 얻는다** — 이번 세션 Staging 에서 `collect-offers-from-brand-pages.ts` 가 실제로
그렇게 동작했다. 별도 작업이 아니다.

수집 후 처리 순서는 이미 있는 경로를 그대로 쓴다:

1. `extractLabeledIngredientsRaw` — «전성분» 라벨이 명시된 구간만 추출. 마케팅 문구 거부.
2. `ingredient-normalize.ts` — §35.7 규칙으로 토큰 분리(쉼표 보호·꼬리 절단·라틴/한글 경계)
3. `product_ingredients` 링크 생성 + `ingredients` 사전 매칭
4. `deriveKeyIngredientsFromFullList` — 전성분에서 `key_ingredients` 파생
   (07-27 신설. 기존 `key_ingredients` 가 있으면 **덮지 않는다**)
5. 게이트: 미매칭 성분이 남으면 활성화하지 않고 `needs_review`

**예상 난점**: 전성분이 이미지로만 제공되는 브랜드는 여기서 막힌다. Staging SIORIS
24건이 정확히 그 경우였다 — 오퍼는 다 확보했는데 활성이 0이다. OCR 은 하지 않는다
(§5-3 — 확인 안 되면 빈 상태로 둔다).

---

## 5. 실행 순서

| 단계 | 내용 | 대상 | 승인 |
|---|---|---|---|
| A | 마이그레이션 Staging 적용 | Staging DDL | 받음(실행 경로 없음, §7 참고) |
| B | 정책 제외 15건 표시 | Production write | **필요** |
| C | Tier 1 브랜드 dry-run | 크롤만, 쓰기 없음 | 불필요 |
| D | Tier 1 본수집 → Staging 적재 | Staging write | 불필요 |
| E | 게이트 통과분 목록 보고 | — | — |
| F | Production 반영 | Production write | **필요** |
| G | Tier 2 반복 | | |

**지금은 계획만이다. C 부터 시작하려면 지시가 필요하다.**

---

## 6. 하지 않을 것

- 가격·재고·판매처를 만들어 내지 않는다. `price_usd`(184건 보유)를 오퍼 가격으로
  승격하지 않는다 — 검증된 판매처 가격이 아니다.
- 전성분을 OCR·추정으로 채우지 않는다.
- 브랜드 표기를 공식 표기 확인 없이 바꾸지 않는다(§35.3).
- 매칭 안 되는 category 값을 임의로 가까운 값에 욱여넣지 않는다.
- 게이트 기준을 낮추지 않는다.

---

## 7. 막혀 있는 것

**Staging DDL 실행 경로가 없다.** `psql` 미설치 · `pg` 패키지 없음 · DB 접속 문자열
없음 · `SUPABASE_ACCESS_TOKEN` 은 legacy 형식이라 CLI 가 거부한다. PostgREST 는
데이터만 다루고 DDL 을 못 한다. CLAUDE.md 도 «마이그레이션은 사람이 Dashboard SQL
Editor 에서 적용» 이라고 적고 있다.

→ 마이그레이션 SQL 을 사람이 Staging SQL Editor 에 붙여넣어야 한다.
