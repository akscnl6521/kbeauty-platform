# docs/32-search-to-verified-erd.md — ERD & 데이터 흐름

최종 갱신: 2026-07-13  
상태: **설계 전용**  
상세 컬럼: `docs/31-search-to-verified-data-model.md`

---

## 1. Mermaid ERD (기존 + 신규)

```mermaid
erDiagram
  brands ||--o{ products : "optional brand_id (future)"
  products ||--o{ product_variants : "product_id bigint"
  products ||--o{ product_offers : "product_id bigint"
  products ||--o{ product_ingredients : "product_id bigint"
  products ||--o{ product_change_history : "product_id bigint"
  products ||--o{ product_discovery_candidates : "linked_product_id"

  product_variants ||--o{ product_ingredients : "variant_id uuid"
  product_variants ||--o{ product_change_history : "variant_id"

  ingredients ||--o{ product_ingredients : "ingredient_id bigint"
  ingredients ||--o{ ingredient_aliases : "ingredient_id bigint"
  ingredients ||--o{ ingredient_evidence : "ingredient_id bigint"
  ingredients ||--o{ ingredient_cautions : "ingredient_id bigint"

  skin_concerns ||--o{ ingredient_evidence : "concern_id uuid"

  data_sources ||--o{ products : "primary_source_id (future)"
  data_sources ||--o{ product_offers : "optional (future)"

  product_discovery_candidates ||--o{ verification_queue : "entity candidate"
  products ||--o{ verification_queue : "entity product"
  product_offers ||--o{ verification_queue : "entity offer"
  ingredient_evidence ||--o{ verification_queue : "entity evidence"

  brands {
    uuid id PK
    text canonical_name UK
    text verification_status
    boolean active
  }

  products {
    bigint id PK
    text name
    text brand
    text slug UK
    text_array full_ingredients
    text data_confidence
    boolean active
  }

  product_variants {
    uuid id PK
    bigint product_id FK
    text country_code
    numeric size_value
    text formula_version
    text verification_status
    boolean active
  }

  product_offers {
    uuid id PK
    bigint product_id FK
    text retailer_country
    numeric price
    text stock_status
    text verification_status
    boolean active
  }

  ingredients {
    bigint id PK
    text slug UK
    text name_en
    text name_ko
  }

  product_ingredients {
    uuid id PK
    bigint product_id FK
    uuid variant_id FK
    bigint ingredient_id FK
    int ingredient_order
  }

  ingredient_aliases {
    uuid id PK
    bigint ingredient_id FK
    text normalized_alias
    text review_status
    boolean active
  }

  skin_concerns {
    uuid id PK
    text code UK
    text medical_boundary
    text review_status
    boolean active
  }

  ingredient_evidence {
    uuid id PK
    bigint ingredient_id FK
    uuid concern_id FK
    text evidence_level
    text review_status
    text pmid
    text doi
  }

  ingredient_cautions {
    uuid id PK
    bigint ingredient_id FK
    text caution_type
    text severity
    text review_status
    boolean active
  }

  product_discovery_candidates {
    uuid id PK
    text workflow_status
    bigint linked_product_id FK
  }

  verification_queue {
    uuid id PK
    text entity_type
    text entity_id
    text status
  }

  data_sources {
    uuid id PK
    text source_type
    text trust_level
    boolean official
  }

  product_change_history {
    uuid id PK
    bigint product_id FK
    uuid variant_id FK
    text change_type
    jsonb old_value
    jsonb new_value
  }
```

---

## 2. 주요 관계 요약

| 관계 | 카디널리티 | 키 타입 |
|------|------------|---------|
| products → product_offers | 1:N | bigint → uuid rows |
| products → product_variants | 1:N | bigint → uuid |
| products → product_ingredients | 1:N | bigint |
| variants → product_ingredients | 1:N (optional) | uuid |
| ingredients → product_ingredients | 1:N | bigint |
| ingredients → ingredient_evidence | 1:N | bigint |
| skin_concerns → ingredient_evidence | 1:N | uuid |
| discovery → products | N:0..1 | linked_product_id bigint |
| queue → 다형 엔티티 | N:1 | entity_type + entity_id text |

**분리 원칙**

- Product = 무엇인지  
- Variant = 어떤 버전/용량/국가 공식  
- Offer = 어디서 얼마에 살 수 있는지  
- ProductIngredient = 무엇이 순서대로 들어갔는지  
- IngredientEvidence = 성분이 어떤 고민에 어떤 근거로 연결되는지 (제품 효능 단정 아님)

---

## 3. 발견 → published 데이터 흐름

```mermaid
flowchart TD
  A[검색 / 수동 발견] --> B[product_discovery_candidates<br/>workflow=discovered]
  B --> C[판매 페이지·가격·재고·배송 확인]
  C -->|pass| D[sale_checked]
  C -->|fail| R[rejected / needs_review]
  D --> E[중복 검사 findDuplicate 계열]
  E -->|dup| R
  E -->|ok| F[products upsert 초안 + brand 연결]
  F --> G[product_offers 초안 unverified]
  G --> H[전성분 수집 → product_ingredients]
  H --> I[ingredients + aliases 표준화]
  I --> J[ingredients_checked]
  J --> K[ingredient_evidence 연결]
  K --> L[evidence_checked]
  L --> M[ingredient_cautions / 안전 검토]
  M --> N[safety_checked]
  N --> Q[verification_queue]
  Q --> O[관리자 approved / workflow verified]
  O --> P{판매+전성분+승인 OK?}
  P -->|yes| PUB[published + offer verified]
  P -->|no| R
  PUB --> REC[핵심 추천 후보]
```

### 테이블 쓰기 시점

| 단계 | 주로 쓰는 테이블 |
|------|------------------|
| 검색 | `product_discovery_candidates`, `data_sources` |
| 판매 확인 | candidates, 이후 `product_offers` |
| 제품 확정 | `products`, `brands`, `product_variants` |
| 전성분 | `ingredients`, `ingredient_aliases`, `product_ingredients` |
| 근거 | `skin_concerns`, `ingredient_evidence` |
| 안전 | `ingredient_cautions` |
| 승인 | `verification_queue`, status 필드 |
| 이력 | `product_change_history` |
| 추천 노출 | `products`(published) + `product_offers`(verified+in_stock) |

---

## 4. 기존 DB와의 공존

```text
[레거시]
products.brand text ──────────────┐
products.full_ingredients text[]  │  병행 기간
products.link_* / price_usd       │
ingredients.paper_1_* / paper_2_* ┘

[정본 목표]
brands.canonical_name
product_ingredients (ordered)
product_offers
ingredient_evidence
```

레거시 필드를 즉시 DROP하지 않는다. 정본이 채워진 뒤 읽기 경로를 전환한다.

---

## 5. 국가 확장 (KR → US/JP)

- `product_variants.country_code`  
- `product_offers.retailer_country` / `ships_to_countries` (기존)  
- `product_discovery_candidates.discovered_country`  
- `data_sources.country_code`  
- `brands.country_code`  

한국 MVP는 KR offer + KR 배송 검증을 기본 게이트로 사용한다.
