# AI Analysis Current State — `/analyze`

> 대상 파일: `src/app/analyze/page.tsx`만  
> 조사일: 2026-07-11  
> 코드 변경 없음. 이 문서의 설명은 해당 파일에 실제로 존재하는 동작만 기준으로 한다.

---

## 1. How the AI analysis starts

분석은 사용자가 **「AI 분석 시작」** 버튼을 누를 때 시작된다. 자동 실행은 없다.

### 모드

페이지는 두 가지 입력 모드를 가진다 (`InputMode`).

| 모드 | UI 라벨 | 시작 핸들러 |
|------|---------|-------------|
| `photo` (기본값) | 사진으로 분석하기 | `handleAnalyzePhoto` |
| `manual` | 직접 입력해서 시작하기 | `handleAnalyzeManual` |

### 사진 모드 시작 조건

1. 파일 선택 또는 드래그앤드롭 → `handleFile` / `handleDrop`
2. `FileReader.readAsDataURL`로 미리보기·base64 저장 (`imageBase64`)
3. `imageBase64`가 있고 `loading === false`일 때만 버튼 활성 (`canAnalyzePhoto`)
4. 버튼 클릭 → `handleAnalyzePhoto` → `callAnthropic(...)`

사진이 없으면 에러 메시지를 띄우고 API를 호출하지 않는다.

### 수동 모드 시작 조건

1. 피부톤·언더톤·주요 고민·민감도 선택 (기본값: 중간 / 중립 / 붉은기 / 보통)
2. 버튼 클릭 → `handleAnalyzeManual` → `callAnthropic(payload)`
3. 사진과 달리 입력값 검증으로 API를 막는 분기는 없다 (`loading` 중만 비활성)

### 마운트 시 동작

- `localStorage.skinAnalysisResult`가 있으면 JSON을 읽어 `result` state에 복원한다.
- 이 복원은 **API를 다시 호출하지 않는다.**

---

## 2. Which API is called

| 항목 | 값 |
|------|-----|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Method | `POST` |
| 호출 위치 | 브라우저 (`fetch`) |
| 래퍼 함수 | `callAnthropic` |

### 요청 헤더

- `Content-Type: application/json`
- `x-api-key: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY`
- `anthropic-version: 2023-06-01`
- `anthropic-dangerous-direct-browser-access: true`

### 키 미설정 시

`NEXT_PUBLIC_ANTHROPIC_API_KEY`가 없으면 `callAnthropic`이  
`"Anthropic API key is not configured."` 에러를 throw한다.

### 이 페이지에서 호출하지 않는 것

- Next.js API Route: 없음
- Supabase: import·호출 없음
- OpenAI 등 다른 AI 제공자: 없음

---

## 3. Which model is used

| 항목 | 값 |
|------|-----|
| 모델 ID | `claude-sonnet-4-20250514` |
| `max_tokens` | `700` |
| 적용 범위 | 사진 모드·수동 모드 동일 |

모델 문자열은 `handleAnalyzePhoto` / `handleAnalyzeManual`의 payload에 하드코딩되어 있다.

---

## 4. Which prompt is used

프롬프트는 **system** + **user message** 구조다. 모드별로 system 문장이 거의 같고, user 내용만 다르다.

### 공통 system (사진)

```text
You are a K-beauty skincare information guide. Based on the skin photo provided, analyze and respond ONLY in JSON: {"skin_type": "string", "concerns": ["string"], "ingredients": ["string"], "summary_ko": "Korean summary", "summary_en": "English summary", "summary_ja": "Japanese summary", "routine_tips": ["string"]}
```

### 공통 system (수동)

```text
You are a K-beauty skincare information guide. Based on the skin information provided, analyze and respond ONLY in JSON: {"skin_type": "string", "concerns": ["string"], "ingredients": ["string"], "summary_ko": "Korean summary", "summary_en": "English summary", "summary_ja": "Japanese summary", "routine_tips": ["string"]}
```

차이: `"Based on the skin photo provided"` vs `"Based on the skin information provided"`.

### User — 사진 모드

- text: `"Analyze this skin photo and return JSON only."`
- image: base64, `media_type: "image/jpeg"` (실제 파일 형식과 무관하게 jpeg로 고정)

### User — 수동 모드

```text
Skin info (Korean labels):
- skin_tone: {manualTone}
- undertone: {manualUndertone}
- main_concerns: {manualConcerns.join(", ")}
- sensitivity: {manualSensitivity}
Return JSON only.
```

예: `skin_tone: 중간`, `undertone: 중립`, `main_concerns: 붉은기, 건조함`, `sensitivity: 보통`

### 기대 JSON 스키마 (`AnalysisResult`)

