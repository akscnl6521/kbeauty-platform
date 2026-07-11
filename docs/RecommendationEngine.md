# Recommendation Engine Design — K-Beauty Match

> 상태: **설계 문서만** (구현·코드 변경 없음)  
> 작성일: 2026-07-11  
> 원칙: 피부 이해 → 성분 → 제품. **DB가 추천을 결정**하고, **AI는 설명을 생성**한다.  
> 추천 규칙을 애플리케이션 코드에 하드코딩하지 않는다. 규칙·가중치·제외 목록은 데이터(또는 버전 관리되는 설정 테이블)에 둔다.

---

## 설계 목표

| 목표 | 설명 |
|------|------|
| 신뢰 | 근거(성분·고민·주의) 없는 제품 나열을 하지 않는다 |
| 분리 | 스코어링/랭킹 = 결정론적 엔진, 설명 문장 = AI |
| 확장 | 새 고민·성분·시장 링크를 코드 배포 없이 데이터로 추가 가능 |
| 안전 | 민감 피부·충돌 성분·과장 의료 표현을 구조적으로 제한 |
| 글로벌 | 로케일·국가별 제휴 링크·통화는 랭킹과 분리된 선택 계층 |

---

## 1. Overall recommendation flow

전체 파이프라인은 **한 방향**이다. 제품부터 고르지 않는다.

```text
[1] Skin Profile 구성
      Quiz / AI Analyze / Face Explorer / (향후) 저장된 프로필
              ↓
[2] Concern Vector 생성
      고민별 가중 점수 (0~1), 톤·민감도·예산 제약
              ↓
[3] Ingredient Match
      추천 성분 집합 R+  /  제외·주의 성분 집합 R−
              ↓
[4] Product Candidate Retrieval (Supabase)
      skin_concern, skin_tone, price, key_ingredients 기반 후보 집합
              ↓
[5] Product Ranking
      성분 적합도 + 고민 적합도 + 예산 + (선택) 다양성 페널티
              ↓
[6] AI Explanation
      상위 N개에 대해 “왜 맞는지” 설명 (결정 변경 금지)
              ↓
[7] Routine Assembly
      카테고리 슬롯 + 성분 충돌 검사 + 사용 순서
              ↓
[8] Affiliate Link Selection
      국가·로케일·가용 링크·정책에 따른 URL 선택
              ↓
[9] Feedback Loop (비동기)
      클릭·즐겨찾기·숨김·만족도 → 가중치/규칙 학습 입력
```

### 입력: Skin Profile (논리 모델)

| 필드 | 출처 예 | 용도 |
|------|---------|------|
| `concerns[]` + weights | 퀴즈, AI, face-explorer | 고민 스코어링 |
| `skin_tone` | 퀴즈, AI(수동) | 제품 `skin_tone` 매칭 |
| `undertone` / `warmth` | 퀴즈 | (데이터 준비 시) 톤 정밀 매칭 |
| `sensitivity` | AI 수동 | 제외·주의 강화 |
| `budget_tier` | 퀴즈 | 가격 구간 |
| `preferred_ingredients[]` | AI `ingredients` | 성분 가산 |
| `excluded_ingredients[]` | 사용자·알레르기·규칙 | 하드 필터 |
| `locale`, `country` | i18n / IP | 설명 언어·제휴 링크 |
| `age_group` | 퀴즈 | (데이터 준비 시) 가중치 조정 |

### 출력

| 산출물 | 설명 |
|--------|------|
| `recommended_ingredients[]` | slug, score, reason_codes |
| `ranked_products[]` | id, score, match_breakdown |
| `explanations[]` | 제품/루틴별 다국어 설명 |
| `routine` | 스텝별 제품 + 주의 |
| `affiliate_links` | 제품별 선택된 URL |
| `engine_version` | 재현·A/B용 버전 문자열 |

### 계층 규칙

1. **Retrieval / Ranking**: PostgreSQL + 서버 엔진 (결정론)
2. **Explanation**: AI (서버), 랭킹 결과를 바꾸지 않음
3. **UI**: 결과 표시만. 클라이언트에 추천 공식 복제 금지

---

## 2. Skin concern scoring

### 목적

사용자의 여러 피부 고민을 **정규화된 가중 벡터**로 만든다.

### Concern 카탈로그 (데이터)

고민 목록은 코드 상수가 아니라 DB/설정 테이블에 둔다.

예시 네임스페이스 (현재 앱과 정합):

