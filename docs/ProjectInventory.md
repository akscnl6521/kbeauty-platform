# Project Inventory — K-Beauty Match

> 조사일: 2026-07-11  
> 범위: 저장소에 **실제로 존재하는** 코드·마이그레이션·설정만 기록  
> 원칙: 추측하지 않음. 미확인 항목은 “저장소에서 확인되지 않음”으로 표기

---

## 1. Existing Pages

App Router 기준. `src/app` 아래에 `page.tsx`가 있는 경로만 포함.

| URL | 파일 | `"use client"` | 역할 (코드 기준) |
|-----|------|----------------|------------------|
| `/` | `src/app/page.tsx` | 예 | 랜딩, 퀴즈/분석/얼굴탐색/성분 링크, 언어 전환 |
| `/quiz` | `src/app/quiz/page.tsx` | 예 | 나이·톤·언더톤·고민·예산 설문 → `/results` 쿼리 이동 |
| `/results` | `src/app/results/page.tsx` | 예 | `products` 조회·필터·검색·즐겨찾기 |
| `/analyze` | `src/app/analyze/page.tsx` | 예 | Anthropic 피부 분석, 결과 localStorage 저장 |
| `/routine` | `src/app/routine/page.tsx` | 예 | 즐겨찾기 제품 카테고리별 루틴 표시 |
| `/face-explorer` | `src/app/face-explorer/page.tsx` | 예 | 얼굴 부위 UI, 정적 `zoneInfo` → `/results?concern=` |
| `/ingredients/[slug]` | `src/app/ingredients/[slug]/page.tsx` | 예 | `ingredients` slug 단건 상세 |
| `/privacy` | `src/app/privacy/page.tsx` | 예 | 개인정보처리방침 |
| `/terms` | `src/app/terms/page.tsx` | 예 | 이용약관 |

### 레이아웃·특수 라우트

| 경로/파일 | 역할 |
|-----------|------|
| `src/app/layout.tsx` | 루트 레이아웃, 메타데이터, Google Fonts, AdSense |
| `src/app/sitemap.ts` | `/sitemap.xml` — 정적 경로 + `ingredients.slug` |
| `src/app/globals.css` | 전역 스타일 |

### 링크는 있으나 페이지 파일이 없는 경로

| 링크 출처 | 대상 | 비고 |
|-----------|------|------|
| `src/app/page.tsx` → `href="/ingredients"` | `/ingredients` | `ingredients/page.tsx` **없음** (동적 `[slug]`만 존재) |
| `src/app/analyze/page.tsx` → `href="#"` | `#` | “성분별로 보기” 버튼이 실제 라우트로 연결되지 않음 |

### 사이트맵에 포함된 경로 (`sitemap.ts` 기준)

- `/`, `/quiz`, `/results`, `/privacy`, `/terms`
- `/ingredients/{slug}` (DB 조회 성공 시)

사이트맵에 **포함되지 않은** 기존 페이지: `/analyze`, `/routine`, `/face-explorer`

---

## 2. Existing Components

### 조사 결과

- `src/components/` 디렉터리: **없음**
- `components` 경로의 `.tsx` / `.ts` 파일: **0개**
- 공유 UI 컴포넌트 모듈: **없음**

UI는 각 `page.tsx` 내부에 인라인으로 작성되어 있다.

페이지 내부 헬퍼 함수 예 (별도 컴포넌트 파일 아님):

- `results/page.tsx`: `matchesTone`, `matchesConcern`, `matchesBudget`, `parseArrayField` 등
- `routine/page.tsx`: `mapCategoryToStep`, `formatPrice`
- `analyze/page.tsx`: `callAnthropic`, `concernKoToParam`, `toneKoToResultsTone`
- `quiz/page.tsx`: `optionLabel`, `budgetLabel`
- `ingredients/[slug]/page.tsx`: `displayIngredientName`

---

## 3. Existing Hooks

위치: `src/hooks/`

| 훅 | 파일 | 역할 | 사용처 (import 기준) |
|----|------|------|----------------------|
| `useLocale` | `useLocale.ts` | `en`/`ja`/`ko` 선택, `locales/*.json` 메시지, `localStorage.locale` | `page.tsx`, `quiz`, `analyze`, `ingredients/[slug]`, `routine` |
| `useCountry` | `useCountry.ts` | `ipapi.co`로 국가 코드, `localStorage.countryCode` | `useLocale` 내부에서만 사용 |
| `useExchangeRate` | `useExchangeRate.ts` | USD→KRW/JPY 환율, `localStorage.exchangeRates` 캐시 | `routine/page.tsx`만 |

