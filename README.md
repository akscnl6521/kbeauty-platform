# K-Beauty Match

**AI-powered Global Skincare Intelligence Platform**

> 이 프로젝트는 **온라인 쇼핑몰이 아닙니다.**  
> K-Beauty Match는 피부를 이해하고, 성분을 먼저 매칭한 뒤, 데이터 기반으로 제품을 추천하는 **글로벌 스킨케어 인텔리전스 플랫폼**입니다.

---

## Project Overview

**K-Beauty Match**는 전 세계 사용자를 위한 AI 기반 K-뷰티 스킨케어 추천·분석 플랫폼입니다.

사용자는 피부 톤, 고민, 예산, AI 피부 분석, 얼굴 부위 탐색, 성분 정보를 통해  
자신에게 맞는 한국 스킨케어를 **근거 있게** 발견할 수 있습니다.

플랫폼의 핵심은 판매가 아니라 **피부 이해 → 성분 매칭 → 제품 추천 → AI 설명**의 흐름입니다.

| 구분 | 설명 |
|------|------|
| 제품 유형 | AI 스킨케어 인텔리전스 플랫폼 |
| 대상 | 글로벌 사용자 (EN / JA / KO) |
| 데이터 | Supabase (`products`, `ingredients`) |
| AI | Anthropic Claude 기반 피부 분석 |
| 프론트엔드 | Next.js App Router |

상세 설계 문서는 [`docs/`](./docs/)를 참고하세요.

---

## Vision

세계 최고의 **AI-powered K-Beauty 플랫폼**을 구축한다.

- 누구나 자신의 피부를 이해하고, 적합한 성분과 제품을 찾을 수 있게 한다.
- 추천은 감이 아니라 **데이터베이스와 성분 근거**에 기반한다.
- AI는 추천을 “대신 결정”하는 것이 아니라, **왜 맞는지 설명**한다.
- 글로벌 사용자가 언어 장벽 없이 K-뷰티를 탐색할 수 있게 한다.

---

## Mission

1. 전 세계 사용자가 **자신의 피부에 맞는** 한국 스킨케어를 쉽게 찾도록 돕는다.
2. 설문·얼굴 탐색·AI 분석을 통해 개인화 추천의 진입 장벽을 낮춘다.
3. **성분을 제품보다 먼저** 이해하고, 신뢰할 수 있는 선택 근거를 제공한다.
4. 영어·일본어·한국어를 기본으로 글로벌 접근성을 유지한다.
5. 의료 진단을 대체하지 않으며, 과장 없는 스킨케어 인텔리전스를 제공한다.

---

## Main Features

### 현재 제공 기능

| 기능 | 경로 | 설명 |
|------|------|------|
| 랜딩 | `/` | 브랜드 소개 및 주요 진입점 |
| 피부 퀴즈 | `/quiz` | 피부 톤·고민·예산 기반 설문 |
| 제품 결과 | `/results` | DB 기반 필터·검색·즐겨찾기 |
| AI 피부 분석 | `/analyze` | 사진/입력 기반 피부·성분 인사이트 |
| 루틴 구성 | `/routine` | 즐겨찾기 제품의 카테고리별 루틴 |
| 얼굴 탐색 | `/face-explorer` | 얼굴 부위별 고민 → 결과 연결 |
| 성분 상세 | `/ingredients/[slug]` | 성분 효과·기전·주의·연구 정보 |
| 법적 페이지 | `/privacy`, `/terms` | 개인정보·이용약관 |

### 핵심 사용자 여정

```text
피부 이해 (Quiz / Analyze / Face Explorer)
    → 성분 인사이트
    → DB 기반 제품 매칭
    → AI 설명 / 루틴 구성
```

---

## Technology Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript |
| Database / BaaS | Supabase (PostgreSQL) |
| AI | Anthropic Claude |
| i18n | `en` / `ja` / `ko` (커스텀 훅 + JSON) |
| 상태 (현재) | Browser `localStorage` (계정 없음) |

### 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