| 필드 | 타입 |
|------|------|
| `skin_type` | `string` |
| `concerns` | `string[]` |
| `ingredients` | `string[]` |
| `summary_en` | `string` |
| `summary_ko` | `string` |
| `summary_ja` | `string` |
| `routine_tips` | `string[]` |

---

## 5. How the response is parsed

파싱은 전부 `callAnthropic` 안에서 수행된다.

```text
HTTP 응답
  → response.json()
  → content[0].text (또는 text_value)
  → JSON.parse(전체 텍스트)
  → 실패 시 정규식 /\{[\s\S]*\}/ 로 첫 JSON 객체 추출 후 재파싱
  → AnalysisResult로 반환
```

### 실패 조건

| 조건 | 에러 메시지 |
|------|-------------|
| HTTP not ok | `Anthropic API error: {status} {body}` |
| content 텍스트 없음 | `No content returned from Anthropic.` |
| JSON 파싱 실패 | `Failed to parse analysis result.` |

### 검증하지 않는 것

- 필드 존재 여부·타입 런타임 검증 없음
- `concerns` / `ingredients` 허용 값 enum 검증 없음
- Zod 등 스키마 라이브러리 없음

성공 시 `setResult(parsed)`로 state에 넣고, `useEffect`가 `localStorage.skinAnalysisResult`에 문자열로 저장한다.

---

## 6. How recommendations are generated

이 페이지에서 “추천”은 **두 층**으로 나뉜다.

### A. AI가 생성하는 추천 (페이지 내부)

모델 JSON의 다음 필드가 UI에 그대로 표시된다.

| UI 라벨 | 데이터 필드 |
|---------|-------------|
| 피부 타입 | `skin_type` |
| 주요 고민 | `concerns` |
| 추천 성분 | `ingredients` |
| 루틴 가이드 | `routine_tips` |
| 요약 | `summary_ko` / `summary_en` / `summary_ja` (`useLocale`의 locale 기준) |

즉, **성분·루틴 팁 추천 문구는 모델 출력을 그대로 보여 주는 것**이며, 이 페이지에서 제품 목록을 만들거나 점수를 매기지 않는다.

### B. “제품 정보 보기”로 이어지는 쿼리 (`goToResults`)

분석 결과가 있을 때 `/results`로 이동하며, query는 다음과 같다.

| 파라미터 | 값 결정 방식 |
|----------|----------------|
| `tone` | 수동 모드: `toneKoToResultsTone(manualTone)` → `Light`/`Medium`/`Dark`  
| | 사진 모드: **항상 `"Medium"`** (코드 주석: 기본값) |
| `concern` | 수동: 첫 번째 수동 고민을 영문 매핑 (`붉은기`→`Redness` 등)  
| | 사진: `result.concerns[0]` 문자열 그대로 (없으면 `"Redness"`) |
| `ai` | 항상 `"1"` |

이 페이지는 `/results`의 필터·정렬을 수행하지 않는다.  
제품 후보는 analyze 밖에서 query 필터로 결정된다.

### C. 이 페이지가 하지 않는 추천

- `ingredients[]`와 DB 성분/제품 조인: **없음**
- 다중 고민 weighted score: **없음**
- 제품 ID 목록 생성: **없음**
- `/routine` 링크는 단순 이동이며, 분석 결과를 쿼리로 넘기지 않음
- “성분별로 보기”는 `href="#"`로 **미연결**

---

## 7. Which data comes from Supabase

**없음.**

`src/app/analyze/page.tsx`는 `@/lib/supabase`를 import하지 않으며,  
`.from("products")` / `.from("ingredients")` 호출이 없다.

이 페이지의 데이터 출처:

| 출처 | 내용 |
|------|------|
| 사용자 입력 | 사진 base64, 수동 피부 정보 |
| Anthropic API | 분석 JSON |
| `localStorage` | 이전 분석 결과 복원/저장 |
| `useLocale` | 요약 언어 선택 (`summary_*`) |

---

## 8. Current limitations

코드에서 확인되는 한계만 나열한다.

1. **API 키 브라우저 노출**  
   `NEXT_PUBLIC_ANTHROPIC_API_KEY` + `anthropic-dangerous-direct-browser-access`.

2. **서버 프록시 없음**  
   rate limit·키 은닉·요청 검증을 서버에서 할 수 없다.

3. **제품/성분 DB와 미연결**  
   AI `ingredients`가 Supabase와 매칭되지 않는다.

4. **사진 모드 tone 고정**  
   결과 이동 시 tone이 항상 `Medium`.