- `Redness`, `Dryness`, `Acne`, `Dullness`, `Anti-aging`
- TODO: 모공, 색소, 장벽 손상 등 확장 시 동일 테이블에 추가

각 concern 레코드 예시 필드:

| 필드 | 의미 |
|------|------|
| `code` | 안정적 식별자 |
| `aliases` | AI/퀴즈 표기 매핑 (예: `붉은기` → `Redness`) |
| `default_weight` | 단일 선택 시 기본 가중치 |
| `sensitivity_multiplier` | 민감 피부일 때 가중 조정 |
| `incompatible_with[]` | 동시 강조 시 감점 쌍 (선택) |

### 점수 산정

1. **수집**: 퀴즈 주 고민(1.0), AI `concerns[]`(순서 감쇠), face zone concern(0.6 등)
2. **정규화·매핑**: alias → `code` (매핑 실패 시 폐기 또는 `unmapped` 로그)
3. **가중 합산** 후 L1/L2 정규화하여 \(\sum w = 1\) 또는 max=1
4. **민감도 보정**: `sensitivity=민감함`이면 자극·각질제거 계열 관련 concern 취급 강화(제외 로직과 연동)
5. **출력**: `ConcernScore[] = { code, weight, sources[] }`

### 다중 고민

- 상위 K개(예: 3)만 제품 랭킹에 사용하고 나머지는 설명용으로만 노출할 수 있다.
- 서로 상충하는 쌍(예: 강한 각질제거 vs 장벽 회복)은 **제외 로직·루틴 순서**에서 처리하고, 단순 합산만으로 제품을 고르지 않는다.

### TODO

- `age` / `undertone`이 products 스키마에 반영되는 시점의 가중치 테이블
- concern 간 상관 행렬 확정

---

## 3. Ingredient recommendation logic

### 목적

제품보다 먼저 **추천 성분 집합 R+** 를 만든다.

### 데이터 의존

- `ingredients` 테이블: 효과·기전·주의·slug
- (설계) `ingredient_concern_map`: ingredient_id × concern_code × strength (0~1)
- (설계) `ingredient_tags`: `soothing`, `hydrating`, `exfoliant`, `retinoid`, `fragrance` 등

### 알고리즘 (개요)

```text
for each concern in ConcernScore:
  candidates += ingredients mapped to concern with strength * concern.weight

merge by ingredient_id
apply boost if ingredient ∈ AI preferred_ingredients (이름/slug 매칭)
apply penalty if caution flags intersect sensitivity
sort by score → top M ingredients (R+)
```

### 매칭 규칙

| 단계 | 내용 |
|------|------|
| 정규화 | 성분명 소문자, 동의어 테이블 (`niacinamide` = `니아신아마이드`) |
| AI 힌트 | AI가 준 문자열은 **힌트**일 뿐, DB에 없는 성분은 R+에 넣지 않거나 `unverified` 플래그 |
| 다양성 | 동일 태그 과다 독점 방지 (예: soothing만 5개) |
| 설명 코드 | `reason_codes`: `MATCH_CONCERN_ACNE`, `AI_HINT`, `BARRIER_SUPPORT` 등 |

### 출력 예시 (논리)

```text
R+ = [
  { slug: "niacinamide", score: 0.92, concerns: ["Acne","Dullness"], reason_codes: [...] },
  { slug: "panthenol",   score: 0.81, concerns: ["Redness","Dryness"], ... }
]
```

### 원칙

- 성분 추천의 근거는 **맵핑 테이블 + ingredients 메타데이터**
- AI는 “이 성분을 고르라”고 최종 결정하지 않고, 힌트·설명에만 기여

---

## 4. Ingredient exclusion logic

### 목적

해롭거나 부적합한 성분을 **하드 필터(R−)** 와 **소프트 페널티**로 나눈다.

### 제외 소스

| 소스 | 처리 |
|------|------|
| 사용자 알레르기/기피 | 하드 제외 |
| `ingredients.caution*` + 민감도 | 규칙 테이블에 따라 하드 또는 소프트 |
| 임산부·특정 상태 플래그 (향후) | 하드 제외 태그 |
| 성분 충돌 쌍 | 루틴/제품 조합 시 제외 또는 경고 |
| 법적·정책 금지 목록 | 하드 제외 |

### (설계) 규칙 테이블 `ingredient_rules`