### 주요 환경변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (공개용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. 관리자·워커 경로에서만 사용 |
| `AI_PROVIDER` | `openai` 또는 `anthropic`. production에서 `mock` 금지 |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | 서버 전용 AI 키 |

전체 목록은 [`.env.example`](./.env.example)을 참고하세요.

> **AI 키에 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.** 해당 접두사는 값을 브라우저 번들에 포함시킵니다.
> 과거 `NEXT_PUBLIC_ANTHROPIC_API_KEY`를 사용하던 구조는 서버 전용 `ANTHROPIC_API_KEY`로 이전 완료되었습니다
> (`src/lib/ai/analyzeWithAnthropic.ts`). 시크릿은 저장소에 커밋하지 않습니다.

---

## Folder Structure

```text
kbeauty-platform/
├─ docs/                      # 프로젝트 문서 (Vision, Architecture, DB, AI 등)
├─ public/                    # 정적 자산
├─ src/
│  ├─ app/                    # Next.js App Router 페이지
│  │  ├─ analyze/             # AI 피부 분석
│  │  ├─ face-explorer/       # 얼굴 부위 탐색
│  │  ├─ ingredients/[slug]/ # 성분 상세
│  │  ├─ quiz/                # 피부 퀴즈
│  │  ├─ results/             # 제품 결과
│  │  ├─ routine/             # 루틴
│  │  ├─ privacy/ · terms/    # 법적 페이지
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  └─ sitemap.ts
│  ├─ hooks/                  # useLocale, useCountry, useExchangeRate
│  ├─ lib/                    # supabase 클라이언트
│  └─ locales/                # en / ja / ko 번역
└─ supabase/
   └─ migrations/             # DB 마이그레이션
```

---

## Development Philosophy

K-Beauty Match는 다음 철학으로 개발합니다.

1. **Understand skin before recommending products**  
   피부를 이해하기 전에 제품을 추천하지 않는다.
2. **Recommend ingredients before products**  
   성분 적합성을 제품 나열보다 우선한다.
3. **AI explains recommendations**  
   AI는 추천의 근거를 설명하고, 최종 매칭은 데이터가 결정한다.
4. **Database determines recommendations**  
   추천 로직을 코드에 하드코딩하지 않는다.
5. **Reusable components & TypeScript strict**  
   재사용 가능한 구조와 엄격한 타입을 유지한다.
6. **Supabase architecture**  
   제품·성분 마스터 데이터의 단일 진실 원천을 유지한다.
7. **Mobile-first / SEO-first**  
   모바일 경험과 검색 유입을 우선한다.
8. **Never break existing code**  
   기존 동작을 깨뜨리지 않고 점진적으로 개선한다.
9. **Explain before modifying**  
   구현 전 계획을 설명하고, 시니어 아키텍트처럼 설계한다.

---

## AI Architecture

### 현재 (As-Is)

```text
사용자 입력 (사진 / 피부 정보)
    → Anthropic Claude 분석
    → 피부 타입 · 고민 · 추천 성분 · 다국어 요약
    → localStorage 저장
    → /results 로 일부 파라미터 전달
```

- 구현 위치: `src/app/analyze/page.tsx`
- AI는 피부 인사이트와 성분 힌트를 생성한다.
- 제품 최종 후보는 Supabase `products` 데이터와 필터로 결정한다.

### 목표 (To-Be)

```text
브라우저
  → Next.js API Route (/api/analyze 등)
  → 서버 전용 AI 키
  → 스키마 검증된 분석 결과
  → 성분 매칭 · DB 스코어링 · 추천 이유 설명
```

### AI 역할 경계

| AI가 하는 일 | AI가 하지 않는 일 |
|--------------|-------------------|
| 피부 이해 보조 | 의료 진단·처방 |
| 성분 힌트 제공 | 추천 결과 하드코딩 |
| 추천 이유 설명 | 비밀키를 브라우저에 노출 |

자세한 내용은 [`docs/05_AI.md`](./docs/05_AI.md)를 참고하세요.

---

## Database

데이터 저장소는 **Supabase (PostgreSQL)** 입니다.

### 주요 테이블