참고: `results/page.tsx`는 `useLocale`을 쓰지 않고, 페이지 내부에서 `localStorage.locale`과 `LOCALE_MESSAGES`를 직접 다룬다.

---

## 4. Existing API Routes

### 조사 결과

- `src/app/api/**`: **없음**
- `route.ts` 파일: **0개**
- `middleware.ts`: **없음**

브라우저에서 직접 호출하는 외부 HTTP:

| 대상 | 호출 위치 |
|------|-----------|
| Supabase REST (`@supabase/supabase-js`) | `results`, `routine`, `ingredients/[slug]`, `sitemap` |
| `https://api.anthropic.com/v1/messages` | `analyze/page.tsx` |
| `https://ipapi.co/json/` | `useCountry.ts` |
| `https://api.exchangerate-api.com/v4/latest/USD` | `useExchangeRate.ts` |

---

## 5. Existing Supabase Tables

코드·마이그레이션에서 **이름이 확인된** 테이블만 기록한다.  
전체 `CREATE TABLE` 스키마는 저장소에 없다.

### 클라이언트

- 파일: `src/lib/supabase.ts`
- `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`

### 테이블: `products`

**조회 위치**

- `src/app/results/page.tsx` — `.select(...).limit(10000)`
- `src/app/routine/page.tsx` — 즐겨찾기 id `IN` 조회

**`results` select에 등장하는 컬럼**

`id`, `name`, `name_ja`, `name_ko`, `brand`, `category`, `skin_concern`, `skin_tone`, `key_ingredients`, `key_ingredients_ja`, `price_usd`, `recommendation_reason`, `recommendation_reason_ko`, `recommendation_reason_ja`, `slug`, `link_sephora`, `link_amazon_us`, `link_amazon_jp`, `link_qoo10`, `link_oliveyoung`, `link_coupang`, `link_yesstyle`

**`routine` select에 등장하는 컬럼**

`id`, `name`, `name_ja`, `name_ko`, `brand`, `category`, `price_usd`

**마이그레이션에서 확인**

- `20250316000000_allow_anon_read_products.sql` — anon `SELECT` 정책
- `20250318000000_add_products_recommendation_reason_ko.sql` — `recommendation_reason_ko` 추가

### 테이블: `ingredients`

**조회 위치**

- `src/app/ingredients/[slug]/page.tsx` — slug 단건
- `src/app/sitemap.ts` — `slug` 목록

**select에 등장하는 컬럼**

`slug`, `name_en`, `name_ko`, `name_ja`, `effects`, `effects_ko`, `effects_ja`, `mechanism`, `mechanism_ja`, `mechanism_ko`, `caution`, `caution_ko`, `caution_ja`, `paper_1_title`, `paper_1_year`, `paper_1_journal`, `paper_1_url`, `paper_2_title`, `paper_2_year`, `paper_2_journal`, `paper_2_url`

**마이그레이션에서 확인**

- `20250317000000_add_ingredients_locale_columns.sql` — `mechanism_ko/ja`, `caution_ko/ja` 추가

### 저장소에서 확인되지 않은 항목

- `users`, `favorites`, `profiles` 등 다른 테이블 참조: **없음**
- `supabase.auth` 호출: **없음**
- 생성 TypeScript `Database` 타입 파일: **없음**
- `ingredients` anon RLS 정책 SQL: **마이그레이션에 없음** (런타임 정책은 원격 DB에 있을 수 있으나 저장소만으로는 확인 불가)

---

## 6. Existing Features

코드로 동작이 확인되는 기능만 나열한다.

| 기능 | 구현 위치 | 동작 요약 |
|------|-----------|-----------|
| 랜딩·CTA | `/` | 퀴즈/AI/얼굴탐색/성분 링크, 언어 전환 |
| 피부 퀴즈 | `/quiz` | 5단계 답변 → query (`age`, `tone`, `warmth`, `concern`, `budget`) |
| 제품 목록·필터 | `/results` | DB 로드 후 `tone`/`concern`/`budget` 클라이언트 필터, 검색, 즐겨찾기 |
| AI 배지 | `/results` | `ai=1`이면 UI에 AI 반영 표시 |
| 추천 이유 표시 | `/results` | `recommendation_reason_*` 로케일별 표시 |
| 성분 링크 | `/results` | 첫 성분명을 slug로 변환해 `/ingredients/{slug}` 링크 |
| AI 피부 분석 | `/analyze` | 사진 또는 수동 입력 → Claude → JSON 결과 |
| 분석 결과 저장 | `/analyze` | `localStorage.skinAnalysisResult` |
| 분석→결과 이동 | `/analyze` | `tone`, `concern`(첫 항목), `ai=1` |
| 루틴 | `/routine` | 즐겨찾기 id → 제품 조회 → 카테고리 스텝 매핑, 환율 표시 |
| 얼굴 탐색 | `/face-explorer` | 남/여 이미지·존 오버레이, 정적 concern 매핑 |
| 성분 상세 | `/ingredients/[slug]` | 효과·기전·주의·논문 링크 |
| 다국어 (부분) | hooks + locales + 페이지 내 분기 | `en`/`ja`/`ko` |
| 국가 감지 | `useCountry` | IP 기반 `countryCode` |
| 환율 | `useExchangeRate` | USD 기준 KRW/JPY |
| 사이트맵 | `sitemap.ts` | 정적 + 성분 slug |
| 법적 페이지 | `/privacy`, `/terms` | 정적 문서 |
| AdSense 스크립트 | `layout.tsx` | head에 삽입 |

