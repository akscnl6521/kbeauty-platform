# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-08-09 (활성 과제 WQ-F 진행도 22/30 시나리오 — 계기판 수리 후 실측)








## 2026-08-09 (4차) 활성 과제의 진행도 계기판이 고장나 있었다

next_task: **비어 있는 시나리오 8개를 채운다.** 몰을 더 뒤지는 게 아니라
**빠진 제품 유형**을 찾는 일이다 (아래 표).

### 무엇이 고장나 있었나

`analyze:scenario-catalog-gap` 은 WQ-F(활성 과제)의 진행도를 재는 도구인데,
세 가지가 겹쳐 **영원히 0 을 가리키고 있었다**:

1. **`data/backups/2026-07-14-catalog` 를 경로째 박아 두고** 읽었다 —
   그날 이후 무엇을 하든 숫자가 안 움직였다.
2. `imageUnknown` 이 **`true` 로 고정**돼 있었다. 이미지가 모르는 상태면 무조건
   `review_required` 라서, `recommendation_ready` 가 **구조적으로 0** 이었다.
   (이미지는 `products` 가 아니라 `catalog_product_media` 에 있어서 백업 JSON
   만으로는 알 수 없었고, 그래서 그렇게 둔 것이다.)
3. Production 행에는 배열 안에 `null` 이 섞여 있어 `normalizeToken` 이 터졌다.

고친 뒤: **22 / 30 시나리오가 추천 준비됨.**

### 아직 비어 있는 시나리오 8개 — 이게 진짜 남은 일이다

| 시나리오 | 매칭 제품 | 무엇이 없나 |
|---|---|---|
| `kr-acne-spot-treatment` | 0 | **스팟 케어 제품이 하나도 없다** |
| `kr-acne-mattifying-emulsion` | 0 | **에멀전이 없다** |
| `kr-uv-mist-spf` | 0 | **선 미스트가 없다** |
| `kr-redness-calming-mist` | 1 | 진정 미스트 부족 |
| `kr-dryness-cream-moderate` | 1 | 보통 건성용 크림 부족 |
| `kr-acne-sebum-cleanser` | 1 | 피지 클렌저 부족 |
| `kr-redness-gentle-cleanser` | 1 | 오퍼 없음 |
| `kr-redness-toner-pad` | 6 | 이미지·오퍼 없음 |

**«제품을 더 늘린다» 가 아니라 «이 유형을 찾는다» 가 남은 일이다.** 몰을 무작정
더 뒤지는 것보다 이 8칸을 겨냥하는 편이 빠르다.

## 2026-08-09 (3차) 셀리맥스·카히 추가 — 추천 풀 106건 · 국내 구매 96건

next_task: 국내몰 후보를 더 확인한다(누적 110곳). 적중률이 24곳당 2~3곳으로
떨어지는 중이다. 병목은 계속 «전성분을 텍스트로 공개하는 곳» 이다.

### 실측

| 항목 | 값 |
|---|---|
| 추천 풀 | **106건** |
| 국내 «구매하기» | **96건** |
| 라이브 이미지 | **106 / 106** (http 0 · 중복 0) |
| 브랜드 | **16개** (달바 26 · COSRX 21 · 셀리맥스 20 · Abib 13 · Klairs 8 …) |

### 등록 필터에 또 걸린 것들 (셀리맥스·카히 실측)

| 무엇 | 예 |
|---|---|
| 대괄호 행사 표시 | `[99딜 비밀링크]` · `[더 비타 키트 전용]` · `[쿨링썸머] … (쿨링마사저 증정)` |
| 별표 묶음 | `선스틱 (14g)*2개` |
| **한 상품에 용량이 여럿** | `(30ml/50ml/100ml)` · `(40매/80매)` · `1매/5매/8매` |
| 호수가 여럿 | `톤업 선 스킨 베이지/퍼플/그린` |

같은 패드가 **18,900원과 43,900원** 두 값으로 나란히 올라와 있었다. 용량이 여럿인
상품은 그 값이 어느 용량의 것인지 알 수 없어서 뺀다 — 호수가 여럿이면 성분도
색마다 다를 수 있다.

34건 후보 중 11건이 이 규칙들에 걸렸고, 남은 23건 중 20건이 활성화됐다.

## 2026-08-09 (2차) 화면 점검 — `/analyze` 에 이미지가 한 번도 안 떴다

next_task: 유형이 아직 표준이 아닌 13건(`mask` 6 · `cleanser` 4 · 비어 있음 3)과
참존 6건(상품코드가 성분에 섞임). 둘 다 출처 페이지를 봐야 한다.

### 무엇을 봤나

DB 가 아니라 **사용자가 보는 값**으로 점검했다. 추천 풀 86건 기준:

| 항목 | 결과 |
|---|---|
| 한글 제품명 없음 | 0건 |
| 주요 성분 없음 | 0건 |
| 제품명에 판촉 문구 | 0건 |
| 브랜드 표기 흔들림 | 없음 (15종 모두 일관) |
| 화면에 «매칭된 성분 없음» 이 뜨는 시나리오 | **0개** |

카드가 보여주는 «왜 이 제품인가» 는 DB 의 `recommendation_reason` 이 아니라
**계산된 매칭 성분**이다. 그래서 `recommendation_reason` 이 61건 비어 있어도
화면은 비지 않는다 — 이걸 확인하지 않았으면 «61건이 설명 없이 나간다» 고
잘못 보고할 뻔했다.

### 찾은 결함 — `/analyze` 에 이미지 연결이 없었다

이미지는 랭킹 캐시에 없다(서명 URL 이라 만료된다). 화면을 열 때 받아 붙이는데,
그 연결이 `/results` 에만 있고 **`/analyze` 에는 없었다.** 같은 카드를 쓰는데
사진이 한 번도 안 떴다.

같은 실수를 두 번 했다 — 08-04 에 `/results` 를 빠뜨렸고, 08-09 에 `/results` 만
고치고 `/analyze` 를 빠뜨렸다. 둘 다 «DB 에 있다» 를 «화면에 뜬다» 로 착각해서다.

**사람이 기억할 일이 아니라 검사가 할 일이다.** `test:product-image-wiring` 을
만들어 CI 에 넣었다 — 카드를 그리는 화면을 훑어 `useProductImages` 와
`withImage(ranked)` 가 둘 다 있는지 본다. 연결을 일부러 빼서 실제로 실패하는
것까지 확인했다.

---

## 2026-08-09 국내몰 5곳 추가 · 성분표 잡음 제거 — 추천 풀 86건

next_task: 유형이 아직 표준이 아닌 13건 — `mask` 6 · `cleanser` 4 · 비어 있음 3.
이름만으로는 종류를 알 수 없어 남겨 뒀다. 출처 페이지를 봐야 한다.
그리고 참존 6건(272~277)이 **상품코드**(`SS080C1`) 하나 때문에 막혀 있다.
색소 코드(`CI 77491`)와 형태가 겹쳐 무리하게 거르면 진짜 성분을 지운다 —
몰별 추출로 풀어야 한다. 그 다음은 국내몰 후보를 더 확인하는 일(지금까지 86곳).


### 제품 유형이 표기만 다른 값으로 흩어져 있었다

추천 풀 86건에 유형이 **23종**이었는데 실제 유형은 그 절반도 안 됐다 —
`serum`/`Serum`, `toner`/`Toner`, `SPF`/`sunscreen`, `Moisturizer`(=cream),
`Eye Cream`(=eye_cream), `mist`(=facial_mist).

표준 분류(`FACE_SKINCARE_CATEGORIES` 등)에 맞추는 정규화기를 만들어 **190건**을
정리했다. 두 단계로 나눴다:

1. 표기만 다른 것 → 표준값으로 (166건)
2. `mask` · `cleanser` 처럼 **덩어리 값**은 **이름이 말해 줄 때만** 좁힌다 (24건).
   `약산성 시트 마스크` → `sheet_mask`, `폼클렌저` → `foam_cleanser`.

**모르면 바꾸지 않는다.** `오일 크림 클렌저` 는 클렌징 오일인지 밀크인지 이름으로
단정할 수 없고, `찹쌀 쫀쫀팩` 도 시트인지 워시오프인지 모른다. 13건이 그렇게
남았다 — 하나로 정해 버리면 틀렸다는 것조차 드러나지 않는다.

### 실측

| 항목 | 값 |
|---|---|
| 추천 풀 | **86건** |
| 브랜드 | **15개** (달바 26 · COSRX 21 · Abib 13 · Klairs 8 · 에이프릴스킨 4 · 티르티르 2 …) |
| 국내 «구매하기» | **76건** |
| 성분 사전 | 1,538행 · 별칭 107행 |

### 성분표에서 걷어낸 것들 (전부 실측)

| 무엇 | 예 |
|---|---|
| 목록 기호 | `+ 정제수` · `• Astragalus Root Extract` |
| 두 겹 라벨 | `보러가기 전성분 정제수` — 한 번만 떼면 `전성분 정제수` 가 남는다 |
| 주의사항 문구 | `마데카식애씨드 사용할 때` |
| 쇼핑몰 화면 글자 | `향료 닫기 특이사항` · `장바구니 바로구매 선물하기` · `합계 0 (상품금액…` |

### 한글 성분명 안에 끼어든 공백

참존 몰은 줄바꿈 자리에 공백이 남아 성분명이 갈라져 온다 — `나이아 신아마이드` ·
`트로메타 민` · `벤질글라이 콜`. 6개 제품의 미매칭 85건 중 **48건이 순전히 이것**이었다.

공백을 지운 형태가 **우리 사전에 그대로 있을 때만** 같은 성분으로 본다.
없는 이름을 만들지 않는다 — 갈라진 이름을 도로 붙여 원래 알던 성분을 알아보는
것이고, 알아보는 성분이 늘면 알레르겐 판정은 더 촘촘해진다. 한글 토큰에만 쓴다
(`Butylene Glycol` 은 공백이 이름의 일부라 지우면 다른 이름이 된다).

### 등록 필터에 더 걸린 것들

아로마티카 자사몰에 **주방세제**가 있었다. 스킨케어 브랜드라고 스킨케어만 팔지
않는다. 참존은 `하이드라 수분 인 세럼 30ml 5개` 60,000원 — **5개 값**이라 단가가
아니다. 시트마스크 `10개입` 처럼 그 자체가 한 상품인 경우를 막지 않도록,
«용량 뒤에 개수» 형태만 본다.

### 스크립트 버그

식약처 적재가 **이미 있는 별칭과 부딪히면 통째로 실패**해서, 성분 28행은 들어가고
별칭은 0행인 중간 상태가 됐다. 중복은 그냥 두도록 고쳤다(별칭 51행 추가됨).

---

## 2026-08-08 (2차) 에이프릴스킨 추가 · 세트 상품 차단 — 추천 풀 84건

next_task: 전성분을 텍스트로 내는 국내몰을 더 찾는다 (`npm run probe:kr-malls <도메인>`).
지금까지 62곳 확인.


### 「이미지 84/84」 라고 보고했는데 화면에는 안 떴다

DB 에 넣은 것과 **화면에 뜨는 것**은 다른 문제였다. 사용자가 «이미지는 안 나오는
거야?» 라고 묻고서야 확인했다. 두 가지가 막고 있었다.

1. **`validation_status` 를 안 채웠다.** 공개 API(`resolveVerifiedProductImageUrls`)
   는 `validation_status = "verified"` 인 행만 내보낸다. 기본값이 `discovered` 라
   27행이 조용히 빠졌다. 등록 경로는 채우고 있었는데 새로 만든 수집기가 빠뜨렸다.
2. **주소가 `http://` 였다.** 사이트는 https 라 브라우저가 혼합 콘텐츠로 차단한다.
   DB 에도 있고 API 도 내보내는데 화면에는 아무것도 안 뜬다. 10행.

