# 29. 한국 제품·판매처 데이터 입력 가이드 (1단계)

## 목적

한국에서 **실제로 판매 중**인 제품과 판매처(offer)를 관리자가 검증·입력할 수 있는 형식을 정의한다.  
이번 단계에서는 **가짜 상품·임의 가격을 만들지 않는다.** 입력 템플릿과 품질 점검 도구만 제공한다.

## 원칙

1. 제품(Product)과 판매처(Offer)를 분리한다.
2. 브랜드명은 번역하지 않고 `canonicalBrandName`(공식 표기)만 쓴다.
3. 제품명(`productNameKo` / `productNameEn`)과 브랜드명을 섞지 않는다.
4. `sample` / `unverified` 행은 핵심 추천 Top N에 넣지 않는다.
5. `verified` offer는 실측 가격·실 URL·검증 일시만 허용한다.
6. 추천 점수·알레르기 필터·기존 Supabase 연결 설정은 변경하지 않는다.

## 파일 위치

| 파일 | 용도 |
|------|------|
| `data/templates/korean-products-template.csv` | 제품 CSV 템플릿 |
| `data/templates/korean-product-offers-template.csv` | Offer CSV 템플릿 |
| `data/templates/korean-products.sample.json` | 제품 JSON 샘플 (비실데이터) |
| `data/templates/korean-product-offers.sample.json` | Offer JSON 샘플 (비실데이터) |
| `src/lib/recommend/validateCatalogData.ts` | 검증 |
| `src/lib/recommend/findDuplicateProducts.ts` | 중복 점검 |
| `src/lib/recommend/catalogTypes.ts` | `KoreanProductInput` / `KoreanProductOfferInput` |

## Product 필수 필드

| 필드 | 설명 | 비고 |
|------|------|------|
| `productId` | 고유 ID | UUID 또는 안정적 텍스트 ID |
| `canonicalBrandName` | 공식 브랜드명 | 예: `Beauty of Joseon` (직역 금지) |
| `productNameKo` | 한국어 제품명 | 브랜드명 제외 |
| `productNameEn` | 영어 제품명 | 브랜드명 제외 |
| `category` | 카테고리 | serum, cream, cleanser 등 |
| `skinTypes` | 피부 타입 | CSV: `sensitive\|dry` |
| `concerns` | 고민 | CSV: `redness\|dryness` |
| `keyIngredients` | 주요 성분 | 파이프 구분 |
| `fullIngredients` | 전성분 | 파이프 구분, 없으면 비움 |
| `fragranceFree` | 무향 여부 | true/false/빈칸 |
| `alcoholFree` | 무알코올 여부 | true/false/빈칸 |
| `productStatus` | `active` / `draft` / `sample` / `discontinued` | 테스트는 `sample` |
| `dataConfidence` | `high` / `medium` / `low` / `unverified` | 테스트는 `unverified` |
| `verifiedAt` | 제품 메타 검증 시각 | ISO8601, active+high 시 필수 |
| `sourceUrl` | 출처 URL | **https** 필수 |

## ProductOffer 필수 필드

| 필드 | 설명 | 비고 |
|------|------|------|
| `offerId` | Offer 고유 ID | |
| `productId` | 제품 ID | 제품 행과 반드시 연결 |
| `retailerName` | 판매처명 | 예: Olive Young (실명만) |
| `retailerType` | `official` / `marketplace` / `drugstore` / `department` / `other` | |
| `retailerCountry` | 판매국 | 한국 1단계: `KR` |
| `shipsToCountries` | 배송국 | CSV: `KR` 또는 `KR\|JP` |
| `purchaseUrl` | 구매 URL | **https** 만 |
| `price` | 가격 | verified 시 > 0, 임의 값 금지 |
| `currency` | 통화 | KR은 `KRW` |
| `stockStatus` | `in_stock` / `out_of_stock` / `unknown` | |
| `verificationStatus` | `verified` / `unverified` / `invalid` / `unavailable` | |
| `isOfficial` | 공식몰 여부 | |
| `verifiedAt` | 검증 시각 | verified 시 필수 |
| `lastCheckedAt` | 최근 확인 | |
| `active` | 활성 | `false` 면 핵심 추천 제외 |

## 한국 verified offer (핵심 추천) 조건

아래를 **모두** 만족해야 한다 (`meetsKoreanVerifiedOfferRules` / `isOfferEligibleForCoreRecommendation(..., "KR")`).

- `retailerCountry === "KR"`
- `shipsToCountries`에 `"KR"` 포함
- `currency === "KRW"`
- `price > 0`
- `stockStatus === "in_stock"`
- `verificationStatus === "verified"`
- `purchaseUrl`이 https
- `verifiedAt` 존재
- `active !== false`

추가로 제품이 `sample` / `draft` / `dataConfidence=unverified` 이면, offer를 `verified`로 올리면 **검증 오류**로 막는다.

## 검증 항목 (도구가 검출)

- `productId` / `offerId` 중복
- 동일 `canonicalBrandName` + 제품명 중복
- productId 없는(고아) offer
- KR이 아닌 `retailerCountry` (1단계에서 warning)
- KRW가 아닌 통화 (KR 판매처)
- 0 이하 가격
- http 또는 잘못된 URL
- `verifiedAt` 누락 (verified / active+high)
- 재고·verificationStatus 누락
- `canonicalBrandName` / `sourceUrl` 누락

## 입력 절차 (권장)

1. CSV 또는 JSON 템플릿을 복사한다.
2. **실측**한 제품·판매처만 채운다. 모르면 `sample` + `unverified`로 두고 가격·verified를 비운다.
3. 브랜드명은 `src/lib/brand/displayBrandName.ts` 레지스트리의 canonical과 맞춘다.
4. 코드에서 검증한다:

```ts
import {
  validateCatalogData,
  rowToKoreanProductInput,
  rowToKoreanProductOfferInput,
} from "@/lib/recommend";

const report = validateCatalogData(products, offers);
if (!report.ok) {
  console.error(report.issues.filter((i) => i.severity === "error"));
}
```

5. `report.ok === true` 이고, 핵심 추천에 넣을 행만 `productStatus=active`, `dataConfidence`≥medium, offer `verified`로 올린 뒤 Supabase에 반영한다.
6. DB 반영은 `products` + `product_offers` 마이그레이션 스키마를 따른다 (`docs/04_DB.md`).

## 금지

- 존재하지 않는 제품명·판매처·가격·링크 날조
- 브랜드명 기계번역 (복숭아 조각, 조선의 아름다움 등)
- sample 행을 `verified`로 올려 핵심 추천에 섞기
- 추천 점수·안전 필터·`.env` 수정으로 “데이터 채우기”

## DB 매핑 (참고)

| 입력 필드 | DB (대략) |
|-----------|-----------|
| `productId` | `products.id` |
| `canonicalBrandName` | `products.brand` |
| `productNameKo` / `productNameEn` | `name_ko` / `name` |
| offer 필드 | `product_offers.*` (`product_id`, `retailer_name`, …) |

`product_offers.active` 컬럼이 DB에 아직 없으면 입력 파일의 `active`는 앱 검증·향후 마이그레이션용으로 둔다.

## 다음 단계 (이번 범위 밖)

- 관리자 UI 업로드
- 실제품 대량 수집·검증 워크플로
- `product_offers.active` DB 컬럼 추가(필요 시)
