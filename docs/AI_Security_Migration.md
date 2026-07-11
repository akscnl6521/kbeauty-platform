# AI Security Migration Plan — Anthropic 브라우저 직접 호출 제거

> 작성일: 2026-07-11  
> 상태: **문서만** (소스 코드·`.env.local` 미변경)  
> 관련 현황: [`docs/AIAnalysis_Current.md`](./AIAnalysis_Current.md)  
> 주의: 이 문서에 **시크릿 실제 값을 적지 않는다.** 변수 **이름**만 사용한다.

---

## 현재 호출 흐름 (As-Is)

```text
브라우저 (/analyze)
  → fetch("https://api.anthropic.com/v1/messages")
  → Header: x-api-key = NEXT_PUBLIC_ANTHROPIC_API_KEY
  → Header: anthropic-dangerous-direct-browser-access: true
  → 모델 응답 JSON 파싱 → UI / localStorage
```

Next.js API Route는 현재 존재하지 않는다.

---

## 1. Why calling Anthropic directly from the browser is insecure

브라우저에서 Anthropic을 직접 호출하는 것은 구조적으로 안전하지 않다.

### 1.1 `NEXT_PUBLIC_` 는 공개 값이다

Next.js에서 `NEXT_PUBLIC_` 접두사 환경변수는 **클라이언트 번들에 인라인**된다.  
개발자 도구·소스맵·네트워크 탭·빌드 산출물에서 누구나 읽을 수 있다.

### 1.2 API 키가 요청 헤더에 실린다

현재 코드는 `x-api-key`를 브라우저 `fetch` 헤더에 넣는다.  
같은 네트워크를 보는 사람, 확장 프로그램, XSS가 있는 경우 키를 가로챌 수 있다.

### 1.3 `anthropic-dangerous-direct-browser-access` 의 의미

이 헤더는 “브라우저에서 직접 호출해도 된다”는 명시적 우회 신호다.  
즉, **의도적으로 클라이언트 노출 경로를 연 상태**이며, 프로덕션 보안 모델과 맞지 않는다.

### 1.4 남용·과금 리스크

키가 유출되면 제3자가 동일 키로 Messages API를 호출할 수 있다.

- 예상치 못한 토큰/이미지 분석 과금
- 쿼터 소진으로 정상 사용자 서비스 중단
- 악성 프롬프트·대량 요청으로 계정 제한

### 1.5 서버 측 통제가 불가능하다

브라우저 직접 호출에는 다음이 없다.

- 서버 rate limit
- IP/세션 기반 차단
- 요청 본문 크기·이미지 MIME 검증
- 프롬프트/모델 서버 고정
- 감사 로그·비용 모니터링의 단일 진입점

### 1.6 얼굴·피부 이미지의 민감성

사진 모드에서 얼굴 이미지가 **사용자 브라우저 → Anthropic**으로 바로 전송된다.  
서버를 거치지 않으면 앱 측에서 보관 정책·최소화·차단 규칙을 일관되게 적용하기 어렵다.

---

## 2. Which current files are involved

마이그레이션 시 **직접 관련**되는 현재 파일:

| 파일 | 역할 |
|------|------|
| `src/app/analyze/page.tsx` | `callAnthropic`, 사진/수동 분석, 키 사용, 파싱, UI |
| `docs/AIAnalysis_Current.md` | 현재 동작 설명 (참고) |
| `docs/05_AI.md` | AI 문서 (이후 갱신 대상) |
| `docs/06_API.md` | API 문서 (이후 갱신 대상) |
| `README.md` | 환경변수 표기에 `NEXT_PUBLIC_ANTHROPIC_API_KEY` 언급 |

간접 관련:

| 파일 | 역할 |
|------|------|
| `.gitignore` | `.env*` 무시 (시크릿 커밋 방지에 이미 기여) |
| `package.json` | 현재 Anthropic SDK 의존성 없음 (`fetch` 직접 사용) |

**아직 없는 파일 (목표 구조에서 추가 예정):**