둘 다 고쳤다. **확인 방법도 바꿨다** — 이제 DB 행 수가 아니라
**라이브 API 에 추천 풀 전체를 넣어 몇 건이 돌아오는지**로 센다. 84/84.

교훈: 「DB 에 있다」 는 「화면에 뜬다」 가 아니다. 사용자가 보는 경로로 확인해야 한다.

### 실측

| 항목 | 값 |
|---|---|
| 추천 풀 | **84건** |
| 국내 «구매하기» 가 뜨는 제품 | **74 / 84** |
| 추천 풀 브랜드 | 14개 (달바 26 · COSRX 21 · Abib 13 · Klairs 8 · 에이프릴스킨 4 …) |
| 전성분이 똑같은 그룹 | 1개 (달바 150ml/160ml — 용량만 다른 실제 상품) |

### 세트 상품을 막았다 — 안전 문제였다

에이프릴스킨 `기미 철벽커버 2종 세트` 의 전성분이 **237개**였다. 한 제품에 그만큼
들어가지 않는다 — **세트에 든 제품들의 전성분을 이어 붙인 것**이다.

이걸 한 제품으로 등록하면 「이 제품에 무엇이 들었는가」 에 답할 수 없다.
A 에만 든 알레르겐 때문에 B 를 피하게 되거나 그 반대가 된다. 23건을 막았다.

### 행사 조건이 붙은 값도 막았다

에이프릴스킨은 같은 앰플을 **26,000 · 23,000 · 17,000** 세 값으로 나란히 판다 —
`[비밀할인링크]` · `[2천원 추가할인]` · `★무료배송&비밀특가★`. `[1+1]` 은 2개 값이라
단가가 아니고, `[5+5 / 9,900원 특가]` 에는 «유통기한 임박» 이 붙어 있었다. 44건.

### 파이프라인 결함 둘

1. **정규식에 백스페이스 문자가 박혀 있었다** — `SET` 를 쓰려던 자리에
   `SET` 이 들어가 아무것도 매칭되지 않았다. 저장소 전체를 훑어
   `collect-kr-offers-naver.ts` 에서도 같은 오염을 찾아 고쳤다.
2. **성분표 앞머리에 화면 문구가 붙어 온다** — `보기 정제수`. 에이프릴스킨 네
   제품이 전부 이 토큰 하나 때문에 막혀 있었다(성분 40개 중 39개는 멀쩡했다).
   뒤를 자르는 기존 규칙으로는 못 잡아서 **앞머리 라벨을 떼는** 규칙을 넣었다.

---

## 2026-08-08 추천 풀 51 → 80건 · 브랜드 14개 (배포 대기)

next_task: **병합·배포.** 코드·데이터는 다 준비됐고 사람이 병합 버튼만 누르면 된다.
그 다음은 전성분을 텍스트로 내는 국내몰을 더 찾는 일(`npm run probe:kr-malls <도메인>`).

### 지금 Production 실측

| 항목 | 값 |
|---|---|
| 추천 풀 | **78건** (51 → 80 → 잘못된 데이터 2건 내림) |
| 추천 풀 브랜드 | **14개** (전 12) — d'Alba 24 · COSRX 22 · Abib 13 · Klairs 8 … |
| 성분 사전 | **1,494행** (전 1,341) · 별칭 48행 (전 0) |
| 시나리오 30개 중 최소 개수 미달 | 0 |
| 국내 구매처 없는 시나리오 | 0 |
| 풀 중 이미지 있음 | **78 / 78** |
| **국내 «구매하기» 가 뜨는 제품** | **68 / 78** |




### 구매 버튼이 안 뜨는 10건은 «시장 사실» 이다

`check:purchase-cta` 가 이제 **안 뜨는 제품을 이름으로 찍는다** (합계만 있어서
매번 따로 세야 했고, 그러다 DB 원본 행을 판정 함수에 그대로 넘겨 «78건 전부
구매 불가» 라는 엉터리 값을 얻은 적이 있다 — `normalizeProductOffer` 를 거쳐야 한다).

10건을 출처까지 확인했다:

  · COSRX 레티놀 0.1 · 비타민C 23 · 6 펩타이드 — **국내몰에 아예 없다**(글로벌 전용)
  · Klairs 서플 프레퍼레이션 언센티드 토너 — 국내몰에 있으나 **품절**
  · 라네즈 · 이니스프리 · 조선미녀 · 하루하루원더 · Axis-Y — 쓸 수 있는 국내몰 없음

즉 버그가 아니라 실제로 지금 국내에서 그 경로로는 못 사는 것들이다.
`collect:kr-offers-mall` 도 새로 채운 것 0건으로 같은 결론을 냈다.

### 넘버즈인·한율을 여전히 쓰지 않는 이유 (2026-08-08 재확인)

넘버즈인은 `availability` 를 **품절일 때만** 낸다(`OutOfStock`). 판매중이면 아무
표시가 없다. 쓰려면 «표시가 없으면 판매중» 이라고 읽어야 하는데 그건 추측이고,
틀리면 품절 상품 구매 링크로 사람을 보낸다. 한율도 표본 3건 모두 표시가 없었다.

### 전성분이 «똑같은» 제품 쌍 — 하나는 안전 문제였다

`check:duplicate-formulas` 를 만들어 추천 풀을 훑었다. 전성분이 글자까지 같은
그룹 3개가 나왔고, 셋의 성격이 전부 달랐다. 가르는 단서는
`product_ingredients.source_url` 이다.

| 제품 | 판정 | 조치 |
|---|---|---|
| 77 «Black Snail All In One Cream» | 성분 출처가 **Advanced Snail 92 페이지** — 남의 전성분 | 내림 |
| 21 «Vitamin C 23 Serum» | 187 과 출처 URL 이 같다 = 같은 제품 두 번 등록. slug 도 `skin1004-` 로 어긋남 | 내림 |
| 241 / 253 달바 150ml·160ml | 출처 페이지가 다르고 용량만 다른 실제 상품 둘 | **둘 다 둔다** |

77 이 제일 위험했다 — 알레르기·회피 판정이 **엉뚱한 제형**을 보고 내려지고 있었다.
지우지 않고 `active=false` 로 내렸다. 올바른 전성분을 다시 받으면 되살릴 수 있다.

### 이미지 — 풀 80건 전부 채웠다

달바 24건은 몰 JSON-LD 에 `image` 가 없었다. 대신 `og:image` 가 제품별로 다르게
들어 있어서(URL 에 상품번호가 있다), **그 제품의 공식 오퍼 URL 이 곧 그 제품
페이지**라는 점을 이용해 직접 읽었다(`collect:images-from-offer`). 제품명 대조가
없으니 엉뚱한 사진이 붙을 여지도 없다.

그 과정에서 기존 Shopify 수집기의 결함을 찾았다 — 제품명 «유사도» 로 대조하므로
이름이 겹치는 두 제품이 같은 스토어 항목에 붙는다. Production 실측 2쌍:

    Advanced Snail 92 All in One Cream  ↔  Black Snail All In One Cream
    Peach 70 Niacin Serum               ↔  Peach 70 Niacin Serum Glow

**사진이 없는 것보다 다른 제품 사진이 붙는 쪽이 훨씬 나쁘다** — 그걸 보고 엉뚱한
제품을 산다. 겹치면 양쪽 다 버리도록 막고, 잘못 붙어 있던 4행은 지운 뒤 제품
페이지에서 다시 받았다. 백업: `data/backups/2026-08-08/catalog-product-media.json`.

### 사전 확장이 «항상 0건» 이던 마지막 원인 — npm 이 플래그를 먹었다

`--production` 은 **npm 자신의 설정 플래그**다. `npm run … -- --production --apply`
를 돌리면 npm 이 가로채서 스크립트까지 오지 않는다. 그래서 아무 경고 없이
**Staging 에 96행이 들어갔고**, 나는 그 결과를 Production 결과로 읽고 여러 판을
헛돌았다. 플래그를 `--target-production` 으로 바꾸고, **어느 DB 를 보는지 첫 줄에
항상 찍게** 했다. Production 은 그동안 한 번도 바뀌지 않았다(직접 조회로 확인).

### 한 일

- 국내몰 후보 38곳 확인 → **달바·티르티르·설화수** 추가 (재고 302건)
- **제품 37건 등록** (231~267) — 달바 29 · 티르티르 3 · 설화수 5. 전부 비활성이라
  지금 화면에는 영향이 없다.
- 등록 품질 필터 3종을 `src/lib/catalog/mallRegistrationFilters.ts` 로 빼고
  회귀 테스트 등록 (`npm run test:mall-registration-filters`, CI 포함).

### 앞선 판단을 뒤집은 것 — 식약처 자료는 쓸 수 있다

08-07 에 «그 성분들은 식약처 자료에 없다» 고 적었는데 **틀렸다.** 급히 짠 XML
파서가 조용히 빈 값을 돌려주고 있었다. 동작이 확인된 파서로 다시 재니
**미검증 제품의 미매칭 229종 중 148종이 식약처에 있다** (`리마콩씨추출물` ·
`캐모마일꽃수` · `무화과추출물` 포함 — 「없다」 고 했던 바로 그 성분들이다).

적재가 «항상 0건» 이던 원인도 둘 다 찾았다:

1. 색인은 `normalizeTextKey` 로 만들고 조회는 토큰 원문으로 했다 → 항상 빗나감
2. 그 스크립트는 **Staging 전용**이라 Production ref 면 즉시 중단 → 「적재 0행」 은
   Staging 얘기였고 **Production 사전은 한 번도 확장된 적이 없다**

교훈: 진단 도구를 급조하지 않는다. 새 파서가 조용히 0을 돌려주면 그 0을 사실로
믿게 된다. 그래서 진단을 `build:mfds-ko-synonyms --coverage` 로, **이미 동작이
확인된 스크립트 안에** 넣었다.

---

## 2026-08-07~08 국내 카탈로그 — 추천 풀 51건 (🚀 배포 완료)

next_task: 전성분을 **텍스트로** 공개하는 국내몰을 더 찾는다 (`npm run probe:kr-malls <도메인>`).
편강율 확인으로 병목이 «파는 곳» 이 아니라 «전성분을 텍스트로 내는 곳» 임이 드러났다.
Klairs 227~230 은 성분 3종이 식약처 자료에도 없어 출처가 생기기 전까지 보류.

### 지금 Production 실측

| 항목 | 값 |
|---|---|
| 추천 풀 (active + verified_at) | **51건** |
| 추천 풀 브랜드 | 12개 (COSRX 22 · Abib 13 · Klairs 4 · 그 외 9개 브랜드) |
| 시나리오 30개 중 최소 개수(3) 미달 | **0개** |
| 국내 구매처가 하나도 없는 시나리오 | **0개** |
| 브랜드 상한(2) 초과 시나리오 | 0개 |
| 성분 사전 | 1,341행 + 식약처 한글 이명 33개 |

### 이번에 푼 것

국내몰 제품이 활성화 게이트에서 막혀 있던 이유는 **성분이 없어서가 아니라
한글 이름이 하나가 아니어서**였다 (`살리실릭애씨드`=`살리실산`,
`하이알루로닉애씨드`=`히알루론산`). 식약처 원료성분정보에서 **영문명이 정확히
일치하는 것만** 골라 이명 사전을 자동 생성해 붙였다 — 27종/33개, 우리가 만든
표기는 없다. 함께 한글 규제 문구(`주름개선` · `｢화장품법｣에 따른`)와 제형
라벨(`[블루드롭]`)도 성분표에서 걷어냈다. 자세한 것은 CHANGELOG 2026-08-07.

풀린 15건 중 **4건(195·200·207·214)은 전부터 같은 이유로 막혀 있던 기존 제품**이다.