### localStorage 키 (코드에 등장)

| 키 | 용도 |
|----|------|
| `locale` | 언어 |
| `countryCode` | 국가 코드 |
| `exchangeRates` | 환율 캐시 |
| `favoriteProductIds` | 즐겨찾기 제품 id 배열 |
| `skinAnalysisResult` | AI 분석 결과 JSON |

---

## 7. Existing AI-related Code

### 위치

- **유일 구현 파일**: `src/app/analyze/page.tsx`

### 구현 사실

| 항목 | 값 |
|------|-----|
| API | `https://api.anthropic.com/v1/messages` |
| 모델 | `claude-sonnet-4-20250514` |
| 키 환경변수 | `NEXT_PUBLIC_ANTHROPIC_API_KEY` |
| 호출 주체 | 브라우저 (`fetch` + `anthropic-dangerous-direct-browser-access: true`) |
| 입력 모드 | `photo` (base64 이미지) / `manual` (톤·언더톤·고민·민감도) |
| 파싱 결과 타입 | `skin_type`, `concerns[]`, `ingredients[]`, `summary_en/ko/ja`, `routine_tips[]` |
| 저장 | `localStorage.skinAnalysisResult` |
| 결과 페이지 연동 | `goToResults()` → `/results?tone=&concern=&ai=1` |

### AI와 무관한 유사 표기

- `/results`의 `ai=1`은 배지 표시용이며, AI 응답으로 제품 점수를 다시 계산하는 코드는 **없다**.
- OpenAI / Gemini SDK import: **없음**

---

## 8. Missing Features

아래는 “코드에 없거나, 링크/데이터는 있으나 미완성”인 **관찰된 공백**이다. 비즈니스 로드맵 가정이 아니다.

| 항목 | 근거 |
|------|------|
| 공유 React 컴포넌트 레이어 | `components/` 없음 |
| Next.js API Routes | `route.ts` 없음 |
| 사용자 인증 | `supabase.auth` / 로그인 UI 없음 |
| `/ingredients` 목록 페이지 | 홈 링크는 있으나 `page.tsx` 없음 |
| AI “성분별로 보기” 실제 라우트 | `href="#"` |
| 퀴즈 `age`, `warmth` 결과 반영 | 퀴즈는 query로 보내지만 `results`는 `tone`/`concern`/`budget`만 읽음 |
| AI 추천 성분 → 제품 매칭 | 분석 결과 `ingredients[]`를 products와 조인/스코어링하는 코드 없음 |
| 구매 링크 UI | `link_*` 컬럼은 select하지만 결과 UI에서 링크 렌더 코드 없음 |
| 서버 측 AI 프록시 | 브라우저 직접 Anthropic 호출만 존재 |
| middleware | 파일 없음 |
| DB 생성 타입 | 없음 |
| 테스트 스위트 | `*.test.*` / e2e 설정 저장소에서 확인되지 않음 |
| 사이트맵 일부 페이지 | `/analyze`, `/routine`, `/face-explorer` 미포함 |

---

## 9. Technical Debt

코드에서 확인되는 부채만 기록한다.

1. **AI API 키 공개**  
   `NEXT_PUBLIC_ANTHROPIC_API_KEY` + 브라우저 직접 호출.

2. **대량 클라이언트 로드**  
   `products`를 `.limit(10000)`으로 가져와 브라우저에서 필터.

3. **추천 필터 로직이 페이지에 하드코딩**  
   `matchesTone` / `matchesConcern` / `matchesBudget` 및 예산 구간이 `results/page.tsx`에 고정. DB 규칙 테이블/RPC가 아님.

4. **얼굴 탐색 데이터 하드코딩**  
   `zoneInfo`가 `face-explorer/page.tsx`에 정적 객체로 존재. Supabase 미사용.

5. **루틴 카테고리 매핑 하드코딩**  
   `mapCategoryToStep`이 문자열 포함 여부로 스텝 결정.