| 필드 | 의미 |
|------|------|
| `ingredient_id` / tag | 대상 |
| `condition` | `sensitivity=high`, `pregnancy`, `concern=Acne` 등 |
| `action` | `exclude` / `penalize` / `warn` |
| `penalty` | 소프트일 때 감점 |
| `message_key` | UI/AI 설명용 i18n 키 |

### 충돌 예시 (데이터로 관리)

- 고농도 산(AHA/BHA) + 레티노이드 동시 고강도 → 같은 저녁 루틴 금지 또는 격일
- 향료·에센셜오일 태그 + 민감/붉은기 고가중 → exclude 또는 강한 penalize
- 사용자 R−에 포함된 성분이 `key_ingredients`에 있으면 해당 **제품 탈락**

### 적용 시점

1. R+ 생성 직후: R− 제거
2. Product retrieval 후: 제품 성분 ∩ R− → drop
3. Routine: 스텝 간 충돌 재검사

### 원칙

- “일단 추천하고 나중에 주의”보다 **제외를 먼저** 적용
- 의료적 진단 문구 금지. `warn` 메시지는 정보성·제품 라벨 확인 권고 수준

---

## 5. Product ranking algorithm

### 목적

후보 제품에 **재현 가능한 점수**를 부여해 정렬한다.  
점수는 DB 필드와 규칙 테이블에서만 유도한다.

### 후보 수집 (Retrieval)

Supabase/`products`에서 대략 필터:

- `skin_concern`이 ConcernScore 상위 코드와 교집합
- `skin_tone`이 비어 있거나 프로필 톤과 교집합
- `price_usd`가 budget_tier 허용 구간
- `key_ingredients`가 R−와 교집합이면 제외
- (선택) 카테고리·브랜드 다양성 쿼터

페이지네이션·서버 필터를 전제로 하며, 클라이언트 1만 건 로드는 사용하지 않는다.

### 점수 구성 (가중 합, 가중치는 설정 테이블)

\[
S = w_c S_{concern} + w_i S_{ingredient} + w_b S_{budget} + w_t S_{tone} + w_q S_{quality} - P_{penalty}
\]

| 항 | 정의 (개요) |
|----|-------------|
| \(S_{concern}\) | 제품 `skin_concern` ∩ 사용자 concern weights 의 가중합 |
| \(S_{ingredient}\) | `key_ingredients` ∩ R+ 의 score 합 / 정규화 |
| \(S_{budget}\) | 티어 중앙에 가까울수록 가산, 이탈 시 감점(하드 컷은 retrieval) |
| \(S_{tone}\) | 톤 매칭 여부 (미표기 제품은 중립 점수) |
| \(S_{quality}\) | (선택) 데이터 완결성: 추천이유·성분·링크 존재 |
| \(P_{penalty}\) | 주의 태그, 중복 브랜드, 동일 성분 과다 |

### 다양성

- 상위 N에서 동일 브랜드 최대 k개
- 카테고리 슬롯 예비 (클렌저/토너/세럼…)는 루틴 단계에서 재배치

### 출력

각 제품에 `match_breakdown`을 붙여 설명·디버깅·피드백에 사용한다.

```text
{
  product_id,
  score,
  breakdown: { concern: 0.4, ingredient: 0.45, budget: 0.1, ... },
  matched_ingredients: [...],
  matched_concerns: [...]
}
```

### 금지

- AI에게 “이 중 베스트 3 골라줘”로 **최종 순위 결정**을 맡기지 않음
- UI에 예산 구간·매칭 함수를 복제하지 않음 (서버/DB 단일 구현)

---

## 6. AI explanation generation

### 목적

이미 결정된 랭킹·성분 매칭을 **사람이 이해하도록 설명**한다.  
설명은 순위를 바꾸지 않는다.

### 입력 (서버 → AI)

- Skin Profile 요약 (민감 원문·사진은 최소화)
- 상위 제품의 `match_breakdown`, 매칭 성분, concern codes
- 해당 성분 DB의 effects/caution 요약
- locale (`ko`/`en`/`ja`)
- 면책: 의료 진단 아님

### 출력

| 필드 | 내용 |
|------|------|
| `product_explanations[]` | 제품별 2~4문장, 로케일별 |
| `ingredient_explanations[]` | 왜 이 성분이 프로필에 맞는지 |
| `warnings[]` | caution 기반 주의 (과장 금지) |
| `confidence_note` | 데이터 부족 시 겸손한 표현 |

### 가드레일