### 배포 상태 — 완료

PR #43 병합 → `main` `51ce8ba`. 라이브 `/api/health` 로 반영 확인,
주요 화면 6종(`/` `/quiz` `/analyze` `/results` `/routine` `/face-explorer`) HTTP 200.
배포 직후 실측: 시나리오 30개 전부 최소 개수 충족 · 국내 구매처 없는 시나리오 0 ·
브랜드 상한 초과 0. 캐시 버전 V2 → V3 (풀이 36 → 51 로 늘어 옛 Top 5 가 낡았다).

### 국내몰 확대 — 21곳을 실제로 열어 확인한 결과 (2026-08-07)

`npm run probe:kr-malls` 로 사이트맵·제품URL·JSON-LD 가격·자리표시 여부를 확인했다.
근거는 `artifacts/kr-malls/probe.json`.

| 도메인 | 결과 |
|---|---|
| pyunkangyul.com | 제품 221 · 가격 220 · 재고 71 → **KR_MALLS 에 추가** |
| numbuzin.com | 가격은 정상, `availability` 없음 → 재고를 추측하지 않는다 |
| dalba.co.kr | 제품 281건이나 JSON-LD 가격 없음 |
| torriden.com | 제품 5건 · 가격 없음 |
| anua · skin1004 · goodal · isntree · manyo · mixsoon 등 | 사이트맵을 못 찾음 |

**편강율은 붙였으나 등록 제품은 0건이다.** 전성분을 상세 «이미지» 로만 싣고
페이지 텍스트에 성분이 한 글자도 없다. 글로벌 스토어(Shopify 121건)에도 없다.
OCR 로 채우지 않는다 — 알레르겐 판정에 쓸 만큼 믿을 수 없다.

즉 **국내 카탈로그 확대의 실제 병목은 «파는 곳» 이 아니라 «전성분을 텍스트로
공개하는 곳»** 이다. 다음 확대는 이 조건을 만족하는 몰을 찾는 데서 시작해야 한다.

### 아직 막힌 것 (지어내지 않고 남긴다)

- Klairs 227~230 — 위 3개 성분이 사전 1,341행에 **실제로 없다.** 이명이 아니라 사전 공백.
- Round Lab 몰 86건 — 재고를 안 줄 뿐 아니라 **전성분도 텍스트로 없다**(10건 표본 0/10).
  즉 재고 문제가 아니라 편강율과 같은 문제였다.
- 오염 전성분 4건(123·156·176·191) — 전부 풀 밖, 게이트가 막고 있다.
- DB 브랜드 문자열에 `COSRX` 와 `CosRX` 가 공존한다. 추천·브랜드 상한은 소문자
  키로 묶어 보므로 **오작동은 없다.** 표기 정리는 별건.

---

## 2026-07-30 Production 카탈로그 복구 + 안전 수정 (배포 대기)

### 결론부터

**Production 활성 제품 2 → 17건**, 오퍼 2 → 38건, 성분 사전 112 → 1,284행.
코드 수정은 전부 `feature/scalp-hair-track-20260727` 에 있고 **아직 배포되지 않았다**
(배포본 `355624d`, 92커밋 뒤처짐). PR 본문은 [docs/PR_BODY_20260730.md](docs/PR_BODY_20260730.md).

### 무엇이 문제였나

07-28 에 «Production 제품 191건 중 189건이 사라졌다» 로 보였던 것은 **데이터 유실이
아니라** `verified_at IS NULL` 로 파이프라인이 «판매처 없음» 에서 멈춘 상태였다.
그 189건을 살리는 과정에서 파이프라인 결함이 연달아 드러났다.

### 고친 것 (14건)

| # | 문제 | 영향 |
|---|---|---|
| 1 | 알레르겐 필터가 `key_ingredients` 만 봄 | 향료 함유 23건 중 3건만 걸림 → **21건** |
| 2 | 확장 시 지방 알코올 오탐 | 87건 중 22건이 잘못 제외될 뻔 → 접두 매처로 차단 |
| 3 | 한글·영문 알레르겐 미연결 | 리모넨 0→14 · 리날룰 0→13 |
| 4 | 오퍼 필터가 항상 KR 고정 | 미국 사용자에게 US 판매처가 안 보임 |
| 5 | 수집기가 `key_ingredients` 미채움 | 활성 106건 중 60건이 추천에서 제외 |
| 6 | 전성분 추출기 오염 3종 | 네비게이션·판촉 문구가 성분으로 들어감 |
| 7 | 선두·꼬리 UI 잡음 | `&times; Full Ingredients` · `DETAILS` |
| 8 | 사전 부연 괄호 미매칭 | `Panthenol (Vitamin B5)` ↔ `Panthenol` |
| 9 | INCI 슬래시 동의어 | `Aqua/Water/Eau` 는 성분 하나 |
| 10 | 성분 링크 순번 충돌·중복 | `product_ingredients_order_uidx` |
| 11 | 게이트 미매칭 수 계산 오류 | 옛 개수로 계산해 통과할 것이 막힘 |
| 12 | **PostgREST 1000행 절단** | 사전이 1,242행이 되자 새 성분이 조회에서 빠짐 |
| 13 | 허용 등급에 C 추가 (승인) | 등급 B 는 confidence 1.0 에서만 나옴 |
| 14 | 얼굴 트랙 밖 8건 추천 풀 제외 | 향수·핸드크림·바디 |

### Production 에 실제로 한 일

브랜드 정정 4건(SKIN1004 → COSRX, 전수 대조로 확인) · 오퍼 38건 · 전성분 24건 ·
성분 사전 1,172행 추가(Staging 1,103 + 식약처 69) · 성분 링크 1,134건.
**모든 변경 전에 백업을 남겼다**(`backups/production_*.sql`).

작업 중 두 번 실수했고 둘 다 백업으로 복구했다 — 되돌리기가 과해 원래 값 5건을
지운 것, 링크 재생성에서 `source_url` 누락으로 567건이 지워진 채 0건만 남은 것.

### 검증

타입체크 · `npm run build` · 회귀 11종 · 추천 selftest 4종 전부 통과.
Production 시나리오 4종 실측: 붉은기+민감 7 · 건성+장벽 10 · 색소침착 9 ·
지성+모공 12건, Top 5 정상.

### 남은 것

- **배포** — `main` 병합 후 Vercel. 지금 활성 17건인데 **구매 링크가 안 뜬다**
  (국가 매칭 미배포, 오퍼 38건이 전부 US)
- 브랜드 쏠림 — 17건 중 COSRX 10건
- 수집 대상 9건은 페이지 문구 오염으로 미매칭 (브랜드별 파서 또는 사람 검수 필요)
- `DRAFT_DO_NOT_APPLY_20260728_products_availability_status.sql` 미적용

### 이어서 진행한 것 — 전성분 오염 차단 (2026-07-30, DASHBOARD §37·§38)

전성분은 알레르겐 필터의 입력이다. 추출기를 두 번 고쳐도 페이지 문구가 새어 들어왔고,
데이터를 되돌리는 것으로는 재발을 막지 못한다는 것이 확인됐다. 그래서 **활성화 게이트가
전성분의 «형태» 를 요구하도록** 고쳤다 — 오염된 전성분을 가진 제품은 활성화될 수 없다.

- 추천 풀 제품 중 전성분 검증 통과 **15/17 → 17/17**
- Production (승인 받음): 오염 10건 정제 교체 · 전성분 3건 보강 · id 1 비활성화
- 라이브 빈틈 해소 — 풀 2건이 전성분이 비어 알레르겐 검사가 `key_ingredients` 2개만
  봤다(향료 알레르기를 입력해도 «알레르겐 없음»). 브랜드 글로벌 스토어에서 채웠다.
- 수집기가 `verified_at IS NULL` 만 훑어 **정확히 라이브인 제품을 건너뛰던** 결함 수정

**정정**: 최초 보고에서 `active = true` 를 «노출 중» 으로 읽어 17건을 노출 위험으로
보고했는데 틀렸다. 추천 풀은 `active = true AND verified_at IS NOT NULL` 이고,
오염된 17건은 전부 `verified_at` 이 비어 **풀에 없었다.** 사용자 추천에 나간 적 없다.

**카탈로그 확대는 막혀 있다.** 브랜드 스토어를 11개 더 찾아 붙였지만 매칭은 1건.
전성분이 없거나 오염된 79건 중 채운 것은 3건뿐이다 — 나머지는 DB 제품명이 해당
스토어 카탈로그에 없거나, 페이지에 전성분 구간이 아예 없다. 스토어를 더 찾는
방식으로는 늘지 않는다. 다른 경로가 필요하다.

- 2026-08-04 **배포 완료** — PR #37 병합, `main` `e5505c1` → `6659e14`.
  라이브 `/api/health` 버전 확인. 국내 구매 링크·브랜드 상한·전성분 오염 차단 반영.
  배포 직후 실측: 시나리오 30/30 성립 · 추천 풀 전성분 17/17 통과 (DASHBOARD §45)
- 2026-08-04 (최신) 추천 풀 17 → **26건** · 브랜드 6 → **10개** · 제품 이미지 0 → **26/26**.
  자세한 내용은 DASHBOARD §45~§52.
  · 카탈로그 확대의 진짜 원인은 데이터 부족이 아니라 **저장된 전성분이 잘못 쪼개져 있던 것**
  · 이미지는 **처음부터 뜬 적이 없었다** — 테이블·배선·데이터가 모두 없었고 셋 다 채웠다
  · 네이버 쇼핑 API 폐지 확정. 대체로 브랜드 국내몰 sitemap+JSON-LD 경로를 만들었다
- 2026-08-05 **배포 완료** — PR #39 병합, `main` `a92669e` → `0e890e0`. 라이브 반영 확인.
  이미지 API 가 라이브에서 URL 을 반환하는 것까지 검증했다(DASHBOARD §54).
  **국내 사용자 기준 변화는 «사진이 뜬다» 하나다** — 제품 수는 13건 그대로.
- next_task: **국내 오퍼 확보** — 제품 폭의 유일한 지렛대. 국내몰 sitemap+JSON-LD
  경로는 만들었고 한글↔영문 이름 대조가 병목이다(DASHBOARD §52·§53).


## 2026-07-27 얼굴 트랙 밖 제품 제외 + Production 감사 SQL (사람이 실행)

### (1) 얼굴 트랙 밖 8건을 추천 후보 풀에서 제외

- `isOutsideFaceTrack()` 신설([publicCatalogFilter.ts](src/lib/recommend/publicCatalogFilter.ts)). `perfume` · `hand_cream` · `body_lotion` · `body_wash` · `body_oil` · `body_scrub` · `foot_cream` 을 얼굴 추천 후보에서 뺀다.
- **제품을 내리지 않았다.** `active=false` 로 바꾸지 않고 카탈로그에는 그대로 두고 **추천 풀에서만** 뺐다. §44 단계 6.5 트랙 B 를 시작하면 그때 각 트랙의 풀로 쓸 수 있다. DB 쓰기 없음 — 코드 변경만.
- 적용 지점 2곳: `fetchCandidateProducts`(핵심 추천 경로)와 [results/page.tsx](src/app/results/page.tsx)(결과 화면이 직접 조회하는 경로). 두 번째를 놓치면 화면에는 그대로 나온다.
- **`category` 가 비어 있으면 빼지 않는다.** 유형을 모른다는 이유로 얼굴 제품을 조용히 떨어뜨리는 쪽이 더 나쁘다.
- 두피·모발 카테고리(shampoo/conditioner/hair_treatment/hair_styling)는 **건드리지 않았다.** 단계 5.5 가 별도 점수 체계를 쓰기로 돼 있어 미리 손대면 그 설계와 충돌한다. `npm run test:face-track-filter` 가 이걸 못 박아 둔다.
- 결과: 추천 풀 106 → **98건**. 정확히 8건 제외.