6. **컴포넌트 미분리**  
   페이지 파일이 데이터 fetch·필터·UI를 한곳에 보유. 재사용 계층 없음.

7. **i18n 불일치**  
   - 공통 JSON은 약 26키 (`locales/*.json`)  
   - `results`는 자체 `LOCALE_MESSAGES`  
   - `face-explorer`는 한국어 고정 문구 중심  
   - `layout.tsx`의 `<html lang="en">` 고정

8. **퀴즈 파라미터 미소비**  
   `age`, `warmth`가 결과 필터에 미사용.

9. **조회만 하고 미사용인 제품 필드**  
   구매 링크 컬럼들이 select에 포함되나 UI 미연결.

10. **깨진/미완성 내비게이션**  
    `/ingredients` 목록 404 가능, analyze의 `href="#"`.

11. **SEO와 클라이언트 페이지**  
    주요 콘텐츠 페이지가 전부 `"use client"` + 일부 `next/head` 사용. App Router `metadata` export는 루트 layout 중심.

12. **타입 안전성**  
    Supabase 응답을 페이지별 수동 `ProductRow` / `IngredientRow`로 캐스팅. 스키마와 동기화 장치 없음.

---

## 10. Suggestions for Future Development

아래는 위 인벤토리(존재/공백/부채)에 기반한 **개발 제안**이다. 구현 확정이 아니다.

1. **보안 우선**: Anthropic 호출을 `src/app/api/.../route.ts`로 옮기고 서버 전용 키 사용.
2. **내비게이션 수정**: `/ingredients` 목록 추가 또는 홈 링크를 유효한 slug/검색으로 변경. analyze의 `#` 링크 제거 또는 연결.
3. **추천 파이프라인 정리**:  
   - 피부 이해(퀴즈/AI/얼굴) → 성분 → DB 매칭 순으로 데이터 흐름을 명시  
   - 클라이언트 하드코딩 필터를 DB 컬럼/뷰/RPC 또는 서버 조회로 이전
4. **AI 결과 실사용**: `ingredients[]`·다중 `concerns`를 제품 `key_ingredients` / `skin_concern`과 매칭해 정렬.
5. **퀴즈 파라미터 정합**: `age`/`warmth`를 쓰거나, 보내지 않도록 퀴즈·결과 계약을 맞출 것.
6. **공유 컴포넌트 추출**: ProductCard, LocaleSwitcher, LoadingState 등 페이지 간 중복 UI 분리.
7. **구매 링크**: select 중인 `link_*`를 국가/로케일 기준으로 노출할지 결정.
8. **페이지네이션·서버 필터**: 10,000건 일괄 로드 대체.
9. **i18n 통합**: `useLocale` + JSON 키로 화면 문구 통합, `html lang` 동기화.
10. **사이트맵·메타**: 누락 경로 추가, 가능하면 서버 컴포넌트/메타데이터 API로 SEO 강화.
11. **인증·동기화**(필요 시): 즐겨찾기·분석 결과의 localStorage 한계를 서버 저장으로 확장.
12. **문서 동기화**: 스키마·API·AI 변경 시 `docs/04_DB.md`, `docs/05_AI.md`, `docs/06_API.md` 갱신.

---

## 부록 A — 소스 파일 목록 (`src/` 기준)

```text
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/sitemap.ts
src/app/analyze/page.tsx
src/app/face-explorer/page.tsx
src/app/ingredients/[slug]/page.tsx
src/app/privacy/page.tsx
src/app/quiz/page.tsx
src/app/results/page.tsx
src/app/routine/page.tsx
src/app/terms/page.tsx
src/hooks/useCountry.ts
src/hooks/useExchangeRate.ts
src/hooks/useLocale.ts
src/lib/supabase.ts
src/locales/en.json
src/locales/ja.json
src/locales/ko.json
```

## 부록 B — 의존성 (`package.json` dependencies)

- `next` 16.1.6  
- `react` 19.2.3  
- `react-dom` 19.2.3  
- `@supabase/supabase-js` ^2.99.1  

Anthropic 공식 SDK 패키지: **없음** (브라우저 `fetch` 직접 호출)

## 부록 C — 조사 방법

- `src/**/*.{ts,tsx,json}` 전수 목록
- `components/`, `api/`, `middleware.ts`, `route.ts` 존재 여부 검색
- `.from("...")`, `supabase.auth`, `anthropic`, `localStorage`, `Link href` 검색
- `supabase/migrations/*.sql` 내용 확인
- `package.json`, `tsconfig.json` (`strict: true`) 확인

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-11 | 최초 기술 인벤토리 작성 |
