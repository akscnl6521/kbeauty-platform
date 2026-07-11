# Recommendation Flow — 현재 분석 & 구현 계획

> 작성일: 2026-07-11  
> 상태: **계획 문서만** (소스 코드 변경 없음)  
> 목표 파이프라인:
>
> ```text
> AI Analysis
>   → Ingredient Recommendation
>   → Supabase Product Search
>   → Product Ranking
>   → Recommendation Result UI
> ```
>
> 설계 근거: [`RecommendationEngine.md`](./RecommendationEngine.md), [`AIAnalysis_Current.md`](./AIAnalysis_Current.md)

---

## A. 현재 추천 흐름 분석 (As-Is)

### A-1. 실제로 이어지는 경로

```text
[/analyze]
  AI → AnalysisResult
       (skin_type, concerns[], ingredients[], summary_*, routine_tips[])
  UI에 성분 칩 표시
  「제품 정보 보기」→ goToResults()
       ↓
[/results?tone=&concern=&ai=1]
  supabase.from("products").select(...).limit(10000)
  클라이언트 필터: tone, concern, (budget)
  ai=1 이면 배지만 표시
  카드 UI (이름, 성분, recommendation_reason_*)
```

### A-2. 끊겨 있는 연결

| 단계 | 현재 상태 | 문제 |
|------|-----------|------|
| AI → 성분 추천 | AI `ingredients[]`는 **화면 표시만** | DB `ingredients`와 매칭·점수화 없음 |
| 성분 → 제품 검색 | 없음 | `key_ingredients`로 검색/가산 없음 |
| 제품 검색 → 랭킹 | 필터만 존재 | 점수·정렬·breakdown 없음 |
| AI 다중 신호 | `concerns[0]`·사진 모드 tone=`Medium`만 전달 | 나머지 concerns·ingredients·sensitivity 미전달 |
| 결과 UI | 정적 DB 추천 문구 | 매칭 근거(어떤 성분/고민) 미표시 |

### A-3. 관련 기존 파일 (수정 후보)

| 파일 | 현재 역할 |
|------|-----------|
| `src/app/analyze/page.tsx` | AI 호출, 결과 UI, `goToResults` |
| `src/app/results/page.tsx` | products 로드, 필터, 카드 UI |
| `src/lib/supabase.ts` | Supabase 클라이언트 |
| `src/app/ingredients/[slug]/page.tsx` | 성분 상세 (매칭 결과 링크 대상) |
| `src/app/routine/page.tsx` | 즐겨찾기 루틴 (후속 연결) |
| `src/app/quiz/page.tsx` | 동일 `/results` 진입 (프로필 정합) |
| `src/app/face-explorer/page.tsx` | concern 쿼리만 전달 |
| `src/hooks/useLocale.ts` | 결과 설명 언어 |
| `docs/05_AI.md`, `docs/06_API.md`, `docs/RecommendationEngine.md` | 문서 동기화 |

**현재 없음 (계획상 신규 예정, 이 문서에서 구현하지 않음):**

- `src/app/api/recommend/route.ts` (또는 `api/analyze`와 분리된 추천 API)
- `src/lib/recommend/*` (스코어링·성분 매칭 모듈)
- `src/components/*` (결과 카드 분리 — 선택)

---

## B. 목표 흐름 (To-Be)

```text
1. AI Analysis (/analyze)
      Skin Profile + AI ingredients/concerns
           ↓
2. Ingredient Recommendation (서버 또는 공유 모듈)
      문자열 → ingredients slug 매칭 → R+ 점수
           ↓
3. Supabase Product Search
      concern/tone/budget + key_ingredients ∩ R+ 후보 조회
           ↓
4. Product Ranking
      S_concern + S_ingredient + S_budget + penalties → 정렬
           ↓
5. Recommendation Result UI (/results)
      순위·매칭 성분·고민 근거·(선택) AI 설명 표시
```

원칙:

- **DB/엔진이 순위 결정**, AI는 분석 힌트·(후속) 설명
- 추천 공식을 `page.tsx`에 장기 하드코딩하지 말고 `lib/recommend` 또는 API로 이전
- 보안: AI 키 브라우저 노출 제거는 [`AI_Security_Migration.md`](./AI_Security_Migration.md)와 **병행 가능하나**, 본 계획의 “연결”에 초점. 키 이전은 Phase 0으로 권장

---

## C. 단계별 구현 계획 (코드 작성 없음 — 순서만)