- `src/app/api/analyze/route.ts` (또는 동등한 서버 라우트)
- 서버 전용 AI 클라이언트/프로바이더 모듈 (예: `src/lib/ai/*`)

이 문서를 작성하는 시점에서는 위 파일을 **생성하지 않는다.**

---

## 3. Which API key exposure risks exist

| 리스크 | 설명 | 현재 해당 여부 |
|--------|------|----------------|
| 클라이언트 번들 노출 | `NEXT_PUBLIC_ANTHROPIC_API_KEY`가 프론트 번들에 포함 | **해당** (`analyze/page.tsx`) |
| 네트워크 헤더 노출 | 브라우저 → Anthropic 요청의 `x-api-key` | **해당** |
| DevTools/확장 프로그램 | 일반 사용자가 키를 복사 가능 | **해당** |
| 빌드 산출물·CI 로그 | 공개 변수는 로그/아티팩트에 남을 수 있음 | 환경에 따라 가능 |
| Git 커밋 | `.env*`는 gitignore이나, 과거 커밋·실수 커밋 가능성 | 저장소 정책상 방지 중이나 키 로테이션은 별도 권장 |
| 스크린샷·공유 | 문서/채팅에 키 값을 붙여넣는 인적 실수 | 운영 규칙으로 금지 |

### 공개해도 되는 것 vs 안 되는 것 (원칙)

| 종류 | 예시 변수명 | 브라우저 허용 |
|------|-------------|---------------|
| 공개 가능 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (RLS 전제) | 예 |
| **비공개 필수** | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, 서비스 롤 키 | **아니오** |

> 이 문서는 실제 키 문자열을 포함하지 않는다.  
> 유출이 의심되면 제공자 콘솔에서 **즉시 키 폐기·재발급**한다.

---

## 4. The recommended secure architecture using a Next.js server route

### 목표 흐름 (To-Be)

```text
브라우저 (/analyze)
  → POST /api/analyze   (동일 오리진, 키 없음)
  → Next.js Route Handler (서버)
       ├─ 입력 검증 (모드, 크기, MIME, 필드)
       ├─ rate limit / 기본 남용 방지
       ├─ 프로바이더 선택 (로컬 Ollama 우선 또는 클라우드)
       ├─ 서버 전용 키로 Anthropic/OpenAI 호출 (필요 시)
       ├─ 응답 JSON 스키마 검증
       └─ 안전한 결과만 클라이언트에 반환
  → UI / localStorage (기존 UX 유지 가능)
```

### 권장 책임 분리

| 계층 | 책임 |
|------|------|
| `analyze/page.tsx` | 입력 UI, loading/error, 결과 표시, `/api/analyze` 호출만 |
| `app/api/analyze/route.ts` | 인증/제한(추후), 검증, 프로바이더 호출, 스키마 검증 |
| `lib/ai/provider.ts` (예정) | Ollama / Anthropic / OpenAI 어댑터 |
| `lib/ai/schema.ts` (예정) | `AnalysisResult` 파싱·검증 |

### 보안 요구사항

1. 클라이언트에 AI 비밀 키를 **절대** 넣지 않는다.
2. 모델명·system prompt는 서버에서 고정하거나 allowlist로만 허용한다.
3. 이미지 업로드는 크기·MIME 제한을 서버에서 재검증한다.
4. 에러 응답에 업스트림 원문·키·스택을 그대로 노출하지 않는다.
5. 프로덕션 기본 프로바이더는 명시적으로 설정한다 (`AI_PROVIDER` 등).

---

## 5. How Ollama should be used locally

로컬 개발·비용 절감·키 노출 제로를 위해 **Ollama를 기본 로컬 프로바이더**로 둔다.

### 역할

- 개발자 PC에서 모델 추론
- 클라우드 API 키 없이 analyze 플로우 검증
- CI/로컬 스모크 테스트용 (환경이 갖춰진 경우)

### 권장 사용 방식

```text
개발자 머신
  Ollama 데몬 (예: http://127.0.0.1:11434)
       ↑
Next.js 서버 (route handler만 접근)
       ↑
브라우저 → /api/analyze 만 호출
```

