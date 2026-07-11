# 03. Architecture — 시스템 아키텍처

## 개요

현재 시스템은 **Next.js 클라이언트 중심 앱**이다.  
브라우저가 Supabase(읽기)와 Anthropic(AI 분석)을 직접 호출하며, 서버 API 계층과 사용자 인증은 아직 없다.

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | `src/app` |
| UI | React 19, Tailwind CSS 4 | 클라이언트 페이지 중심 |
| DB/BaaS | Supabase | `@supabase/supabase-js` |
| AI | Anthropic Claude | 브라우저 직접 호출 |
| i18n | 커스텀 훅 + JSON | `en` / `ja` / `ko` |
| 상태 | `localStorage` | 계정 없음 |

## 폴더 구조 (요약)

```text
src/
  app/          # 라우트·페이지
  hooks/        # locale, country, exchange rate
  lib/          # supabase 클라이언트
  locales/      # 번역 JSON
supabase/
  migrations/   # DB 마이그레이션
docs/           # 프로젝트 문서
public/         # 정적 자산
```

## 현재 데이터 흐름

```text
[브라우저]
  ├─ Quiz / Face Explorer / Analyze
  ├─ Results ← Supabase products (anon read)
  ├─ Ingredients ← Supabase ingredients
  ├─ Routine ← localStorage favorites + products
  └─ Analyze ← Anthropic API (공개 키)
```

## 라우팅 구조

| 경로 | 역할 |
|------|------|
| `/` | 랜딩 |
| `/quiz` | 설문 |
| `/results` | 제품 결과·필터 |
| `/analyze` | AI 피부 분석 |
| `/routine` | 즐겨찾기 루틴 |
| `/face-explorer` | 얼굴 부위 탐색 |
| `/ingredients/[slug]` | 성분 상세 |
| `/privacy`, `/terms` | 법적 페이지 |
| `/sitemap.xml` | 사이트맵 |

## 레이어 구분 (현재)

1. **Presentation**: `src/app/**/page.tsx`
2. **Client utilities**: `src/hooks`, `src/lib`
3. **External services**: Supabase, Anthropic, ipapi.co, 환율 API
4. **Persistence (클라이언트)**: `localStorage`

## 부재 중인 계층

- API Route / BFF
- 인증·세션
- middleware (locale, auth)
- 서버 전용 Supabase 클라이언트
- 생성 DB 타입 (`Database` types)

## 목표 아키텍처 (초안)

```text
[브라우저]
  → Next.js Server / API Routes
    → Supabase (RLS + 서버 키 필요 시)
    → Anthropic (서버 전용 키)
  → 인증 세션 (TODO)
```

- TODO: 서버 컴포넌트 vs 클라이언트 컴포넌트 경계 확정
- TODO: 캐싱·ISR·CDN 전략 확정
- TODO: 관측성(로깅, 에러 트래킹) 도구 확정