### Phase 0 — 계약(Contract) 정의

**목적:** 페이지 간 넘기는 데이터 형식을 고정한다.

**할 일:**

1. Skin Profile / Recommend Request 스키마 문서화  
   - `concerns[]`, `ingredients[]`, `tone`, `budget`, `sensitivity`, `ai`, `locale`
2. `/results` 쿼리 vs `localStorage` vs `POST /api/recommend` 중 전달 방식 결정  
   - **권장:** 짧은 쿼리(id/해시) + `localStorage`에 분석 스냅샷, 또는 서버 세션  
   - 긴 `ingredients` 배열을 URL에만 넣지 말 것
3. `AnalysisResult`와 추천 엔진 입력 매핑표 작성

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `docs/RecommendationEngine.md` | 입력/출력 계약을 구현 가능한 수준으로 보완 (필요 시) |
| `docs/06_API.md` | `POST /api/recommend` 초안 확정 |
| *(신규 예정)* `docs` 내 본 계획 문서 | 진행 체크리스트로 사용 |

**이 Phase에서 앱 소스 수정은 최소화.** 합의만 먼저.

---

### Phase 1 — AI Analysis → 추천 입력 전달

**목적:** analyze가 “배지용 `ai=1`”이 아니라 **성분·고민 전체**를 결과 단계로 넘긴다.

**할 일:**

1. `goToResults`가 넘기는 페이로드 확장  
   - 최소: `concerns` 전체(또는 상위 K), `ingredients` 전체, `skin_type`, `tone` 정규화
2. 사진 모드 `tone` 고정(`Medium`) 제거 또는 수동/AI 톤 매핑 규칙 적용
3. 사진 모드 `concern`을 영문 enum으로 정규화 (수동 모드의 `concernKoToParam`과 동일 계약)
4. `localStorage.skinAnalysisResult`를 results가 읽도록 계약 명시 (이미 저장 중)

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| **`src/app/analyze/page.tsx`** | `goToResults` 파라미터/스토리지 계약 변경; concern·tone 정규화; ingredients 전달 |
| **`src/app/results/page.tsx`** | 마운트 시 `skinAnalysisResult` 및 확장 쿼리 읽기; `ai=1`만으로 끝내지 않기 |

**건드리지 말 것 (이 Phase):**

- Anthropic 프롬프트 대수술 (연결이 우선)
- `/routine` 전면 개편

---

### Phase 2 — Ingredient Recommendation

**목적:** AI 성분 문자열 → Supabase `ingredients`(또는 제품 `key_ingredients` 정규화) 매칭 → R+ 목록.

**할 일:**

1. 성분명 정규화(동의어·대소문자·한/영) 유틸  
2. `ingredients` 테이블 조회 또는 제품 `key_ingredients` 토큰과 교집합  
3. 매칭 실패 성분은 UI에 “미검증 힌트”로만 표시, 랭킹 가산에서 제외 가능  
4. R+ = `{ slug|name, score, sources: ['ai'|'concern_map'] }[]` 생성

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| **`src/lib/supabase.ts`** | 그대로 재사용 (클라이언트/향후 서버 공용). 변경 최소 |
| **`src/app/ingredients/[slug]/page.tsx`** | 링크 타겟으로 유지; 필요 시 목록/검색 진입점만 검토 |
| **`src/app/results/page.tsx`** | R+ 표시 영역(추천 성분 바) 추가 — UI는 Phase 5와 겹칠 수 있음 |
| *(신규 예정)* `src/lib/recommend/ingredients.ts` | 매칭·스코어링 로직 위치 |
| *(신규 예정)* `src/app/api/recommend/route.ts` | 서버에서 ingredients 조회·매칭 (권장) |

**DB:**

- 단기: 기존 `ingredients` + `products.key_ingredients`만 사용  
- 중기: `ingredient_concern_map` 등은 마이그레이션으로 추가 ([`RecommendationEngine.md`](./RecommendationEngine.md) 참고)  
- 기존 마이그레이션 파일은 **수정하지 말고** 새 파일 추가

---

### Phase 3 — Supabase Product Search

**목적:** 전체 1만 건 로드 후 필터 대신, **후보 집합을 좁혀 조회**.

**할 일:**

