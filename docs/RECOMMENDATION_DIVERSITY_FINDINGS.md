# 추천 고정·카탈로그 현황 조사 (2026-07-16)

Production 승인 **보류** 상태에서 조사. DB 쓰기·배포 없음.

## 1. 추천이 고정되어 보이는 원인 (우선순위)

### A. 공개 추천 풀이 극소 (가장 큼)

| 환경 | 전체 제품 | 공개 추천 가능 (`active` ∧ `verified_at`) | 공개 브랜드 |
|------|----------:|------------------------------------------:|------------:|
| **Production** | 191 | **2** | **1** (COSRX) |
| **Staging** (Preview 연결) | 11 | **9** | **1** (COSRX) |

Production 공개 2건:
- id 4 — COSRX Snail Mucin 96% Power Repairing Essence
- id 28 — COSRX Advanced Snail 92 All in One Cream

코드: `fetchCandidateProducts`가 `.eq("active", true).not("verified_at", "is", null)`만 조회  
→ 분석/문진이 달라도 **후보가 2~9개뿐**이면 Top 결과가 거의 같음.

A안 신규 id 188~192는 `verified_at` NULL → **의도적으로 미노출**.

### B. KR offer 게이트 + 매칭 증거 (보조)

핵심 Top5는 `verified` + `in_stock` + KR 배송 offer가 있는 제품만 통과하고,  
`score > 0` 이면서 **매칭 성분 1개 이상**이 필요하다.  
공개 제품이 있어도 offer/성분이 없으면 Top5에서 탈락 → 남는 소수만 반복.

### C. 퀴즈·피부타입·부위가 Top5에 거의 안 들어감

- Top5는 **analyze → `persistTopRankedProducts`** 때만 갱신·localStorage 저장
- `/quiz` URL(`tone`/`concern`/`budget`)은 `/results` **탐색 목록**만 필터 → Top5 재랭킹 안 함
- `rankProducts`는 추천 성분·고민 태그·회피 성분을 쓰고, **`skinType`·부위(areas)·`skin_tone`은 점수에 미사용**
- Evidence가 고민별 성분을 앞에 병합 → 비슷한 고민이면 성분 세트가 수렴

### D. 브라우저 localStorage 캐시

- 키: `skinRecommendation`, `skinRankedProducts`, `recommendationCacheVersion`
- 버전: `KR_MATCH_EVIDENCE_V4` (V3에서 상향 · skin_concern 보강 반영)
- 이전 분석 결과가 남으면 같은 카드가 반복될 수 있음 (강력 새로고침·시크릿 창으로 확인)

### E. mock 분석 (개발만 · Production 금지)

- `AI_PROVIDER=mock` → 고정 톤의 mock 고민/성분 (`analyzeWithMock.ts`)
- Production에서 mock **차단** (`env.ts` / `analyzeSkin.ts`)
- `MOCK_RECOMMENDATION`은 개발 경로용 · 프로덕션 자동 호출 없음
- 개발에서 Ollama 실패 시 mock 폴백 가능 (`tryOllamaThenMock`)
- 하드코딩된 Top5 제품 ID 목록은 **없음**

→ **라이브 Production이 mock 때문에 고정된 것은 아님.**  
→ **고정 체감의 핵심은 공개 검수 제품 풀 부족 + 단일 브랜드 + (있으면) KR offer/성분 게이트.**

## 2. mock / 임시 분석 사용 여부

| 경로 | Production | 개발/Preview |
|------|:----------:|:------------:|
| `AI_PROVIDER=mock` | 거부 (500 CONFIG) | 허용 |
| Ollama 실패 → mock | 불가 | 개발 기본 폴백 가능 |
| `MOCK_RECOMMENDATION` 객체 | 자동 미사용 | 테스트용 |

Production Vercel에 `AI_PROVIDER` 키는 **존재**(Encrypted). 값이 mock인지는 대시보드에서만 확인(후순위).

## 3. 제품·브랜드 수

### Production (읽기)
- 전체 191 · 브랜드 55
- **공개 추천 2 · 브랜드 1**
- 카테고리(전체, 미공개 포함): Serum 51 · Cream 42 · Toner 25 · Essence 12 …

### Staging
- 전체 11 · 공개 9 · 브랜드 1 (전부 COSRX)

### Staging heroes/라벨 (이전 상태 문서)
- heroes ~84 · with_inci 57 · official_matched 58 — 다수는 `needs_review`/미공개로 **추천 풀 밖**

## 4. 고민·타입·부위 매핑 (Staging 공개 9)

| 제품 | category | skin_concern |
|------|----------|--------------|
| Snail 96 | essence | dryness, redness |
| Good Morning Gel | foam_cleanser | (비어 있음) |
| AHA/BHA Toner | toner | pores, acne |
| Hydrium Toner | toner | (비어 있음) |
| Niacinamide 15 | serum | acne, pores, pigmentation |
| Vitamin C 23 | serum | (비어 있음) |
| 6 Peptide | serum | (비어 있음) |
| Snail 92 | cream | dryness, redness |
| Retinol 0.1 | cream | antiaging, wrinkle |

**빈 매핑 다수** → 랭킹이 성분·Evidence에 더 의존하고, 고민이 달라도 같은 COSRX 풀로 수렴하기 쉬움.  
메이크업/헤어 부위 문진용 공개 제품은 Staging/Production 공개 풀에 **거의 없음**.

## 5. 다음 단일 작업 (Production 보류 유지)

**다양한 한국 브랜드·카테고리 데이터 확대** — Staging 우선, Search-to-Verified, 자동 `verified`/`published` 금지.

이후: 조건별 추천 비교 테스트 → 이미지·판매처·성분 검증 → (맨 마지막) Production env/Auth → Preview → Production 승인.