| 테이블 | 역할 |
|--------|------|
| `products` | 제품 마스터 (톤·고민·가격·성분·추천 이유·다국어) |
| `ingredients` | 성분 마스터 (효과·기전·주의·연구·다국어·slug) |

### 원칙

- 추천의 근거는 DB 데이터에 둔다.
- 브라우저에서는 anon 키 + RLS를 사용한다.
- 스키마 변경은 `supabase/migrations/`와 [`docs/04_DB.md`](./docs/04_DB.md)에 반영한다.
- 다국어 텍스트는 `*_ko` / `*_ja` / 기본(영문) 컬럼 패턴을 따른다.

---

## Roadmap

| Phase | 목표 | 주요 과제 |
|-------|------|-----------|
| **Phase 1** | 안정화 & 보안 | AI 서버 API 이전, 깨진 링크/사이트맵 정리, 시크릿 관리 |
| **Phase 2** | 추천 품질 | 성분 매칭, 다중 고민 스코어링, 서버 필터·페이지네이션 |
| **Phase 3** | 계정 & 동기화 | Auth, 즐겨찾기·분석 이력 서버 저장 |
| **Phase 4** | 글로벌 & SEO | locale 라우팅, 번역 통합, SEO 메타 강화 |
| **Phase 5** | 고도화 | 벡터 검색, 대화형 RAG, 루틴 성분 충돌 분석 |

상세 체크리스트는 [`docs/07_Roadmap.md`](./docs/07_Roadmap.md)를 참고하세요.

---

## Future Goals

- AI 분석 결과가 배지가 아니라 **실제 제품 랭킹**에 반영되도록 한다.
- **성분 우선 추천 엔진**을 고도화한다.
- 계정 기반으로 즐겨찾기·피부 프로필·분석 이력을 동기화한다.
- pgvector 기반 의미 검색과 대화형 스킨케어 어시스턴트를 도입한다.
- Mobile-first / SEO-first 기준으로 글로벌 유입을 확대한다.
- 제휴·수익화는 추천 신뢰도를 해치지 않는 범위에서만 검토한다.
- **세계 최고의 AI K-Beauty Intelligence Platform**으로 확장한다.

---

## Development Rules

모든 기여자와 AI 어시스턴트는 다음 규칙을 따릅니다.

1. 구현 전 **계획을 먼저 설명**한다.
2. 기존 코드를 **깨뜨리지 않는다.**
3. 추천 로직을 **하드코딩하지 않는다.** (DB가 결정)
4. **피부 → 성분 → 제품** 순서를 지킨다.
5. AI는 추천을 **설명**하고, 데이터는 추천을 **결정**한다.
6. TypeScript strict, 재사용 컴포넌트, Supabase 아키텍처를 유지한다.
7. Mobile-first / SEO-first로 설계한다.
8. 시크릿을 커밋하지 않으며, AI 키는 서버 측 사용을 지향한다.
9. 아키텍처·DB·AI·API 변경 시 `docs/`를 함께 갱신한다.
10. 시니어 소프트웨어 아키텍트처럼 설계하고, 범위를 최소화한다.

전체 규칙은 [`docs/02_ProjectRule.md`](./docs/02_ProjectRule.md)를 기준으로 합니다.

---

## Documentation Index

| 문서 | 내용 |
|------|------|
| [`docs/01_Vision.md`](./docs/01_Vision.md) | 비전·미션 |
| [`docs/02_ProjectRule.md`](./docs/02_ProjectRule.md) | 프로젝트 규칙 |
| [`docs/03_Architecture.md`](./docs/03_Architecture.md) | 시스템 아키텍처 |
| [`docs/04_DB.md`](./docs/04_DB.md) | 데이터베이스 |
| [`docs/05_AI.md`](./docs/05_AI.md) | AI 통합 |
| [`docs/06_API.md`](./docs/06_API.md) | API 설계 |
| [`docs/07_Roadmap.md`](./docs/07_Roadmap.md) | 로드맵 |

---

## License

Private project. 무단 복제·배포를 금합니다.