1. 쿼리 조건: `skin_concern`, `skin_tone`, `price_usd` 구간, (가능 시) 성분 오버랩  
2. select 컬럼은 현재 results와 동일 세트 유지 + 랭킹에 필요한 필드만  
3. limit을 “전량”이 아닌 “후보 상한”(예: 200~500)으로 변경  
4. 실패/빈 결과 시 완화 쿼리(톤 무시 등) 폴백 정책

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| **`src/app/results/page.tsx`** | `fetchProducts`의 `.select().limit(10000)` 및 필터 로직을 검색 API/모듈 호출로 교체 |
| **`src/lib/supabase.ts`** | 서버 라우트에서 쓸 경우 브라우저 전용과 분리 검토 (신규 `lib/supabase-server.ts` 가능) |
| *(신규 예정)* `src/app/api/recommend/route.ts` 또는 `api/products/search/route.ts` | 실제 Supabase 쿼리 수행 |

**주의:**

- RLS·anon 키 전제 유지  
- 서비스 롤 키를 클라이언트에 넣지 말 것

---

### Phase 4 — Product Ranking

**목적:** 필터 통과 목록을 **점수 정렬**로 바꾼다.

**할 일:**

1. `S_concern`, `S_ingredient`, `S_budget`, 페널티 구현 ([`RecommendationEngine.md`](./RecommendationEngine.md) §5)  
2. 각 제품에 `score` + `match_breakdown` + `matched_ingredients` 부여  
3. 브랜드 다양성 등 소프트 재정렬 (선택)  
4. `ai=1` 배지 대신 “매칭 점수/근거”가 주 신호가 되게 함

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| **`src/app/results/page.tsx`** | `quizFilteredProducts` / `matchesTone|Concern|Budget` 중심 로직을 랭킹 결과 렌더로 교체·축소 |
| *(신규 예정)* `src/lib/recommend/score.ts` | 순수 함수로 스코어링 (테스트 용이) |
| *(신규 예정)* `src/app/api/recommend/route.ts` | 검색+랭킹 일괄 응답 |

**명시적으로 옮길 기존 로직 위치:**

- `matchesTone`, `matchesConcern`, `matchesBudget`, `parseArrayField`  
  → `results/page.tsx`에서 **`src/lib/recommend/*`로 이동** (페이지는 UI만)

---

### Phase 5 — Recommendation Result UI

**목적:** 사용자가 “왜 이 제품인지” 보이게 한다.

**할 일:**

1. 정렬된 순서로 카드 렌더  
2. 카드에 표시: 매칭 성분, 매칭 고민, (선택) score 또는 적합 라벨  
3. 상단: AI/퀴즈 기반 추천 성분 R+ 칩 → `/ingredients/[slug]` 링크  
4. 기존 `recommendation_reason_*`와 breakdown 설명을 함께 노출  
5. 빈 결과·로딩·에러 상태 명확화  
6. 퀴즈·face-explorer 진입도 동일 UI 계약 사용

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| **`src/app/results/page.tsx`** | 메인 Result UI 개편 (필수) |
| **`src/app/analyze/page.tsx`** | CTA 카피/전달 정합, “성분별로 보기”(`href="#"`)를 R+ 또는 results 앵커로 연결 |
| **`src/app/quiz/page.tsx`** | `/results`로 보내는 파라미터를 동일 계약에 맞춤 (`age`/`warmth` 미사용 문제 정리) |
| **`src/app/face-explorer/page.tsx`** | 가능하면 동일 추천 API/쿼리 계약으로 연결 (concern만 보내던 방식 확장 여부 결정) |
| **`src/app/ingredients/[slug]/page.tsx`** | 결과에서 들어온 맥락 유지(뒤로가기 `/results`) 정도 |
| **`src/locales/en.json`**, **`ja.json`**, **`ko.json`** | 결과 UI 신규 문구 키 추가 |
| **`src/app/sitemap.ts`** | UI 연결 필수 아님. SEO 시 `/analyze` 등 누락분은 별도 작업 |

**선택 (신규 컴포넌트 분리 시):**

- Product 카드, Ingredient 칩 바를 `src/components/`로 추출 — **기존 파일에서 import하도록 results만 수정**

---

### Phase 6 — 회귀 연결 & 문서

**할 일:**

1. `/routine`: 랭킹 상위 또는 즐겨찾기와 연동 여부 결정 후 `routine/page.tsx` 수정  
2. AI 보안 마이그레이션과 충돌 없이 `/api/analyze` + `/api/recommend` 경계 정리  
3. 문서 갱신