1. 입력에 없는 효능·임상 결과를 지어내지 않음
2. `recommendation_reason_*` DB 문구가 있으면 **우선 인용·재구성**, 없으면 breakdown 기반 생성
3. JSON 스키마 검증 후 UI 반영
4. 호출은 서버 API만 (`docs/AI_Security_Migration.md` 준수)
5. 캐시 키: `engine_version + profile_hash + product_ids + locale`

### AI가 하지 않는 일

- 제품 점수 재계산
- 제외 규칙 무시
- 제휴 링크 선택
- 진단·처방 표현

---

## 7. Routine generation

### 목적

랭킹된 제품(또는 즐겨찾기)을 **안전한 사용 순서**의 루틴으로 조립한다.

### 슬롯 모델 (데이터)

카테고리 → 스텝 매핑은 코드 if문이 아니라 `routine_slots` 테이블:

| slot_order | slot_code | allowed_category_patterns |
|------------|-----------|---------------------------|
| 1 | cleanser | cleanser, cleansing |
| 2 | toner | toner |
| 3 | essence_serum | essence, serum, ampoule |
| 4 | treatment | treatment, retinol, acid |
| 5 | moisturizer | cream, moisturizer |
| 6 | sunscreen | sun, sunscreen (AM) |

### 조립 절차

1. 후보 제품을 슬롯에 배치 (슬롯당 최고 점수 1개, 또는 AM/PM 분리)
2. 성분 충돌 그래프 검사 → 충돌 시 낮은 점수 제품 제거 또는 격일 플래그
3. R− / caution `warn`을 스텝에 첨부
4. 빈 슬롯은 “선택”으로 두고 억지 채우지 않음
5. (선택) AI는 순서 설명만 생성, 슬롯 배치는 엔진이 결정

### AM / PM

- AM: 자외선 차단 슬롯 필수 권고
- PM: treatment(산/레티노이드) 슬롯 허용, 충돌 규칙 강화

### 현재 `/routine`과의 관계

현재는 즐겨찾기 + 문자열 카테고리 매핑이다.  
본 설계의 루틴 엔진이 도입되면 동일 슬롯 모델을 서버에서 제공하고, UI는 결과만 렌더링한다.

---

## 8. Affiliate link selection

### 목적

제품의 여러 구매 링크 중 **사용자 맥락에 맞는 하나(또는 소수)** 를 고른다.  
랭킹 점수와 분리된 **Link Selector** 계층이다.

### 입력

- 제품의 링크 필드 (현재 코드 기준 예):  
  `link_sephora`, `link_amazon_us`, `link_amazon_jp`, `link_qoo10`, `link_oliveyoung`, `link_coupang`, `link_yesstyle`
- `country`, `locale`, (선택) 사용자 선호 스토어
- 정책: 노출 가능 마켓, 제휴 우선순위

### (설계) `affiliate_priority` 규칙

```text
country=KR → oliveyoung, coupang, ...
country=JP → amazon_jp, qoo10, ...
country=US → sephora, amazon_us, yesstyle, ...
locale 보조, 빈 링크 스킵
```

우선순위·가중치는 DB/설정으로 관리한다.

### 선택 알고리즘

1. 빈 URL 제거  
2. 국가 우선순위 리스트로 정렬  
3. 첫 유효 링크를 primary, 나머지를 alternatives  
4. 추적 파라미터는 서버에서만 부가 (클라이언트에 시크릿 없음)  
5. 링크 없음 → “정보만 제공” CTA (쇼핑몰화하지 않음)

### 원칙

- 플랫폼은 **정보·매칭**이 본업, 제휴는 부가
- 더 높은 커미션만으로 제품 순위를 바꾸지 않음 (랭킹과 링크 선택 분리)
- 고장난 링크는 피드백/크론으로 비활성 플래그

---

## 9. Learning from user feedback

### 목적

명시·암시 피드백으로 **규칙 가중치와 맵핑 품질**을 개선한다.  
개인 의료 데이터를 불필요하게 영구 저장하지 않는다.

### 피드백 신호

| 신호 | 유형 | 활용 |
|------|------|------|
| 즐겨찾기 추가/제거 | 명시 | 성분·고민 맵 강화/약화 |
| 제품 카드 클릭 / 제휴 클릭 | 암시 | CTR, 링크 우선순위 |
| “이 추천 숨기기” | 명시 | 네거티브 샘플 |
| 루틴 스텝 교체 | 명시 | 슬롯·충돌 규칙 |
| 설명 유용성 (👍/👎) | 명시 | 프롬프트·템플릿 |
| AI 분석 재실행 | 암시 | 프로필 불안정성 |