### (2) Production 알레르겐 감사 SQL — 읽기 전용, 사람이 직접 실행

- 파일: [data/production-audit/2026-07-27-allergen-exposure-READONLY.sql](data/production-audit/2026-07-27-allergen-exposure-READONLY.sql). Production CLI 토큰은 발급하지 않기로 해서, 사람이 Dashboard SQL Editor 에서 실행하고 결과만 가져오는 방식.
- 처음에 `supabase/migrations/STAGING_ONLY_DIAGNOSE_*` 로 만들었던 것을 옮기고 이름을 고쳤다 — Production 대상이고 마이그레이션이 아니다.
- **읽기 전용 기계 검증**: 주석을 제거하고 문자열 리터럴을 인식해 파싱한 결과 구문 4개(WITH·WITH·SELECT·SELECT), 주석 밖에 `insert/update/delete/drop/alter/create/truncate/grant/revoke/merge/copy/commit/rollback` **0건**.
- **로직 검증**: 이 세션에 SQL 실행 경로가 없어(CLI 토큰 없음) SQL 자체는 시험 실행하지 못했다. 대신 SQL 의 판정 규칙을 TS 로 그대로 옮겨 Staging 에 돌려(`npm run check:allergen-audit-sql-validate`) 운영 코드 경로와 대조 — **28건 = 28건, 갈리는 제품 0건**.
- 검증 중에 SQL 버그 2개를 잡았다: (a) 정규화에서 숫자를 안 지워 코드와 어긋남, (b) 길이 하한 4자를 **정확 일치에도** 걸어서 «향료»(2자)·«리모넨»(3자)이 잘림 — 이것 때문에 설화수 3건을 놓쳤다. 둘 다 고쳐서 일치시켰다.
- **미검증**: SQL 문법 자체. 실행할 때 드러난다. 쿼리 1 부터 하나씩 실행 권장.
- next_task: 사람이 Production 쿼리 1~4 실행 → 결과 회수 후 판단


## 2026-07-27 category 채우기 + 알레르겐 노출 최종 감사

재현: `npm run apply:product-category-fill` (dry-run) · `npm run check:allergen-exposure-audit` (읽기 전용).

### category 채우기 — 44건 중 43건

근거는 **브랜드가 제품명에 써 놓은 유형 표기**다(«크림», «시트 마스크», «폼 클렌저»…). 추정이 아니라 원문을 읽은 것이고, 근거 문구를 `product_category_filled` 감사 로그에 남겼다. 표기가 겹치는 것은 좁은 규칙을 먼저 뒀다 — 「핸드크림」이 「크림」으로, 「선세럼」이 「세럼」으로 잘못 잡히지 않게.

| 카테고리 | 건수 | 카테고리 | 건수 |
|---|---|---|---|
| mask | 15 | perfume | 3 |
| cream | 9 | hand_cream | 3 |
| foam_cleanser | 3 | body_lotion | 1 |
| serum | 3 | body_wash | 1 |
| toner | 2 | cleanser | 1 |
| sunscreen | 1 | eye_patch | 1 |

- 제품명만으로 안 나오는 3건은 **브랜드 공식 페이지에서 직접 확인**했다: 200 카밍 페이셜 솝 → 페이지 title «진정 클렌저» · 144 마데카소사이드 진정 시트 → abib 「마스크팩」 카테고리 목록에 포함 · 178 콜라겐 아이패치 → abib 「패치」 목록에 포함(마스크팩 목록엔 없음).
- **1건은 채우지 않았다**: 242 아로마티카 수딩 알로에 베라 젤 500ml. 제품명·원문 페이지 어디에도 제품 유형 표기가 없고, 사용방법이 «얼굴과 몸 전체에» 라 얼굴 전용도 아니다. `verification_queue` 에 `product_category_unknown` 으로 남겼다.
- **별도 보고 — 얼굴 트랙 밖 제품 8건이 추천 후보 풀에 있다**: 향수 3(183·184·185) · 핸드크림 3(188·189·190) · 바디 에멀전 1(192) · 바디 워시 1(193). §29 MVP 는 얼굴 트랙만이고 §44 단계 6.5(트랙 B)는 미착수인데, 이 8건은 지금 얼굴 고민 시나리오의 후보로 들어간다. 카테고리는 채웠지만 **풀에서 뺄지는 판단이 필요해 손대지 않았다.**
- 채운 뒤 시나리오 카테고리 매칭이 살아났다 — 예: 홍조·진정 세럼 Top5 중 카테고리 일치 0건 → 2건.

### 알레르겐 노출 최종 감사

- **옛 필터가 놓쳐 노출될 수 있었던 제품: 28건** (중복 제외). 입력별로는 향료 18 · 리모넨 14 · 리날룰 13 · 헥실신남알 7 · 시트로넬올 6 · 벤질벤조에이트 6 · 시트랄 5 · 변성알코올 5 · 센텔라 5 · 제라니올 4 · 나이아신아마이드 4 등. **이번 수정으로 전부 걸러진다.** 설화수 라인과 아도르 헤어 제품이 다수를 차지한다(한글 전성분 «향료»·«리모넨» 이 영문 입력과 안 이어지던 건).
- **여전히 매칭하지 않는 4건은 누락이 아니라 별개 성분이다**: `Hexyl Cinnamal` vs `Cinnamal` 은 EU 표시 알레르겐 목록에 각각 따로 오른 별개 성분이라 서로 묶으면 안 된다(3건). `Capryloyl Salicylic Acid`(LHA) vs `Salicylic Acid` 1건은 유도체 관계라 판단이 갈릴 수 있다 — 묶으려면 규칙이 아니라 alias 그룹에 명시적으로 넣어야 하므로 결정을 남겨 뒀다.
- **범위 한계**: 이 감사는 **Staging** 대상이다. Production service_role 키는 이 세션에 없어(설정상 차단) Production 카탈로그는 확인하지 못했다. Production 에도 같은 확인이 필요하면 별도 요청이 필요하다.
- next_task: (선택) 얼굴 트랙 밖 8건 처리 방침 결정 · Production 알레르겐 감사 여부 결정


## 2026-07-27 알레르기·회피 필터를 전성분 전체로 확장 (승인 후 수정 완료)

재현: `npm run test:allergen-full-ingredients` (순수 로직) · `npm run check:allergen-expansion-dryrun` (영향 측정) · `npm run check:recommendation-scenarios` (실데이터 커버리지).

- **원인 특정**: 상위 N개 절단은 없었다. `filterCandidatesBySafety` 가 `key_ingredients` + `key_ingredients_ja` 필드**만** 읽는 게 전부였다. 그 필드는 `KEY_ACTIVE_DICTIONARY`(기능성 성분 23종)로 골라낸 부분집합이라 향료·리모넨·리날룰이 구조적으로 들어갈 수 없다. 그래서 향료 함유 제품 중 3건만 걸렸다.
- **수정**: 알레르겐 판정만 `full_ingredients` 까지 훑는다(`collectAllergenScanLabels`). 랭킹 점수는 그대로 `key_ingredients` 만 쓴다 — 가중치 무변경. 추천 풀 자격(`incomplete_info`) 판정도 그대로 `key_ingredients` 기준이라 새 제품이 풀에 들어오지 않는다.
- **확장이 새로 만들 뻔한 결함 2종을 같이 잡음** — 전성분 규모에서만 드러난다:
  1. **지방 알코올 오탐 15건.** 캐논컬이 공백을 지워 `alcohol` 이 `cetearylalcohol` 에 «포함» 되므로, 옛 매처로 확장했다면 세테아릴·세틸·베헤닐알코올(유화제·에몰리언트)이 전부 «변성알코올» 로 걸렸다. 87건 중 22건이 잘못 제외될 뻔했다.
  2. **Ethylhexylglycerin 오탐 2건.** 같은 이유로 «글리세린 회피» 에 걸렸다. 별개 성분이다.
  - 해결: 안전 필터 전용 매처 `allergenMatch.ts` 신설. INCI 는 수식어가 머리명사 **앞** 에 오므로(`Centella Asiatica Extract` = 센텔라 유래 / `Cetearyl Alcohol` ≠ 알코올), 포함이 아니라 **접두 관계** 로 판정한다. 랭킹이 쓰는 `findMatchByCanonical` 은 건드리지 않았다.
- **한글↔영문 알레르겐 연결**: 국내 전성분은 «리모넨» 인데 입력은 «Limonene» 이라 캐논컬이 갈렸다. 향료 유래 표시 알레르겐 17쌍을 alias 에 추가 — 전부 `ingredients` 테이블(식약처 원료성분정보 적재분)에서 확인한 쌍만 넣었고, 확인 안 된 4개(벤질신나메이트·아이소유제놀·아밀신남알·아니스알코올)는 넣지 않았다.
- **실데이터 커버리지 (활성 106건, 성분정보 있는 87건 기준)**:

  | 알레르겐 | 수정 전 | 수정 후 |
  |---|---|---|
  | 향료 | 3 / 23 | **21 / 23** |
  | 변성알코올 | 2 / 3 | **3 / 3** |
  | 리모넨 | 0 / 14 | **14 / 14** |
  | 리날룰 | 0 / 13 | **13 / 13** |

  남은 미검출 2건은 필터 문제가 아니라 §35.7 파서 잔여물 — 광고 문구가 성분 토큰에 붙어 하나의 긴 토큰이 됐다(예: `*리모넨 *에센셜오일에서 자연적으로 발견되는 성분 기능성화장품의 경우…`). 대기열.
- **회귀**: 기존에 걸리던 케이스는 전부 그대로 걸린다(제외 집합 단조 증가, dry-run 실측 회귀 0건). 오탐 검사에서 «근거가 원문에 없는» 제외 0건. 추천·품질·상업분리·현지화·시나리오·파일럿 selftest 및 core journey 전부 통과, `npm run build` 성공.
- **노출 위험 답변**: 이 필터는 사용자가 알레르기·회피 성분을 **입력했을 때만** 동작한다. 아무 것도 입력하지 않은 사용자에게는 영향이 없고, 제품 자체가 위험한 게 아니다. 다만 해당 성분을 신고한 사용자에게는 최대 27건(중복 제외)이 걸러지지 않고 노출되던 상태였고, 이번 수정으로 해소됐다.
- next_task: category 채우기 (활성 44건 — abib 43 · 아로마티카 1)


## 2026-07-27 추천 품질 검증 (Staging) — 수집 제품이 추천에 안 들어가던 원인 수정

활성 106건으로 §29 KR 코어 시나리오 6종을 실제로 돌려보고, 새 브랜드(abib·아로마티카·SIORIS)에서 안전 필터가 제대로 도는지 확인했다. 재현: `npm run check:recommendation-scenarios` (읽기 전용).

- **결함 1 (수정 완료) — 수집한 제품이 추천 후보에서 통째로 빠지고 있었다.** 추천·안전 필터(`rankProducts`, `filterCandidatesBySafety`)는 `products.key_ingredients` 만 읽는데, 자율 수집기는 `full_ingredients` 와 `product_ingredients` 링크만 채우고 `key_ingredients` 는 건드리지 않았다. 그래서 활성 106건 중 **60건이 `incomplete_info` 로 매 시나리오에서 제외**되고 있었다(abib 43건 전부 포함). 어떤 시나리오에서도 abib·아로마티카 제품이 한 건도 노출되지 않았다.
  - 근본 원인 수정: `product-activate.ts` 가 활성화 시 `deriveKeyIngredientsFromFullList` 로 `key_ingredients` 를 함께 채운다. 사전에 있으면서 **동시에 그 제품 전성분에 실제로 등장하는 토큰**만 고르고, 저장값은 전성분 원문 그대로다(지어내지 않음, 원문 대조 가능).
  - 기존 데이터 백필: 41건(abib 40 · Round Lab 1). 성분 없음 60 → **19건**. 되돌리기용 백업 `data/backups/2026-07-27/key-ingredients-before-backfill.json`, 감사 로그 `product_key_ingredients_backfilled`.
  - 남은 19건은 전부 아도르 헤어 제품 + 아로마티카 2건 — 사전이 얼굴 스킨케어 성분 위주라 매칭 0건. **억지로 채우지 않고 그대로 뒀다.**
