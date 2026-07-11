# 06. API — API 설계

## 개요

현재 프로젝트에는 **Next.js API Route (`route.ts`)가 없다.**  
클라이언트는 Supabase와 Anthropic을 브라우저에서 직접 호출한다.

이 문서는 **현재 외부 호출**과 **향후 내부 API 초안**을 정리한다.

## 현재 외부 연동

### Supabase (PostgREST)

| 용도 | 호출 위치 | 비고 |
|------|-----------|------|
| `products` 조회 | `/results`, `/routine` | anon SELECT |
| `ingredients` 조회 | `/ingredients/[slug]`, sitemap | slug 기반 |

- 인증 헤더: anon key
- TODO: 페이지네이션·서버 필터 API 도입 여부

### Anthropic Messages API

| 항목 | 내용 |
|------|------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| 호출 위치 | `/analyze` |
| 인증 | `NEXT_PUBLIC_ANTHROPIC_API_KEY` (개선 필요) |

### 기타

| 서비스 | 용도 | 호출 위치 |
|--------|------|-----------|
| ipapi.co | 국가 코드 감지 | `useCountry` |
| 환율 API | USD 환산 | `useExchangeRate` |

- TODO: 환율 API 제공자·엔드포인트 확정 문서화

## 내부 API (계획 — 미구현)

아래는 목표 설계 초안이다. 아직 코드에 존재하지 않는다.

### `POST /api/analyze`

- 역할: 피부 분석 (서버에서 Anthropic 호출)
- 입력: 이미지 또는 피부 정보 JSON
- 출력: 분석 결과 스키마
- TODO: 요청/응답 타입 확정
- TODO: rate limit·인증 필요 여부

### `GET /api/products`

- 역할: 서버 측 필터·페이지네이션 제품 조회
- 쿼리: `tone`, `concern`, `budget`, `q`, `page`
- TODO: 응답 포맷·캐시 헤더

### `GET /api/ingredients/[slug]`

- 역할: 성분 상세 (SSR/SEO용)
- TODO: 필요 여부 확정 (현재 클라이언트 직접 조회)

### `POST /api/recommend` (후보)

- 역할: AI/규칙 기반 재랭킹
- 입력: 피부 프로필 + 후보 제품 ID
- TODO: 스코어링 알고리즘 정의

## 인증 API (후보)

- TODO: Supabase Auth 사용 여부
- TODO: `signUp` / `signIn` / `signOut` / OAuth 범위
- TODO: 세션 쿠키 전략 (`@supabase/ssr`)

## 에러·버전 규칙

- TODO: 공통 에러 응답 포맷 (`code`, `message`)
- TODO: API 버전 전략 (`/api/v1` 여부)
- TODO: CORS·보안 헤더 정책