### 학습 파이프라인 (단계적)

**Stage A — 규칙 튜닝 (단기)**  
- 집계 통계로 `ingredient_concern_map.strength`, ranking weights 조정  
- 인간 검수 후 설정 버전 bump (`engine_version`)

**Stage B — 개인화 (중기, 계정 필요)**  
- 사용자별 prior (선호 브랜드·기피 성분)  
- 글로벌 모델과 블렌딩 (과적합·프라이버시 주의)

**Stage C — 밴딧/실험 (장기)**  
- 설명 톤, 다양성 파라미터 A/B  
- 제품 랭킹 핵심 공식은 가드레일 내에서만 실험

### 저장 설계 (논리)

- `recommendation_events`: profile_hash, engine_version, product_ids, scores  
- `feedback_events`: event_type, target_id, timestamp  
- 얼굴 원본 이미지는 학습에 쓰지 않거나 즉시 폐기 정책

### 금지

- 피드백으로 의료 효능 주장을 강화하지 않음
- 제휴 클릭만으로 성분 적합도를 “학습”해 순위를 왜곡하지 않음 (별도 목표로 분리)

---

## 10. Future AI improvements

구현 순서가 아닌 **방향성**이다. 보안 마이그레이션·결정론 엔진이 선행한다.

| 영역 | 개선 | 전제 |
|------|------|------|
| 서버 AI | 분석·설명을 서버 Route로 통합 | `AI_Security_Migration.md` |
| 스키마 강제 | 분석/설명 JSON 엄격 검증 | 공통 `AnalysisResult` / `ExplanationResult` |
| 성분 엔티티 링킹 | AI 문자열 → ingredients.slug NER | 동의어 사전 |
| RAG | 성분 논문·caution 조각을 검색 후 설명에만 사용 | 환각 감소 |
| 임베딩 검색 | 프로필·제품 벡터 유사도 (보조 점수) | pgvector, 랭킹 가드레일 |
| 멀티모달 | 사진 분석 품질·조명 가이드 | 민감정보 정책 |
| 대화형 | “레티놀 입문” 질의 → 엔진 재호출 | 도구 호출로 retrieval 강제 |
| 다국어 | 설명·reason 일관 번역 검수 워크플로 | 인간 검수 플래그 |
| 온디바이스/로컬 | Ollama로 설명 초안 | 프로덕션 품질 게이트 |
| 평가 | offline@K, 성분 적중률, 설명 환각률 | 오프라인 평가셋 |

### AI 개선의 불변 조건

1. **DB/엔진이 후보와 순위를 결정**한다  
2. **AI는 설명·힌트·정규화**에 머문다  
3. **키는 서버 전용**, 브라우저는 `/api/*`만 호출  
4. **의료 진단 대체 금지**  
5. 새 모델 도입 시 `engine_version` / `explainer_version`을 분리해 재현한다  

---

## 부록 A — 현재 시스템과의 갭

| 현재 | 본 설계 |
|------|--------|
| `/results` 클라이언트 필터 | 서버 랭킹 + breakdown |
| AI `ai=1` 배지 | AI 힌트 → R+ → 점수 반영 |
| 얼굴 zone 정적 concern | ConcernScore 입력 소스 중 하나 |
| 루틴 문자열 매핑 | `routine_slots` + 충돌 검사 |
| 제휴 링크 select만 | Link Selector 계층 |
| 피드백 = localStorage 즐겨찾기 | event 파이프라인 |

## 부록 B — 권장 구현 순서 (참고, 본 문서에서 구현하지 않음)

1. Concern·Ingredient 맵 테이블 + 서버 retrieval  
2. 제외 규칙 + 제품 스코어링 API  
3. 설명 AI (서버)  
4. 루틴 슬롯 엔진  
5. 제휴 링크 셀렉터  
6. 피드백 이벤트 수집  
7. 임베딩·RAG 등 고도화  

## 부록 C — 관련 문서

- [`docs/02_ProjectRule.md`](./02_ProjectRule.md)  
- [`docs/AIAnalysis_Current.md`](./AIAnalysis_Current.md)  
- [`docs/AI_Security_Migration.md`](./AI_Security_Migration.md)  
- [`docs/04_DB.md`](./04_DB.md)  
- [`docs/05_AI.md`](./05_AI.md)  
- [`docs/07_Roadmap.md`](./07_Roadmap.md)  

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-11 | 추천 엔진 설계 초안 (구현 없음) |