**수정할 기존 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/routine/page.tsx` | (선택) 추천 결과 기반 루틴 |
| `docs/05_AI.md` | 분석→추천 연결 반영 |
| `docs/06_API.md` | recommend API |
| `docs/03_Architecture.md` | 데이터 흐름 다이어그램 |
| `docs/ProjectInventory.md` | 기능 상태 업데이트 |
| `README.md` | Main Features / 철학과 실제 흐름 일치 |

---

## D. 파일별 수정 요약 (한눈에)

### 반드시 수정 (연결의 핵심)

| 우선순위 | 파일 | Phase |
|----------|------|-------|
| 1 | `src/app/analyze/page.tsx` | 1, 5 |
| 2 | `src/app/results/page.tsx` | 1–5 |
| 3 | `src/app/quiz/page.tsx` | 5 |
| 4 | `docs/06_API.md` | 0, 6 |

### 권장 수정

| 파일 | 이유 |
|------|------|
| `src/app/face-explorer/page.tsx` | 동일 파이프라인 진입 |
| `src/app/analyze/page.tsx`의 `#` 링크 | 성분 추천 UI 연결 |
| `src/locales/*.json` | 결과 UI 문구 |
| `src/app/routine/page.tsx` | 추천→루틴 연장 |
| `docs/05_AI.md`, `03_Architecture.md`, `RecommendationEngine.md`, `ProjectInventory.md`, `README.md` | 동기화 |

### 거의 수정 없음 / 재사용만

| 파일 | 비고 |
|------|------|
| `src/lib/supabase.ts` | 클라이언트 유지; 서버 분리 시 신규 파일 추가가 더 안전 |
| `src/app/ingredients/[slug]/page.tsx` | 상세 페이지로 링크만 |
| `src/app/layout.tsx` | 추천 로직과 무관 |
| `src/app/privacy/page.tsx`, `terms/page.tsx` | 데이터 처리 변경 시 정책 문구만 검토 |

### 신규로 추가할 가능성이 큰 파일 (기존 수정과 병행)

| 신규 경로 | 역할 |
|-----------|------|
| `src/lib/recommend/normalize.ts` | concern/ingredient 정규화 |
| `src/lib/recommend/ingredients.ts` | R+ 생성 |
| `src/lib/recommend/score.ts` | 제품 랭킹 |
| `src/app/api/recommend/route.ts` | 검색+랭킹 API |
| `supabase/migrations/YYYYMMDD_*.sql` | 맵 테이블 (중기) |

---

## E. 권장 구현 순서 (체크리스트)

```text
[ ] Phase 0  계약 확정 (쿼리 vs localStorage vs API)
[ ] Phase 1  analyze → results 페이로드 연결
[ ] Phase 2  성분 매칭 R+
[ ] Phase 3  Supabase 후보 검색 축소
[ ] Phase 4  제품 스코어링·정렬
[ ] Phase 5  Result UI에 근거 표시
[ ] Phase 6  quiz/face/routine·문서 정합
[ ] (병행) AI_Security_Migration — 키 서버 이전
```

각 Phase 완료 기준:

- Phase 1: results가 AI `ingredients`를 읽을 수 있다  
- Phase 2: R+ 중 최소 1개가 DB/제품 성분과 매칭된다  
- Phase 3: 전량 1만 건 로드에 의존하지 않는다  
- Phase 4: 목록이 score 내림차순이다  
- Phase 5: 카드에 매칭 성분 또는 고민 근거가 보인다  

---

## F. 리스크 & 가드레일

| 리스크 | 완화 |
|--------|------|
| URL 과다 길이 | ingredients는 localStorage/POST body |
| AI 성분명 표기 불일치 | 정규화 + 미매칭 제외 |
| results 비대화 | 로직을 `lib/recommend`로 분리 |
| 퀴즈와 AI 계약 불일치 | Phase 0 스키마 공유 |
| 기존 북마크 URL | `tone`/`concern`/`budget` 하위 호환 유지 |
| 보안 | 클라우드 AI 키는 서버만 ([`AI_Security_Migration.md`](./AI_Security_Migration.md)) |

---

## G. 명시적 비범위 (이번 연결 계획에서 하지 않음)

- 추천 엔진 학습/피드백 파이프라인 구현  
- 제휴 링크 셀렉터 고도화 (별도)  
- `/ingredients` 목록 페이지 신설 (별도, 404 수정은 병행 가능)  
- 본 문서 작성 시점의 **어떤 소스 파일도 수정하지 않음**

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-11 | 현재 흐름 분석 + 단계별 구현 계획 (코드 없음) |