브라우저가 Ollama 포트에 직접 붙지 않게 한다.  
(CORS·포트 노출·프롬프트 조작 표면을 줄이기 위함)

### 설정 원칙 (값 예시가 아닌 이름)

| 변수명 (제안) | 용도 | 공개 |
|---------------|------|------|
| `AI_PROVIDER=ollama` | 로컬 기본 프로바이더 | 서버 전용 |
| `OLLAMA_BASE_URL` | 예: 로컬 Ollama base URL | 서버 전용 |
| `OLLAMA_MODEL` | 사용할 로컬 모델명 | 서버 전용 |

### 주의

- Ollama는 **로컬 신뢰 환경** 전제다. 공인 인터넷에 Ollama 포트를 열지 않는다.
- 비전(사진) 지원 여부는 선택한 로컬 모델에 따라 다르다. 미지원 시 수동 모드만 로컬, 사진 모드는 클라우드로 폴백하는 정책을 문서화한다.
- 로컬 모델 출력 형식이 Claude와 다를 수 있으므로 **동일 JSON 스키마 검증**을 서버에서 강제한다.

---

## 6. How OpenAI or Anthropic should be used only when needed

클라우드 모델은 **필요할 때만** 서버에서 호출한다.

### 사용 시점 예시

| 상황 | 권장 |
|------|------|
| 로컬 개발·UI 검증 | Ollama |
| 사진(비전) 분석 품질이 로컬로 부족 | Anthropic 또는 OpenAI (서버) |
| 스테이징/프로덕션 품질 보장 | 명시적 클라우드 프로바이더 |
| 비용·쿼터 압박 | Ollama 또는 캐시·rate limit |

### 호출 규칙

1. **브라우저 → OpenAI/Anthropic 직접 호출 금지**
2. 오직 `POST /api/analyze` (또는 후속 서버 API)만 클라우드에 연결
3. 프로바이더 선택은 서버 환경변수로만 결정 (`AI_PROVIDER=anthropic|openai|ollama`)
4. 클라이언트가 임의 모델 ID·API 키·base URL을 보내지 못하게 한다
5. 실패 시: 사용자에게는 일반 오류, 서버 로그에만 상세 기록

### Anthropic / OpenAI 병행 시

- 어댑터 패턴으로 입출력(`AnalysisResult`)을 통일한다.
- 현재 프롬프트·JSON 스키마는 서버 모듈로 이전하고, 페이지에 중복 하드코딩하지 않는다.
- 프로덕션에서 기본값을 클라우드로 둘 경우에도 **키는 서버 전용 변수**만 사용한다.

---

## 7. Which environment variables should stay server-side only

### 서버 전용으로 유지해야 하는 변수 (제안 이름)

| 변수명 | 용도 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic 서버 호출 |
| `OPENAI_API_KEY` | OpenAI 서버 호출 (사용 시) |
| `AI_PROVIDER` | `ollama` / `anthropic` / `openai` |
| `OLLAMA_BASE_URL` | 로컬 Ollama 주소 |
| `OLLAMA_MODEL` | 로컬 모델명 |
| `ANTHROPIC_MODEL` | 서버에서 고정할 Claude 모델 ID |
| `OPENAI_MODEL` | 서버에서 고정할 OpenAI 모델 ID (사용 시) |
| `AI_MAX_TOKENS` | 토큰 상한 (선택) |
| `AI_RATE_LIMIT_*` | rate limit 설정 (선택) |

위 변수에는 **`NEXT_PUBLIC_` 접두사를 붙이지 않는다.**

### 마이그레이션 후 제거·폐기 대상

| 변수명 | 조치 |
|--------|------|
| `NEXT_PUBLIC_ANTHROPIC_API_KEY` | 코드에서 제거 후, 제공자 콘솔에서 **키 로테이션(폐기·재발급)** |

### 계속 공개 가능한 변수 (AI와 무관·기존)

| 변수명 | 비고 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 클라이언트 Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | RLS 전제 anon 키 |

### 운영 규칙