5. **사진 모드 concern 정규화 없음**  
   `result.concerns[0]`을 영문 enum으로 매핑하지 않고 그대로 query에 넣는다.  
   (수동 모드만 `concernKoToParam` 사용)

6. **이미지 media_type 고정**  
   업로드가 png 등이어도 `image/jpeg`로 전송한다.

7. **응답 스키마 미검증**  
   잘못된/부분 JSON도 필드 검사 없이 UI에 들어갈 수 있다.

8. **max_tokens 700**  
   긴 다국어 요약·다수 팁이 잘릴 수 있다.

9. **면책 문구는 UI에만 존재**  
   system prompt에 의료 진단 금지 등 상세 가드레일이 거의 없다.  
   (UI 카피에 “의료적 진단이 아님” 문구는 있음)

10. **미완성 CTA**  
    “성분별로 보기” → `#`  
    `clearResult` 함수는 정의되어 있으나 UI에서 호출되지 않음.

11. **분석 결과가 루틴 페이지로 전달되지 않음**  
    `/routine`은 즐겨찾기 기반이며 analyze 결과와 무관.

12. **SEO**  
    `"use client"` + `next/head` 사용. App Router `metadata` export 없음.

---

## 9. What should be improved

현재 구조의 공백에 맞춘 개선 방향 (구현 지시가 아님).

1. **서버 API Route로 Anthropic 호출 이전** — 키 은닉, 남용 방지.
2. **응답 JSON 스키마 검증** — 필수 필드·타입·허용 concern 값 정규화.
3. **AI 성분 ↔ Supabase `ingredients` / `products.key_ingredients` 매칭** — 설명은 AI, 후보는 DB.
4. **`goToResults` 파라미터 정합** — 사진 모드 tone/concern을 결과 필터 계약에 맞게 매핑.
5. **실제 이미지 MIME 전달** — jpeg 고정 제거.
6. **“성분별로 보기”를 유효 라우트로 연결** — 예: 매칭된 ingredient slug 목록.
7. **프롬프트 가드레일 강화** — 진단 금지, JSON-only, 언어별 요약 품질.
8. **분석 결과 활용 범위 확대** — 다중 concerns, ingredients 전체를 추천 파이프라인에 전달.
9. **결과 초기화 UI** — `clearResult`를 사용자 액션에 연결할지 결정.
10. **관측성** — 실패율·토큰·지연 시간 로깅 (서버 이전 후).

---

## 10. Which parts should remain unchanged

개선 시에도 **의도적으로 유지할 가치가 있는** 현재 설계 요소.

1. **의료 진단이 아닌 정보 가이드**라는 제품 포지션  
   헤더·면책 문구의 방향성.

2. **피부 이해 → (이후) 제품 탐색** 흐름  
   분석 화면에서 바로 결제/쇼핑몰이 아닌, 정보·결과 페이지로 이어지는 CTA 구조.

3. **이중 입력 모드**  
   사진 / 수동 입력 모두 제공하는 UX.

4. **다국어 요약 필드**  
   `summary_ko` / `summary_en` / `summary_ja`를 한 응답에 포함하는 스키마.

5. **구조화된 결과 카드**  
   피부 타입 · 고민 · 추천 성분 · 루틴 팁 · 요약의 정보 구조.

6. **JSON-only 응답 요구**  
   자유 텍스트보다 파싱 가능한 출력을 강제하는 system 지시 방향.

7. **텍스트 결과의 localStorage 저장**  
   (보안·동기화는 개선 대상이나) 재방문 시 결과 복원 UX 자체.

8. **AI가 제품 SKU를 직접 고르지 않는 현재 분리**  
   이 페이지는 피부/성분 인사이트를 만들고, 제품 목록은 `/results`로 넘긴다.  
   “DB가 제품 후보를 결정한다”는 프로젝트 철학과 맞는 경계이므로,  
   개선 시에도 **AI가 임의 제품명을 하드코딩해 반환하게 만들기보다**,  
   성분·고민 신호를 DB 매칭에 넘기는 쪽을 유지하는 것이 바람직하다.

---

## 부록 — 데이터 흐름 요약

```text
[사용자]
  ├─ 사진 업로드 또는 수동 피부 정보
  └─ 「AI 분석 시작」
        ↓
[브라우저] callAnthropic
        ↓
POST https://api.anthropic.com/v1/messages
  model: claude-sonnet-4-20250514
        ↓
JSON AnalysisResult
        ↓
UI 표시 + localStorage.skinAnalysisResult
        ↓ (선택) 「제품 정보 보기」
/results?tone=...&concern=...&ai=1
        ↓
(analyze 페이지 밖) Supabase products 필터
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-11 | `/analyze` 현재 동작 문서화 |
