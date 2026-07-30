# docs/product-sourcing-policy.md — 제품 데이터 수집 표준 정책

최종 갱신: 2026-07-27
상위 기준: `MASTER_PLAN.md` §35 (인기 제품 우선순위와 공식사이트 크롤링), §17 (제품·성분 데이터 품질)

제품 정보를 어디서 가져오는지에 대한 **출처 사다리**를 정의한다.
어떤 순위로 확보했든 **공개 조건은 동일하다** — 기존 품질 게이트(전성분 매칭 ·
이미지 · verified offer)를 통과하지 못하면 게시되지 않는다. 이 문서는 게이트를
완화하지 않으며, 게이트 자체는 `src/lib/pipeline/product-verify/`가 소유한다.

---

## 1순위 · 2순위 — 브랜드 직판몰과 정식 리테일러

**`MASTER_PLAN.md` §35.4 «크롤링 출처 우선순위»를 그대로 따른다.**
여기에 다시 적지 않는다. 우선순위·robots·이용약관·요청량 규칙은 모두 §35.4와
`docs/20-data-source-verification.md`가 기준이다.

이 두 순위로 확보한 데이터만 **단독으로 `verified` 승격 후보**가 될 수 있다.

---

## 3순위 — 오픈 DB (candidate 전용)

Open Beauty Facts 등 공개 데이터베이스. 기존 기계장치는
`scripts/harvest-obf-inci-for-heroes.ts`(INCI 수집)다.

### 절대 규칙

**오픈 DB 단독으로는 어떤 경우에도 `verified`가 될 수 없다.**

오픈 DB는 누구나 편집할 수 있고 편집자·시점·원본 라벨을 보증하지 않는다.
따라서 §17의 «불명확한 출처를 전성분과 안전 정보의 최종 기준으로 사용하지
않는다»에 정면으로 걸린다.

| 항목 | 규칙 |
|---|---|
| 도달 가능 상태 | `discovered` → `needs_review` **까지만** |
| `verified` 승격 | ❌ 금지. 1·2순위 공식 출처가 같은 사실을 확인해 준 경우에만 가능 |
| 용도 | 후보 발견, 성분 후보 제시, 1·2순위 크롤의 **검색 힌트** |
| 추천 노출 | 불가 (`published` 아님) |
| 가격·재고 | **사용 금지.** 오픈 DB의 가격은 시점·국가가 불명확하다 |

### 사용 방법

오픈 DB에서 얻은 값은 **덮어쓰지 않고 후보로만 병기**한다. 이미 1·2순위로
확인된 필드가 있으면 그쪽이 항상 이긴다.

`source_type`은 아래 «저장 시 주의»를 따른다.

---

## 4순위 — 라벨 OCR

제품 실물 라벨 사진에서 전성분을 읽어내는 경로. **최후 수단**이다.

### 절대 규칙

| 항목 | 규칙 |
|---|---|
| 초기 상태 | **`needs_review` 고정.** 자동 승인 금지 |
| `source_type` | **`official_label`** (아래 «저장 시 주의» 참조) |
| 원본 보관 | OCR 원문과 라벨 이미지 출처를 함께 저장해 추적 가능해야 한다 |
| 사람 검수 | 필수. OCR 오독(`0`/`O`, `1`/`l`, 줄바꿈 분리)이 성분명을 바꾼다 |
| 단독 verified | ❌ 금지 |

### OCR 특유의 위험

- 전성분은 쉼표로 구분되는데 OCR이 줄바꿈을 쉼표로 오인하면 성분이 쪼개진다.
  `1,2-헥산다이올`·`N,N-`처럼 **화학명 내부 쉼표**는 §35.7 규칙을 그대로 적용한다.
- 라벨 사진의 국가·용량·리뉴얼 시점이 다르면 다른 제품 버전이다. §17의 제품
  버전 규칙에 따라 기존 전성분을 덮어쓰지 않고 새 버전으로 남긴다.
- 흐린 사진·반사·곡면 왜곡은 조용히 틀린 성분을 만든다. 신뢰도가 낮으면
  등록하지 않는 편이 낫다 — 없는 정보보다 **틀린 성분이 더 위험하다**.

---

## 저장 시 주의 — `source_type` 제약 (2026-07-27 확인)

`product_discovery_candidates.source_type`과 `data_sources.source_type`에는
DB CHECK 제약이 걸려 있다. 허용 값은 다음뿐이다.

```text
official_brand_page · official_label · official_retailer · medical_paper
clinical_guideline · admin_entry · search_result · affiliate_feed
brand_csv · other
```

따라서:

- **4순위 라벨 OCR → `official_label`을 쓴다.** `label_ocr`은 제약에 없어
  INSERT가 거부된다. 전용 값이 필요하면 migration으로 enum을 확장한 뒤
  (PROJECT_RULE §10: 파일 → PR → 승인 → `supabase db push`) 이 문서를 갱신한다.
- **3순위 오픈 DB → `other`를 쓴다.** 마찬가지로 전용 값은 아직 없다.
- 순위 구분이 `source_type`만으로는 안 되므로, 실제 출처 URL을 `source_url`에
  반드시 남기고 `notes`에 순위를 기록한다.

현재 DB의 실제 분포(2026-07-27): `brand_csv` 1161 · `official_brand_page` 181 ·
`official_retailer` 3. 3·4순위 유입 실적은 아직 없다.

---

## 순위와 무관하게 동일한 것

- 품질 게이트(전성분 매칭 · 이미지 · verified offer)를 통과해야 공개된다.
- 신규 제품은 자동으로 `active=true` / `verified`가 되지 않는다 (§35.6).
- 가짜 가격·재고·구매 링크를 만들지 않는다.
- 확인되지 않은 필드는 비워 둔다. 추측해서 채우지 않는다.