- **결함 2 (보고만, 미수정 — 승인 필요) — 알레르겐 필터가 전성분을 보지 않는다.** 안전 필터는 `key_ingredients`(사전으로 골라낸 부분집합)만 읽는데, 향료·리모넨·리날룰 같은 대표 알레르겐은 그 사전에 없다. 활성 106건 기준 **향료 함유 40건 중 필터가 잡는 건 3건**, 리모넨 19건 중 0건, 리날룰 18건 중 0건. 즉 «향료 알레르기» 를 입력해도 대부분 걸러지지 않는다. 안전 필터 변경은 명시적 승인 대상이라 측정만 하고 손대지 않았다.
- **정상 확인된 것**: 알레르기 필터가 근거 없이 제외한 제품 0건, 해당 성분을 갖고 있는데 통과한 제품 0건(= `key_ingredients` 범위 안에서는 정확). 새 브랜드도 기존 브랜드와 동일하게 필터를 통과·제외한다(나이아신아마이드 회피 시 abib 17건, 센텔라 14건, 글리세린 40건 제외). Top 5 매칭 근거는 전부 실제 성분 교집합이고 `filterRankedByMatchEvidence` 를 통과한 것만 노출된다.
- **부수 발견**: 활성 제품 44건(abib 43 · 아로마티카 1)의 `category` 가 비어 있어 시나리오 카테고리(serum/cream/toner…) 매칭이 안 된다. 랭킹 점수에는 영향 없으나 «세럼 추천» 에 시트 마스크가 1위로 오는 원인. 대기열.
- next_task: 결함 2(알레르겐 전성분 조회) 승인 여부 결정 → 승인 시 `filterCandidatesBySafety` 확장 · 미승인 시 수집기 category 채우기로 이동


## 2026-07-26 Master Plan v4.3 — 두피·모발 트랙과 카테고리 확장 로드맵 정식 편입

- **버전**: `MASTER_PLAN.md` v4.2 → **v4.3** (상단 제목·본문 공식 버전 블록 모두 갱신). 기존 §1~§46은 삭제·축약 없이 유지, 추가와 명확화만 수행.
- **§44 재구성**: 단계 1~4에 `[얼굴 MVP]` 태그 부여 · **단계 4 완료 = MVP 런칭 시점** 확정 · 단계 6 제목을 "증상 기반 피부과 (얼굴 + 두피·모발 전문의 포함)"로 확장.
- **§44 단계 5.5 신설 — 두피·모발 트랙(확장 A)**: §11 두피 분류, §22 촬영·분석 로직, §12 두피 제품 카테고리, §36 영상 유형을 재사용. **두피 추천 점수는 얼굴 점수와 합산하지 않고 분리**. §37에 두피·모발 전문의 카테고리 추가.
- **§44 단계 6.5 신설 — 카테고리 확장 트랙 B**: 바디케어 → 핸드·풋 → 남성 그루밍 → 헤어스타일링 → 향수 → 뷰티 디바이스. 여성 청결·구강 케어는 규제·의료 경계 검토 전까지 **보류**.
- **§14 두피·모발 특별 규칙 추가**: 남성형·여성형 탈모는 C/D/E · '치료' 표현 금지 · '탈모 증상 완화 기능성'과 '탈모 치료' 구분 · 지루성 두피염·원형탈모·급격한 탈모는 D/E · 두피 상처·감염·통증은 E.
- **§29 MVP 범위 명확화**: MVP는 **얼굴 트랙만** 포함. 나머지는 런칭 후 단계 5.5·6.5로 확장.
- **부록 A 신설**: v4.1 → v4.2 → v4.3 변경 이력을 문서 내부에 기록.
- **현재 위치**: 얼굴 MVP 트랙(단계 1~4) 완료·Production 출시 완료. 단계 5·6 진행 중. **단계 5.5·6.5는 미착수.**
- next_task: 단계 5 리텐션 안정화 → 단계 5.5 두피·모발 트랙 착수 여부 결정

## 2026-07-26 Production 출시 · 병원 데이터 이관 · 관리자 로그인 버그 수정

## 2026-07-26 관리자 로그인 무한 루프 수정 + 세션 정리