- `.env.local` / 호스팅 시크릿 스토어에만 서버 키를 둔다.
- 채팅·이슈·README·스크린샷에 키 **값**을 붙이지 않는다.
- 이 마이그레이션 작업 중에도 **`.env.local`을 수정·출력하지 않는다** (본 문서 단계).

---

## 8. A step-by-step migration plan

코드 변경은 **이후 별도 작업**으로 수행한다. 아래는 권장 순서다.

### Phase 0 — 준비 (문서·키 운영)

1. 본 문서와 `AIAnalysis_Current.md`로 As-Is 공유
2. Anthropic 콘솔에서 현재 공개 가능 키의 **교체 계획**만 수립 (값은 문서에 기록하지 않음)
3. 로컬에 Ollama 설치·모델 pull 여부 확인 (개발자 환경)

### Phase 1 — 서버 라우트 추가 (기존 클라이언트 호출 유지)

1. `POST /api/analyze` Route Handler 추가
2. 서버에서 `AnalysisResult`와 동일한 JSON 계약 유지
3. 프로바이더 어댑터: 우선 `ollama`, 옵션으로 `anthropic`/`openai`
4. 입력 검증·에러 정규화·기본 rate limit
5. 이 단계에서는 `/analyze` UI가 아직 구 경로를 써도 됨 (병렬 존재)

### Phase 2 — 클라이언트 전환

1. `analyze/page.tsx`의 `callAnthropic`을 `fetch("/api/analyze")`로 교체
2. 요청 body: `mode`, 수동 필드, 이미지(필요 시)만 전송 — **키·모델 강제 지정 제거**
3. 응답 파싱은 서버 검증 결과를 신뢰하되, 클라이언트도 최소 필드 체크
4. UX(탭, 면책, localStorage, `goToResults`)는 유지

### Phase 3 — 공개 키 제거

1. 코드·README·docs에서 `NEXT_PUBLIC_ANTHROPIC_API_KEY` 참조 삭제
2. 배포 환경 변수에서 해당 공개 변수 제거
3. **유출되었을 수 있는 키를 제공자에서 revoke** 후 서버 전용 새 키만 등록
4. 빌드/런타임에 클라이언트 번들에 AI 키가 없는지 검색

### Phase 4 — 강화

1. 이미지 크기·MIME 제한, 타임아웃
2. 프로덕션 rate limit·모니터링
3. `docs/05_AI.md`, `docs/06_API.md`, README 환경변수 표 갱신
4. (선택) 인증 도입 후 사용자별 쿼터

### 완료 정의 (Definition of Done)

- [ ] 브라우저 네트워크 탭에 Anthropic/OpenAI로의 직접 호출이 없다
- [ ] 클라이언트 번들에 `ANTHROPIC`/`OPENAI` 비밀 키가 없다
- [ ] `/analyze` 사진·수동 분석이 `/api/analyze`로 동작한다
- [ ] 로컬은 Ollama로 분석 가능한 경로가 있다
- [ ] 문서의 환경변수 안내가 서버 전용 기준으로 갱신되었다

---

## 9. A rollback plan

마이그레이션 중 장애 시 복구 절차.

### 단기 롤백 (기능 우선)

1. `/analyze`를 직전 커밋(브라우저 직접 호출 버전)으로 되돌린다  
   - 또는 feature flag로 `USE_SERVER_AI=false` 시 구 경로 사용 (플래그 도입 시)
2. `/api/analyze`는 유지하되 트래픽을 끊거나 404 처리
3. 사용자에게 일시적 오류 공지 (필요 시)

### 보안 롤백 시 주의

브라우저 직접 호출로 되돌리면 **키 노출이 다시 발생**한다.

- 롤백이 불가피하면: **짧은 시간만** 허용하고, 사용 키는 이미 노출된 키와 분리된 **임시 키**만 쓴다
- 복구 후 즉시 서버 경로로 재전환하고 임시 키를 revoke한다
- “보안 마이그레이션 완료 후”의 영구 롤백 대상으로 브라우저 직접 호출을 남기지 않는다

### 데이터·UX