- **관리자 흰 화면 해결(PR #35 병합·배포 완료)**: 원인은 secret key가 아니라 `src/app/admin/login/page.tsx`에서 `redirect()`가 `try` 안에 있어 `catch`가 `NEXT_REDIRECT` 신호를 삼킨 것. `/admin/login`이 초당 3회 무한 재요청되어 화면이 안 그려졌다. `redirect()`를 `try` 밖으로 이동. main `355624d` → Vercel `mdnkflqc9` Ready. **배포 후 실측: 초당 3회 → 0.09회, 리다이렉트 1회 후 정지.**
- **care "연결에 실패했습니다"는 service_role과 무관함 확인(앞선 판단 정정)**: `/api/care/analyses/attach`는 `createSupabaseServerClient()`(anon + 사용자 세션)만 사용한다. care에서 service_role을 쓰는 곳은 백그라운드 이메일 워커뿐. 엔드포인트·의존 요소 모두 정상이나, **인증 상태의 실제 호출은 미검증**(Production `mailer_autoconfirm:false`로 테스트 세션 생성 불가).
- **정리 원칙 §11 신설 + 최초 적용**: 브랜치 원격 24 + 로컬 1 삭제(미병합 4개 보존), 임시 env 2개·scratchpad 10개 삭제, 로컬 `main` 최신화, `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` 로컬 삭제.
- **미완 2건 (차단)**: `SUPABASE_ACCESS_TOKEN`이 어디에도 없어 Supabase secret key 목록 조회·옛 키 삭제를 실행하지 못함.
- next_task: 액세스 토큰 제공 → 옛 secret key 정리 · (선택) 고객 계정 자격증명으로 care attach 최종 검증

## 2026-07-26 병원 데이터 Production 이관 완료 (사람 승인 하 에이전트 직접 실행)

- **결과**: Production `dermatology_institution_candidates` = **1,917행**(verified 1,868 · discovered 49) — Staging과 완전 일치. `/my/clinics`가 목업 대신 실 HIRA 데이터를 노출한다(공개 anon 경로 검증: 1,868건 노출, `SampleDataBadge` 해제 조건 충족).
- **원인**: 앞서 붙여넣기로 적용했다고 본 4개 파트가 **실제로는 커밋되지 않았음**(진단: 행 0건 · RLS 정책 정상). 각 파트가 단일 트랜잭션이라 중간 오류 시 전체 롤백되는 구조.
- **승인 범위**: 사람이 **이번 작업에 한해** Production DB 쓰기를 승인(병원 테이블 한정). `products`는 읽기·쓰기 모두 없음 — 이관 전후 공개 제품 수 191건 그대로 확인.
- **실행 방식**: 원시 `.sql` 실행은 DB 직접 접속 정보가 없어 불가 → 동일 데이터·동일 순서·동일 500행 배치·동일 `ON CONFLICT DO NOTHING` 규칙으로 REST INSERT. UPDATE/DELETE/DDL 없음, 재실행 안전.
- **1차 시도 실패**: `vercel env pull`이 민감 변수인 service_role을 placeholder로 내려줘 HTTP 401 → part 1에서 즉시 중단, **0행 기록**. 사람이 실 secret key를 `.env.local`에 제공한 뒤 재실행 성공.
- **Vercel 환경변수는 정상이며 수정 불필요** — placeholder는 pull 시 마스킹일 뿐, Production 런타임 키는 유효함(§26 근거).
- next_task: (선택) 로그인 계정으로 `/my/clinics` 화면 육안 확인 · `.env.local`의 임시 `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` 삭제

## 2026-07-26 병원 데이터 Production 반영 검증 — 아직 0건 노출 (위 항목으로 해소)

- **보고된 작업**: 사람이 `data/production-import/2026-07-26-hospitals-to-production.part{1..4}of4.sql` 4개 파트를 Production SQL Editor에 전부 적용.
- **실검증 결과(읽기 전용)**: Production `/my/clinics`의 실제 쿼리를 방문자와 동일한 공개 anon 경로로 재현 → **0건**. 목업 4건 fallback + `SampleDataBadge` 상태 유지(안전한 실패, 가짜 실데이터 노출 없음).
- **대조군**: 동일 쿼리를 Staging에 실행 → **1,868건 정상 반환**. 따라서 페이지 코드·쿼리·RLS 정책 정의는 문제 없고, 차이는 Production 쪽 상태에만 있음.
- **원인 후보 2가지**(anon 권한만으로는 구분 불가): (1) 4개 파트가 실제로 커밋되지 않음(각 파트가 단일 트랜잭션), (2) 행은 있으나 Production에 RLS 정책이 없어 anon 전량 차단.
- **대기 중**: 사람이 Production SQL Editor에서 `DASHBOARD.md` §26의 진단 SQL(SELECT 전용) 실행 → 결과 공유하면 원인 확정. Production DB는 이번 세션에서 쓰기 없음.
- **제품 카탈로그 대조(읽기 전용, INSERT 없음)**: Staging 공개 27건 중 Production에 slug 없는 것 **21건**, 그중 5건은 다른 slug로 이미 존재 → **실제 없는 것 16건**. Production 공개 카탈로그가 오히려 더 큼(191건, 그중 185건은 Staging에 없음). 두 카탈로그는 slug 규칙이 달라 **slug 기준 INSERT는 중복을 만든다**.
- **결정(사람)**: 제품 이관은 **하지 않는다** — Production 191건으로 충분하고 slug 규칙 차이로 인한 중복 리스크가 큼. 이 항목 종결.
- next_task: 진단 SQL 결과 확인 → 원인별 조치(파트 재적용 또는 RLS 정책 적용) → `/my/clinics` 재검증

## 2026-07-26 🚀 Production 출시 (9단계 로드맵 완주)

- **라이브**: `https://www.kbeautymatch.com` — main 병합 + Vercel Production 배포 완료(커밋 `9f293da`, readyState=Ready).
- **§23 전체 사용자 흐름 Production 실검증 통과**: `/api/health` green(Production Supabase rhfr 정상), 핵심 경로(`/`, `/quiz`, `/analyze`, `/results`, `/ingredients`, `/routine`) 전부 200, 홈·퀴즈·결과 실렌더 확인. 신규 `/api/track/click` POST 성공(`commercial_click_events` 테이블+INSERT 동작), `/my/clinics` 로그인 게이트 정상.
- **Production DB**: 마이그레이션 2개(`dermatology_institution_candidates`, `commercial_click_events`) 사람이 직접 적용·존재 확인. GRANT-only 5개는 런타임 불필요라 미적용.
- **이메일**: Production 실발송 차단 유지(환경변수 부재 + 코드 하드 차단). 실사용자 발송 없음.
- **배포 중 수정**: Vercel Preview 13h+ 연속 실패 원인(`​.vercelignore`가 빌드 import 픽스처 삭제) 발견·수정(`92192f8`). GitHub CI는 통과했으나 Vercel만 실패했던 케이스.
- **롤백 준비**: 코드 태그 `pre-deploy-backup-main-20260726-003804` + DB `DROP TABLE` 2줄. 문제 없어 미실행.
- next_task: (선택) 실 스케줄러 설치, 이메일 실사용자 롤아웃(도메인 인증 후), 병원 데이터 Production 적재, 보류 4개 기능(AI 코치/소진 예상/번역 관리/정산).

## 2026-07-25 오토파일럿 — 로드맵 3/6/7단계 실데이터 배선

## 2026-07-25 오토파일럿 — 로드맵 3/6/7단계 실데이터 파이프라인 배선

- 목적: "가로로 넓게" 스캐폴드가 끝난 뒤, 로드맵 9단계 중 미완료 구간을 낮은 단계부터 실제로 채우는 세션. main 병합·Production 배포·실 이메일 발송 3가지만 제외하고 Staging DB 쓰기/커밋/push 전부 진행.
- **3단계(제품)**: discovery 검수 대기 234건 중 `auto_approve_candidate` 68건(8브랜드)을 실제 재크롤 → draft product 40건 생성(성분/오퍼 실데이터 연결) 성공. **활성화(`active=true`)는 0건** — Staging `ingredients` 사전이 너무 빈약해 실 INCI 매칭률이 낮아 품질 게이트 통과 못함(게이트 자체는 손대지 않음). 사전 보강이 다음 선행 과제로 확인됨.
- **6단계(피부과)**: HIRA 실 후보 1,917건을 저장할 Supabase 테이블이 지금까지 아예 없었음을 확인 → `dermatology_institution_candidates` 신규 설계·migration 작성, `/my/clinics` 실데이터 조회 배선까지 완료. migration 자체는 이 세션 환경(IPv6 전용 host + access token 없음)에서 적용 불가 — Dashboard SQL Editor 사람 실행 대기.
- **7단계(수익화)**: 기존에 설계돼 있던 클릭/전환 이벤트 검증·스크러빙 순수 함수를 실제 `commercial_click_events` 테이블 + `/api/track/click` 라우트로 배선 완료. 같은 이유로 migration 적용은 대기.
- 공통 차단 요인: 두 신규 migration + `pipeline_batches` 테이블 GRANT, 총 3가지가 전부 "Supabase Dashboard SQL Editor 접근 권한이 있는 사람"만 실행 가능한 1회성 작업으로 확인됨(코드는 전부 준비 완료). 8단계 실 스케줄러 설치 스크립트(`install-pipeline-task.ps1`)도 기존에 준비돼 있었으나 "에이전트가 자동 실행 금지"로 명시돼 있어 설치는 사람 몫으로 남김.
- 상세: `DASHBOARD.md` §10~§12, §4, §5 참고.
- next_task: Dashboard SQL 2건 + GRANT 1건 적용 → `ingredients` 사전 보강 우선순위 결정 → (선택) 실 스케줄러 설치 → 8/9단계 계속

## 2026-07-25 스캐폴드 모드 — 전체 사용자 여정 클릭 연결 + 통합 검증 1차

- 목적: 완료 기준 12가지(EXECUTION_CONTRACT.md §7)를 일부러 미적용하고, 접속→국가/언어/통화→문진→사진분석→추천→루틴→구매처→저장→체크인→피부과→상담리포트 11단계를 샘플 데이터로 전부 클릭 연결.
- 화면: 신규 6개(`/routine/purchase`, `/routine/save`, `/my/clinics`, `/my/consultation-report`, `/quiz/body` + `/onboarding` 언어·통화 보강), 기존 5개 재사용.
- 하위 기능 6개: 사용 영상 placeholder, 광고/제휴 뱃지(기본 off, 명시적 disclosure), 클릭 추적 stub, 마지막 확인일 표시, 알림·상담정보 전달 동의 체크박스.
- 마스터플랜 전수 점검(섹션 2~21, 26, 41) 후 갭 2건 실제 처리: `/quiz/body`(전신 부위 문진), `/results` 제품별 "추천하지 않는 제품" 노출(`filterCandidatesBySafety` 확장). 나머지 5건(AI 코치·프로필 완성도·제품 소진 예상·관리자 번역 관리·수익 정산)은 로드맵 후반으로 보류.
- 통합 검증 1차: 모바일 375px 6화면 이상 없음, 의료 단정 표현 1건 수정, 광고/제휴 고지 문구 명확화.
- 실데이터: WQ-F espoir 브랜드 커넥터 버그 수정(한국형 `.do` URL 패턴 미인식) → 실 제품 10건 Staging 등록. HIRA 서울 피부과 실 수집 1,917/4,967건(로컬만, 미게시).
- 로그인 게이트 e2e: `/my/check-ins`·`/my/clinics`·`/my/consultation-report`·`/admin/discovery` 4/4 실 로그인 기반 렌더링 확인 통과 (`test:scaffold-journey-e2e`).
- 최종 회귀: 전체 `tsc`·`eslint`·`build` 통과. 기존 test suite 107건 중 104 통과, 3건(`checkin-email-provider`/`resend`/`test-api`) 실패는 로컬 `.env.local`에 `SITE_URL` 미설정 때문(오늘 변경과 무관, pre-existing 환경 갭 — 코드 수정 안 함).
- 상세: `DASHBOARD.md` 참고. Staging/Production DB 쓰기 없음(제품·병원 후보 upsert만, 게시 아님) · main 병합·Production 배포 없음.
- next_task: 사람이 우선순위 지정 대기 (마스터플랜 보류 5건 또는 discovery 검수 등)

## 2026-07-24 P3-T05 · Integrated Staging import package

- 계약: `src/lib/onboarding/stagingImportPackage/*` (제품·병원 후보 · provenance · review states · duplicates · rejection reasons · refresh status · commercial separation · publishable gates · 통합 사람 검수 패키지)
- Selftest/러너: `test:staging-import-package` · `check:staging-import-package` → `artifacts/staging-import-package/`
- 게이트: `stagingImportExecuted=false` · `stagingImportApprovalClaimed=false` · `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · fixture structural eligibility=0
- Docs: `docs/prelaunch/P3-T05_STAGING_IMPORT_PACKAGE.md`
- Tests: focused+integration 12건 · `check:release-security` · `build` · 변경 ESLint · `tsc` — **통과**
- 실 Staging import 승인·실행·공식 live·Production은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 · Staging import 승인 (`external_only`)

## 2026-07-24 P3-T04 · Affiliate and sponsored revenue readiness

- 계약: `src/lib/commercial/revenueReadiness/*` (affiliate offer ingestion · sponsored placement · disclosure · click/conversion events · country purchase links · expiry · admin approval · analytics privacy · Organic/전문 라우팅 독립)
- Selftest/러너: `test:revenue-readiness` · `check:revenue-readiness` → `artifacts/revenue-readiness/`
- 게이트: `commercialAgreementsActivated=false` · `publishAllowed=false` · `publicVisible=false` · `inventedCommissionRates=false` · `inventedLiveUrls=false` · `databaseTouched=false` · `writeAttempted=false` · `paidApiUsed=false`
- Docs: `docs/prelaunch/P3-T04_REVENUE_READINESS.md`
- Tests: `test:revenue-readiness` · `check:revenue-readiness` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실제휴 URL·수수료율·수익 채널 활성화는 **미검증** (`external_only` · EX-12)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T03 · Automated refresh and exception operations

- 계약: `src/lib/ops/automatedRefresh/*` (제품·병원 통합 due queue · stale · retry/backoff · resume checkpoint · source-change diff · exception 우선순위 · audit · admin review manifest · 스케줄러 준비 명령)
- Selftest/러너: `test:automated-refresh-ops` · `check:automated-refresh-ops` · `refresh:product-daily` · `refresh:clinic-twice-weekly` → `artifacts/automated-refresh-ops/`
- 게이트: `publishAllowed=false` · `autoPublishAttempted=false` · `destructiveUpdateAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · `externalScheduleCreated=false` · `paidApiUsed=false`
- Docs: `docs/prelaunch/P3-T03_AUTOMATED_REFRESH_OPS.md`
- Tests: `test:automated-refresh-ops` · `check:automated-refresh-ops` · `refresh:product-daily` · `refresh:clinic-twice-weekly` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 live 소스 갱신·운영자 스케줄 등록·DB 반영은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T02 · Verified product pool and category expansion

- 계약: `src/lib/catalog/verifiedProductPool/*` (skincare·makeup·hair/scalp·body·lip/eye · 카테고리 정규화 · 안전 적격 · 중복 병합 · 추천 준비 · 거절 사유 · 공개 Top 5 4기둥 게이트 · 기계 판독 audit)
- Selftest/러너: `test:verified-product-pool` · `check:verified-product-pool` → `artifacts/verified-product-pool/`
- 게이트: 출처·전성분·이미지 권리·구매 offer 미검증 시 공개 Top 5 진입 불가 · fixture/dry-run `publicTop5=[]`
- `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/P3-T02_VERIFIED_PRODUCT_POOL.md`
- Tests: `test:verified-product-pool` · `check:verified-product-pool` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 live verified SKU·공개 Top 5 게시는 **미검증** (`external_only` · EX-11)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`)

## 2026-07-24 P3-T01 · Official Korean product source onboarding

- 계약: `src/lib/onboarding/officialKoreanProductSource/*` (브랜드 공식·공식 KR몰·공식 INCI · 이미지·variants·가격·재고·국가가용·사용가이드 · 필드 provenance · 재개 매니페스트 · deterministic dedupe · stale/refresh · review reasons · dry-run audit)
- Selftest/러너: `test:official-kr-product-source` · `check:official-kr-product-source` → `artifacts/official-kr-product-source/`
- 금지 강제: CAPTCHA/로그인/유료API/약관위험 자동화 · 미확인 필드 미발명 · fixture·미검증 비공개
- `publishAllowed=false` · `publicVisible=false` · `databaseTouched=false` · `writeAttempted=false` · `paidApiUsed=false` · Production 미터치
- Docs: `docs/prelaunch/P3-T01_OFFICIAL_KR_PRODUCT_SOURCE.md`
- Tests: `test:official-kr-product-source` · `check:official-kr-product-source` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 사이트 live 수집·사람 검수·Staging import·publishable은 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 live/사람 검수 (`external_only`) · 제품 live는 EX-11

## 2026-07-24 T07-05 · Admin dry run and publishable gate

- 계약: `src/lib/publicData/adminDryRunPublishableGate/*` (T07-02→T07-03→T07-04 오케스트레이션 · fixture/실패/스테일/충돌/근거부족 비공개 · 공식근거+관리자승인만 구조적 publishable · Organic·clinical fit 유료필드 독립 · JSON/CSV 감사 · 1회성 사람 작업)
- Selftest/러너: `test:admin-dry-run-publishable-gate` · `check:admin-dry-run-publishable-gate` → `artifacts/admin-dry-run-publishable-gate/`
- `publishAllowed=false` · `publicVisible=0` · `databaseTouched=false` · `writeAttempted=false` · `secretsPresent=false` · Production 미터치
- Docs: `docs/prelaunch/T07-05_ADMIN_DRY_RUN_PUBLISHABLE_GATE.md`
- Tests: `test:admin-dry-run-publishable-gate` · `check:admin-dry-run-publishable-gate` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 사이트 근거 검수·Staging import 승인·publishable 전환은 **미검증** (`external_only` · 1회성 사람 작업 문서화)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 실 live 수집·사람 검수·Staging import (`external_only`)

## 2026-07-24 T07-04 · Official-site symptom evidence review bundle

- 계약: `src/lib/publicData/symptomEvidenceReview/*` (여드름·주사/홍조·아토피·색소 · 매니페스트 전용 · URL/제목/발췌/확인일/검수상태/만료일/거절사유 · Organic↔유료 큐 분리 · 미검증 비게시 · CAPTCHA/로그인/크롤 금지)
- Selftest/러너: `test:symptom-evidence-review` · `check:symptom-evidence-review` → `artifacts/symptom-evidence-review/`
- `publishAllowed=false` · `crawlAttempted=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-04_SYMPTOM_EVIDENCE_REVIEW.md`
- Tests: `test:symptom-evidence-review` · `check:symptom-evidence-review` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 공식 페이지 사람 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 T07-03 · Institution detail enrichment + specialist evidence

- 계약: `src/lib/publicData/institutionDetailEnrichment/*` (공식 기관상세 진료과목·전문의 수 · evidence strength · lastVerified · conflicting-source · retryable failure · manual-review · 피부과 근거↔증상 전문 주장 분리 · bounded concurrency · cache/checkpoint · dry-run audit)
- T07-01 `PublicDataApiClient` 재사용 · 상호명만으로 피부과 추론 금지 · 미확인 값 null
- Selftest/러너: `test:institution-detail-enrichment` · `check:institution-detail-enrichment` → `artifacts/institution-detail-enrichment/`
- `publishAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-03_INSTITUTION_DETAIL_ENRICHMENT.md`
- Tests: `test:institution-detail-enrichment` · `check:institution-detail-enrichment` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 HIRA live 보강·관리자 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 T07-02 · Seoul dermatology candidate ingestion

- 계약: `src/lib/publicData/seoulDermatologyIngestion/*` (HIRA 공식 필드 · 서울/피부과 필터 · provenance · pagination checkpoint · deterministic dedupe · stale/refresh · dry-run audit)
- T07-01 `PublicDataApiClient` 재사용 · API 키 URL/아티팩트 미포함
- Selftest/러너: `test:seoul-dermatology-ingestion` · `check:seoul-dermatology-ingestion` → `artifacts/seoul-dermatology-ingestion/`
- 필터: `sidoCd=110000` · `dgsbjtCd=14`/`dgsbjtCdNm=피부과` · 상호명 키워드 단독 거절
- `publishAllowed=false` · `databaseTouched=false` · `writeAttempted=false` · Production 미터치
- Docs: `docs/prelaunch/T07-02_SEOUL_DERMATOLOGY_INGESTION.md`
- Tests: `test:seoul-dermatology-ingestion` · `check:seoul-dermatology-ingestion` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실 HIRA live 수집·관리자 검수·publishable 전환은 **미검증** (`external_only` · T07 잔여)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 검수·publishable (`external_only`)

## 2026-07-24 P2-T05 · Final Preview evidence and human approval package

- 계약: `src/lib/release/phase2FinalEvidencePackage.ts` (6버킷 · 자동명령 · 1회성 사람 검증 · 정직 플래그)
- Selftest/러너: `test:phase2-final-evidence` · `check:phase2-final-evidence` → `artifacts/phase2-final-evidence/`
- 버킷: 자동 테스트/라우트 · 스크린샷 육안 대기 · Android/iPhone · 외부 출처 · Dashboard 전용 · main/Production 게이트
- Docs: `docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md`
- 위장 금지: `visualApprovalClaimed=false` · `deviceApprovalClaimed=false` · `releaseReadyClaimed=false` · main/Production 미실행
- Tests: `test:phase2-final-evidence` · `check:phase2-final-evidence` (필수 8건 통과: preview-routes·staging-release-gate·admin-review-e2e·real-data-onboarding·final-integration·autopilot-queue·release-security·build) · 변경 ESLint · `tsc` — **통과**
- Preview 육안·실기기·Dashboard·공식 병원·WQG-P0-002 — **미검증** (`external_only`/`dashboard_only_unknown`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T04 · Real data onboarding readiness

- 계약: `src/lib/onboarding/realDataOnboarding/*` (출처 매니페스트·필드 provenance·공식 우선순위·stale/refresh·검수 체크리스트·import 템플릿·dry-run 검증·거절 사유 · KR 제품·병원/전문가)
- Selftest: `scripts/real-data-onboarding-selftest.ts` · 명령 `npm run test:real-data-onboarding`
- 비공개 fixture · dry-run 공식 예시만 스테이징 검수 적격 · 마켓 단독/유료 API/CAPTCHA/발명 가격 거절 · `writeAttempted=false` · `publicVisible=false`
- Docs: `docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md`
- Tests: `test:real-data-onboarding` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 실공식 KR 제품·실병원 publishable·Staging/Production 쓰기는 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T03 · Admin review end-to-end verification

- 계약: `src/lib/admin/adminReviewE2E.ts` (제품·병원/전문가 레인 · candidate→evidence→duplicate→needs_review→admin_reviewed→publishable · 공개성 · Organic 독립)
- Selftest: `scripts/admin-review-e2e-selftest.ts` · 명령 `npm run test:admin-review-e2e`
- fixture·미승인 비공개 · dry-run 공식 병원만 publishable 평가 · 유료 관계가 Organic 순위 불변 · `writeAttempted=false`
- Docs: `docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md`
- Tests: `test:admin-review-e2e` · `test:usage-media-admin-ops` · `test:clinic-stage6` · `test:commercial-separation` · `test:organic-commerce` · 변경 ESLint · `tsc` — **통과**
- Preview 관리자 로그인 육안·공식 병원 실출처는 **미검증** (`external_only`)
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T02 · Staging read-only release gates

- 계약: `src/lib/release/stagingReleaseGate.ts` (환경 식별·헬스·테이블/계약·auth callback·Storage·게시 상태·migration · factKind 분리)
- 러너: `scripts/run-staging-release-gate.ts` · selftest `scripts/staging-release-gate-selftest.ts`
- 명령: `npm run test:staging-release-gate` · `npm run check:staging-release-gate` (`--mode=static|readonly`)
- 기본 static 읽기 전용 · Production 식별 시 중단 · `writeAttempted=false` · 비밀/전체 ref 미출력
- Dashboard 전용(Redirect URL·care-photos 실버킷·migration 적용 이력·published 집계)은 `dashboard_only_unknown` — 위장 없음
- Docs: `docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md`
- Tests: `test:staging-release-gate` · `check:staging-release-gate` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-24 P2-T01 · Automated Preview and route validation

- 계약: `src/lib/validation/previewRouteValidation.ts` (공개·analyze/results/routine·profile/guidance·admin review·auth API · viewport 320/390/768/1440 · loading/empty/error 마커)
- 러너: `scripts/run-preview-route-validation.ts` · selftest `scripts/preview-route-validation-selftest.ts`
- 명령: `npm run test:preview-routes` · `npm run check:preview-routes` (`--mode=http|browser` + `BASE_URL`/`PREVIEW_BASE_URL`/`--base-url`)
- 로컬 검증: static inventory 통과 · HTTP 통과 · browser 스크린샷 **40장**(10 routes × 4 viewports) · `visualApprovalClaimed=false`
- 아티팩트: `artifacts/preview-route-validation/` (gitignore) · 육안 승인 위장 없음
- 스모크 재사용: `test:smoke` 라우트 인벤토리 확장 · Preview SSO 우회 금지 · Playwright chromium
- Docs: `docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md` · Preview 체크리스트 갱신
- Tests: `test:preview-routes` · `check:preview-routes` · `test:smoke` · `test:autopilot-queue` · 변경 ESLint · `tsc` — **통과**
- 사람 Preview/실기기 육안·SSO 로그인은 **미검증** (`external_only`)
- Staging/Production DB·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-23 T06 · Final integration + release evidence

- 여정 연결 증거 계약: `src/lib/release/finalIntegrationEvidence.ts` · 문서 `docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md`
- empty/loading/error a11y: `ProductUsageGuide` · `PhotoAssetsSettingsPanel` (`role="status"` / `aria-busy`)
- 빌드 안전: `supabase/browser`·`server` empty public env placeholder (legacy와 동일 · 실키 없이 throw 방지)
- landmark 자동촬영 **기본 OFF** · 수동 3각도 유지 · Phase 3.1 deferred
- Tests: `test:final-integration` · `test:journey` · `test:master-execution` · `test:guided-capture` · `test:guided-landmark` · `test:photo-comparison` · `test:symptom-safety` · `test:commercial-separation` · `test:content-disclosure` · `test:autopilot-queue` · `check:release-security` · 변경 ESLint · `tsc` · `npm run build`(env 없음) — **통과**
- Preview 육안·실기기·P1-006 법무·공식 병원·WQG-P0-002 — **미검증** (`external_only`) · 위장 없음
- Staging/Production DB 쓰기·main·commit/push 미실행
- next_task: `T07` 공식 병원 실출처 (`external_only`)

## 2026-07-23 T05 · Usage media localization + admin operations

- 사용 가이드 메타: 도포량·순서·빈도·주의·패치 테스트·도포 영상 + 정직한 fallback 상태
- 국가·언어별 offer 표시: 재고·가격·판매처 **미발명** · 미확인 지역 빈 상태 · 미검증 URL CTA 제외
- 관리자 운영: 후보 검수 · 중복 병합 · 근거 검토 · 상태 전환 · 만료 갱신 큐 · 재시도 · 감사 기록 · local/Staging dry-run (in-memory)
- UI: `ProductUsageGuide` 패치 테스트·fallback 고지 · Admin `/admin/catalog/ops` · API `/api/admin/catalog-ops`
- Docs: `docs/usage-media-localization-admin-ops.md`
- Tests: `test:usage-media-admin-ops` · `test:usage-media` · 변경 ESLint · tsc — **통과**
- Staging/Production DB 쓰기·실 offer 재고·main·commit/push 미실행
- next_task: `T06` Final integration (완료됨 → 위 T06 항목)

## 2026-07-23 T04 · Organic commerce + professional routing

- Organic/Affiliate/Sponsored: 제휴 링크 구조 · Organic 전용 랭킹 · 광고 슬롯 · in-memory 지속화 · API · UI 라벨 · 애널리틱스 · `/admin/commerce`
- 유료 관계 필드가 Organic score/순위를 바꾸지 않음 · 건강·증상 프로필 광고 타기팅 거부
- 증상 기반 전문가 번들: 라우팅 · 일반 vs 제휴 병원 분리 · fixture 게시 차단 · guidance 연결 · `/api/care/professional-guidance`
- Docs: `docs/organic-commerce-professional-routing.md`
- Tests: `test:organic-commerce` · `test:commercial-separation` · `test:clinic-stage6` · `test:symptom-safety` · `test:care-guidance` · 변경 ESLint · tsc — **통과**
- 공식 병원 실출처·실제휴 URL 게시·Production 쓰기·main·commit/push 미실행
- next_task: `T05` Usage media localization (완료됨 → 위 T05 항목)

## 2026-07-23 T03 · Product automation · category expansion

- Ingestion 계약 18단계 · 공식출처 evidence · 정규화 · variants · images · INCI · offers · usage media 메타
- dedupe · field verification · eligibility · review status · refresh/resume checkpoint · Staging/admin 링크(쓰기 없음)
- 마스카라·립·샴푸/두피 카테고리 추출기 + 안전 추천 플로우(급성 눈/두피 신호 시 추천 중단)
- Fixtures/dry-run만 · `recommendation_ready=0` (live official 미검증) · `autoPromote=false`
- Docs: `docs/catalog-product-automation.md`
- Tests: `test:product-automation` · `test:full-beauty` · `test:master-execution` · 변경 ESLint · tsc — **통과**
- 실공식 출처·verified 구매 SKU·Staging/Production 쓰기·main·commit/push 미실행
- next_task: `T04` Organic commerce + professional routing (완료됨 → 위 T04 항목)

## 2026-07-23 T02 · 3/7/15/30 follow-up lifecycle

- Opt-in → 3/7/15/30 스케줄 → due → 체크인 → progress/adherence/irritation 결정 → 루틴 조정 → red-flag 에스컬레이션 → pause/resume
- 채널 배송 인터페이스: in_app / email / sms / push · dry-run·disabled·live_blocked 어댑터 · 상태 레코드 (`realDeliveryClaimed=false`)
- Persistence: 로컬 직렬화·재개 · 손상/누락 시 empty fallback
- 설정 UI SMS/푸시 동의 (실발송 미연결 고지) · 관리자 `/admin/care/follow-up` + API
- Tests: `test:follow-up-lifecycle` · `test:checkin-policy` · `test:checkin-scheduling` · `test:reminder-delivery` · 변경 ESLint · tsc — **통과**
- 실 email/SMS/push 발송·Production·main·commit/push 미실행
- next_task: `T03` product automation (완료됨 → 위 T03 항목)

## 2026-07-23 T01 Core journey · durable BeautyProfile

- 안전 파싱(`parseBeautyProfile`) · 프로필 병합 · 확인값 패치 sanitize
- 체크인 완료 시 추론 관찰값(자극·악화·중단·급성 신호)을 BeautyProfile에 누적
- 빈 목록이 `user_confirmed`로 고정되어 이후 추론 갱신을 막던 merge 버그 수정
- 서버 경계: `GET/PUT /api/care/beauty-profile` (로그인·검증·migrationPending 로컬 fallback)
- DRAFT migration: `supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql` (**미적용**)
- `/my/profile` 로컬+서버 병합 UI · Tests: `test:beauty-profile` · `test:master-execution` · `test:journey` · 변경 ESLint · tsc
- Staging/Production DB 미적용 · main 미병합 · commit/push 미실행
- next_task: `T02` follow-up lifecycle (완료됨)

## 2026-07-23 T00 Master audit — Autopilot 계약·실행 큐

- `KBEAUTY_MASTER_EXECUTION_PROMPT.md` 1회 정독 · 상태/로드맵/changelog/최근 커밋·핵심 경로 대조
- 신설: `docs/autopilot/EXECUTION_CONTRACT.md` · `docs/autopilot/MASTER_EXECUTION_QUEUE.md`
- 레거시 `docs/MASTER_EXECUTION_QUEUE.md` → autopilot canonical 포인터
- 분류: verified_complete / partial / external_only / remaining / deferred
- ROADMAP 사진 비교 체크박스 모순 수리 (코드 완료 vs Staging/Storage 대기 분리)
- Self-test: `npm run test:autopilot-queue`
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 2026-07-23 Stage 6 기반 + Preview 원격 검수 JSON

- 증상 기반 병원 후보 수집 어댑터·필드 검증·게시 게이트·언어/예산 필터 구현
- `/my/guidance`에 Organic/제휴 분리 병원 안내 + 상담 리드 최소동의 dry-run 연결
- 관리자 `/admin/clinics` 검수 화면 (fixture 게시 불가 · Production 쓰기 없음)
- Preview 원격 검수 JSON: 공개 artifact 라우트 + `VERCEL_URL` 자동 경로 + 로컬 fixture
- Tests: `test:clinic-stage6` · `test:clinic-referral` · `test:unified-review-remote` · 관련 ESLint/TS
- 공식 병원 실데이터·실발송 리드·Preview 육안·Production 미검증
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 2026-07-23 Master Execution 번들 (연속 구현)

- `docs/MASTER_EXECUTION_QUEUE.md`(현 canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md`)에 전체 요구사항 실행 큐를 기록하고 Q01–Q15·Q19–Q21을 완료 처리했다.
- BeautyProfile 조회·편집 UI `/my/profile` 추가. 확인값 우선 저장, 동의·비진단 문구 포함.
- 도메인 문진(마스카라·립·베이스·헤어) 완료 시 Care local BeautyProfile에 누적.
- `symptomSafety` ↔ `professionalRouting` 연결: 급성/전문가 분기 시 `professionalRoutes`를 추천·가이드에 전달하고 제품 추천 중단을 명시.
- 공통 제품·taxonomy·마스카라/립/샴푸 랭커·Organic 분리·3/7/15/30 체크인·자동화 파이프라인은 기존 미커밋 기반을 유지·회귀 검증.
- Tests: `test:master-execution` · `test:symptom-safety` · `test:care-guidance` · `test:full-beauty` · `test:journey` · `test:commercial-separation` · `test:checkin-scheduling` · 변경 ESLint · production build(Staging public env) — **통과**
- Preview·실기기·공식 병원/offer 실데이터·Production AI_PROVIDER는 미검증 (`blocked_external`)
- Phase 3.1 랜드마크 자동촬영은 deferred · flag OFF
- main 미병합 · Production 미배포 · DB/Storage/환경변수 미변경 · commit/push 미실행

## 현재 기준

- 최상위 계획: K-Beauty Match Master Plan **v4.2**
- GitHub 저장소: `akscnl6521/kbeauty-platform`
- 기준 브랜치: `main`
- 작업 브랜치: `feature/recommendation-usage-guide-display-20260720`
- 최근 main 병합: PR #29~#32 (영상 권리 검수 큐·통합 매니페스트·루틴 사용 가이드 연결)
- Production 배포: 이번 작업에서 미실행
- Production DB·환경변수 변경: 이번 작업에서 미실행

## 현재 완료된 핵심 기능

- 피부 고민·증상·부위 관찰 입력
- 위험 신호와 전문가 상담 우선 분기 (`professionalRoutes` 포함)
- 제품 추천 안전 필터와 Top 5 게이트
- **추천 자격(recommendation_ready)과 구매 가능(commerce) 분리** (Phase 2.5~2.6.2)
- **Phase 3.0 안내형 얼굴 촬영 MVP + AI 분석 대기 UX** (기본 UX)
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- **3/7/15/30 follow-up lifecycle** (opt-in·due·결정·루틴조정·red-flag·resume/fallback·채널 dry-run · 실발송 미연결)
- 장기 BeautyProfile 저장·조회·편집 (`/my/profile`) · 체크인 반영 · 서버 API 경계(DRAFT 미적용 시 로컬 fallback)
- 마스카라·립·샴푸 속성 추천 + **T03 자동화 파이프라인·안전 추천 dry-run** (실구매 verified SKU 부족 시 속성/픽스처 예시만)
- 체크인 이메일 dry-run / Resend adapter 코드 준비 (실발송 없음)
- Preview Care admin · 체크인 이메일 테스트 UI 육안 통과
- 체크인 이메일 큐 Schema A Staging 적용·검증 완료 (Production 미적용)
- 사진 비교 동의·저장·삭제 흐름 코드·테스트 완료 (WQ-B · DRAFT migration 미적용 · care-photos 미생성)
- 시나리오 파일럿 Phase 2~2.6.2 종료
- 재방문 대시보드 · 체크인 스케줄 · Care worker dry-run (WQ-C/D/E)
- 관리자 제품·성분·검증·카탈로그·사용 가이드·disclosure
- **Stage 6 기반**: 병원 후보 어댑터·검증 게이트·안내 UI·상담 리드 dry-run·관리자 검수 (실병원 게시 데이터 없음)
- **T03 제품 자동화**: ingestion 계약·카테고리 확장 fixture dry-run · admin review 링크 (Staging 쓰기 없음)
- **T04 Organic commerce**: 제휴 링크 구조·Organic 분리 랭킹·광고 슬롯·이벤트·UI 라벨·`/admin/commerce` · 전문가 라우팅 번들 (실제휴·실병원 게시 제외)
- **T05 사용 가이드 현지화·운영**: 패치 테스트·영상 fallback · 국가/언어 offer(미발명) · admin ops dry-run (`/admin/catalog/ops`)
- **T06 최종 통합·릴리스 증거**: 여정 연결 계약 · empty/loading a11y · supabase build placeholder · 로컬 자동검증·production build 통과 · Preview/실기기는 external_only
- **P2-T01 Preview/라우트 자동 검증**: 계약·HTTP/브라우저 러너·스크린샷·JSON · 육안 승인 미주장
- **P2-T02 Staging 읽기 전용 릴리스 게이트**: 환경 식별·헬스·계약·auth·Storage·게시·migration · Dashboard 미확인 분리
- **P2-T03 Admin review E2E**: 제품·병원 레인 · fixture 비공개 · Organic 독립 · dry-run
- **P2-T04 실데이터 온보딩 준비**: 출처 매니페스트·provenance·공식 우선·stale·체크리스트·템플릿·dry-run·거절 사유 · 비공개 fixture
- **P2-T05 Final Preview 증거 패키지**: Phase 2 자동 회귀 · 6버킷 분리 · 1회성 사람 검증 절차 · 육안/실기기/Dashboard/Production 위장 없음
- **P3-T01 공식 한국 제품 출처 온보딩**: 브랜드/공식몰/INCI · 이미지·variants·가격·재고·국가·사용가이드 · provenance · 재개·dedupe·stale · fixture dry-run · 비공개

## 자동화 안전 상태

- 자동 게시 금지 · Production 쓰기 금지
- Organic과 광고·제휴 점수 분리
- 광고 슬롯·스폰서 카드는 Organic 레인 밖 · 건강정보 타기팅 금지
- anon `product_offers` write 권한 0
- Phase 3.x 사진은 브라우저 임시 object URL만 · Storage 영구 저장 없음 · 랜드마크 좌표 미저장
- 병원 fixture는 `fixtureOnly` · 사용자 publishable 목록 비움
- 제품 자동화 fixture는 `liveVerified=false` · `recommendation_ready` 미부여
- 제휴 링크·상업 이벤트는 in-memory · Production DB 미기록

## 현재 진행 단계

**Stage 6 코드 기반 완료** — 공식 병원 실데이터·사람 검수·외부 차단 항목 잔여.

- WQ-G 문서: `docs/prelaunch/WQ-G_PRELAUNCH_GATE.md`
- 실행 큐: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (계약: `docs/autopilot/EXECUTION_CONTRACT.md`)
- Stage 6 문서: `docs/clinic-stage6-referral.md`
- **출시 가능으로 보지 않음**
  - **WQG-P0-002** = `RELEASE_GATE_PENDING`
  - 잔여: P0-003 · P1-003/005/006 Preview·실기기·정책 검수
- 기본 촬영 UX = Phase 3.0 수동 3각도 · Phase 3.1 = **deferred**
- main 미병합 · Production 미배포 · DB 미변경

## Phase 3.0 — 안내형 촬영 (현재 기본)

- 카메라/문진만 · 정면→좌45→우45 · 로컬 품질 · 분석 대기 UX
- 3.0.1 stream 유지 · 3.0.2 갤러리 금지
- 문서: `docs/analyze/PHASE30_GUIDED_CAMERA_CAPTURE.md`

## Phase 3.1 — 보류 요약

- 문서: `docs/analyze/PHASE31_FACE_LANDMARK_AUTO_CAPTURE.md`
- flag=1로만 진입 · 기본 사용자 경로에 자동 오류/디버그 미노출

## 다음 작업

Canonical: `docs/autopilot/MASTER_EXECUTION_QUEUE.md` (`next_task` T07)

1. 공식 병원 후보 실출처 승인 후 dry-run→검수→publishable 전환 (가짜 게시 금지)
2. P0-003 / P1-003·005 Preview·실기기 육안 — **P2-T05 1회성 절차** 문서화됨 (대시보드 아님 · 사람 검수)
3. P1-006 개인정보 전송 범위 문구의 정책·법무 최종 검수
4. **WQG-P0-002** — `RELEASE_GATE_PENDING` (Production 배포 직전 최종 확인 · 지금 미실행)
5. Phase 3.1 자동 정렬은 **보류** 유지
6. (승인 대기) 사진 비교 Staging migration · `care-photos`
7. (승인 대기) BeautyProfile Staging migration · `beauty_profiles`
8. (승인 후) 권장 커밋 분할·feature push
9. (외부) 제품 자동화 live 공식 출처·verified 구매 SKU 검수
10. (외부) 실제 제휴 URL·수익 채널 연결

## 승인 경계

- Production 배포 / DB / 환경변수 · main 병합 · care-photos/migration 적용은 명시 승인 전 금지