- `localStorage.skinAnalysisResult` 스키마가 동일하면 롤백 후에도 결과 복원 가능
- 서버가 응답 필드를 바꿨다면 클라이언트 타입을 함께 롤백한다

### 배포 롤백 체크

1. 이전 안정 배포로 revert
2. 환경변수: 서버 키 설정이 깨졌는지 확인 (값은 로그에 출력하지 않음)
3. `/analyze` 수동 모드 1회, (가능 시) 사진 모드 1회 스모크
4. 장애 원인 기록 후 Phase 1부터 재시도

---

## 10. A test checklist

시크릿 값을 출력·커밋·스크린샷에 포함하지 말 것.

### A. 보안

- [ ] 브라우저 DevTools → Network에 `api.anthropic.com` / `api.openai.com` 직접 호출이 **없다**
- [ ] Network에 보이는 것은 동일 오리진 `POST /api/analyze` 뿐이다
- [ ] Request headers에 `x-api-key` / `Authorization: Bearer sk-...` 가 **클라이언트 요청에 없다**
- [ ] 클라이언트 JS 번들/소스에서 `NEXT_PUBLIC_ANTHROPIC` 및 키 패턴 검색 결과 없음
- [ ] 서버 로그에 API 키 문자열이 인쇄되지 않음

### B. 기능 — 수동 모드

- [ ] 피부톤/언더톤/고민/민감도 선택 후 분석 성공
- [ ] `skin_type`, `concerns`, `ingredients`, `routine_tips`, `summary_*` 표시
- [ ] `localStorage.skinAnalysisResult` 저장·새로고침 복원
- [ ] 「제품 정보 보기」가 `/results?...&ai=1`로 이동

### C. 기능 — 사진 모드

- [ ] 이미지 업로드 후 분석 성공 (프로바이더가 비전 지원할 때)
- [ ] 비전 미지원 프로바이더에서는 명확한 오류(키/스택 미노출)
- [ ] 과도한 용량 파일 거부

### D. 프로바이더

- [ ] `AI_PROVIDER=ollama` 로컬 분석 성공 (환경 준비 시)
- [ ] `AI_PROVIDER=anthropic` 서버 키로만 성공
- [ ] (사용 시) `AI_PROVIDER=openai` 서버 키로만 성공
- [ ] 잘못된/빈 서버 키일 때 사용자에게 일반 오류, 키 원문 미노출

### E. 회귀

- [ ] `/quiz`, `/results`, `/routine` 등 AI와 무관한 페이지 정상
- [ ] Supabase 제품/성분 조회 정상
- [ ] 면책 문구·의료 진단 아님 카피 유지

### F. 문서·운영

- [ ] README / `docs/05_AI.md` / `docs/06_API.md` 환경변수 안내가 서버 전용으로 갱신됨
- [ ] `NEXT_PUBLIC_ANTHROPIC_API_KEY` 안내가 제거됨
- [ ] 구 공개 키 revoke 완료 (값은 기록하지 않음)

---

## 부록 A — 현재 vs 목표 비교

| 항목 | 현재 | 목표 |
|------|------|------|
| 호출 주체 | 브라우저 | Next.js 서버 Route |
| 키 변수 | `NEXT_PUBLIC_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` (서버) |
| 로컬 개발 | 클라우드 키 필요 | Ollama 우선 |
| 클라우드 | 항상 브라우저→Anthropic | 필요할 때만 서버→Anthropic/OpenAI |
| 남용 방지 | 없음 | rate limit·검증·로그 |
| 결과 스키마 | 클라이언트 느슨한 JSON.parse | 서버 검증 후 반환 |

## 부록 B — 관련 문서

- [`docs/AIAnalysis_Current.md`](./AIAnalysis_Current.md) — analyze 페이지 현재 동작
- [`docs/05_AI.md`](./05_AI.md) — AI 통합 개요
- [`docs/06_API.md`](./06_API.md) — API 설계
- [`docs/02_ProjectRule.md`](./02_ProjectRule.md) — 보안·AI 규칙

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-11 | 보안 마이그레이션 계획 초안 작성 (코드 미변경) |
