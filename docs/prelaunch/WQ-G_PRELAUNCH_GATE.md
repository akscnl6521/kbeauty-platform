# WQ-G — Prelaunch Gate

점검일: **2026-07-23**  
작업 성격: **조사·검증·문서화만** (앱 코드 변경 · DB write · Production 배포 · main 병합 · 없음)

---

## 0. 기준 정보

| 항목 | 값 |
|------|-----|
| 프로젝트 | K-Beauty Match |
| 기준 브랜치 | `feature/recommendation-usage-guide-display-20260720` |
| 기준 커밋 (코드) | `8b3f147` — Phase 3.1 deferral / landmark flag default OFF |
| 기준 커밋 (문서) | `885fa19` — Preview URL 기록 |
| 기준 Preview URL | https://kbeauty-platform-89ry68u2h-akscnl6521s-projects.vercel.app |
| 동일 브랜치 최신 Preview (참고) | https://kbeauty-platform-n3zfcf117-akscnl6521s-projects.vercel.app |
| Production | **미변경** |
| main 병합 | **미실행** |
| Staging/Production DB write | **미실행** |
| 자동 랜드마크 (Phase 3.1) | **deferred** (Android real-device blocker unresolved) |
| 기본 촬영 UX | **수동** 정면 / 좌45 / 우45 (`NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE` 기본 OFF) |
| 점검 기준 | Staging 카탈로그 · Preview 배포 · 로컬 읽기 테스트 |

---

## 1. 전체 판단

**출시 가능 상태로 보지 않는다.**

핵심 이유:

1. **사진 기반 AI 분석 UX와 실제 구현이 불일치** — 사용자는 3장 촬영·사진 동의·「AI 분석」을 거치지만, OpenAI/Anthropic/Ollama에는 **이미지 픽셀이 전달되지 않고** 문진형 텍스트 가이던스만 생성된다. (`src/lib/ai/prompt.ts` photo mode 명시)
2. **API에는 정면(또는 품질 통과 1장)만** 전달된다. 좌·우 45°는 로컬 품질/미리보기용이다. 「다각도 AI 분석」으로 오인되면 안 된다.
3. **Production `AI_PROVIDER`** 는 미설정/mock이면 차단 설계이나, **Preview/로컬에서 provider 미설정·mock 가능** — 출시 전 Production 값 **사람 확인 필수**.
4. 추천 파일럿 **A/B/C는 runtime 연결·가짜 채움 금지**가 확인됨. **D/E는 insufficient** (정직한 빈 상태) — 가짜 제품 없음.
5. Phase 3.1 자동 정렬은 **완료가 아님** — deferred 유지.

---

## 2. 우선순위 정의 (적용 기준)

| 등급 | 의미 |
|------|------|
| **P0** | 출시 차단 — 여정 단절, 잘못된 분석/추천, 개인정보·보안, 과장 표현으로 오인, Production 서비스 불가 |
| **P1** | 출시 전 필요 — 신뢰·완성도·모바일 UX·동의/문구 정합·운영 최소선 |
| **P2** | 출시 후 가능 — 본체 동작 후 개선 (사진 비교, 자동 정렬, 시나리오 확장 등) |
| **P3** | 장기 확장 — 제휴·광고·B2B·대규모 자동화 등 |

---

## 3. 사용자 여정 점검표

| # | 단계 | 상태 | 비고 | 출시 영향 | 우선순위 |
|---|------|------|------|-----------|----------|
| 1 | 홈 접속 | 구현됨 | Preview 정적/SSR | 낮음 | — |
| 2 | 피부 분석 시작 | 구현됨 | `/analyze` | 낮음 | — |
| 3 | 분석 방식 선택 | 부분 구현 | 카메라 / 문진 · 갤러리 없음 | 중간 | P1 (옛 「업로드」문구) |
| 4 | 사진 촬영 또는 문진 | 구현됨 | Phase 3.0 수동 3각도 | 중간 | — |
| 5 | 문진 입력 | 구현됨 | concerns / sensitivity 등 | 낮음 | — |
| 6 | 분석 API 호출 | **부분 구현** | photo 1장 base64 → 서버 · **AI는 픽셀 미사용** | **높음** | **P0** |
| 7 | 결과 화면 | 구현됨 | `/results` | 중간 | P1 (AI 배지 오인) |
| 8 | 고민·성분·추천 이유 | 구현됨 | 추천 카드·evidence | 중간 | — |
| 9 | 제품 추천 | 부분 구현 | A/B/C runtime · D/E insufficient | 중간 | P1/P2 |
| 10 | 판매처 | 부분 구현 | commerce 분리 · CTA ON/OFF | 중간 | P1 |
| 11 | 루틴 | 구현됨 | `/routine` · 사용 가이드 연결 | 중간 | — |
| 12 | 사용 가이드 | 구현됨 | 공용 컴포넌트 | 낮음 | P2 Preview 육안 |
| 13 | 결과 저장 | 부분 구현 | localStorage + 로그인 care 저장 | 중간 | P1 |
| 14 | 재방문 | 부분 구현 | `/my` 대시보드 | 중간 | P1 |
| 15 | 3/7/15/30 관리 | 부분 구현 | 체크인 UI · 이메일은 dry-run/게이트 | 중간 | P1/P2 |
| 16 | 전문가 상담 안내 | 구현됨 | 위험 신호 · clinic 정책 | 중간 | P1 (데이터 범위) |

**여정 단절(핵심):**  
「3장 촬영 → AI가 사진을 본다」는 사용자 기대와 **코드 현실이 어긋남**. 기능 자체는 문진+텍스트 AI로 결과는 나올 수 있으나, **표현·동의가 출시 P0**.

---

## 4. 실제 분석 입력 범위

### 확인 결과

| 질문 | 답 |
|------|-----|
| `/api/analyze`로 몇 장? | **1장** (`imageBase64` 단일) |
| 정면만? | `primaryShotForAnalysis` — **정면 pass 우선**, 없으면 첫 pass 각도 (`captureSession.ts`) |
| 좌·우? | **브라우저 세션 로컬** (미리보기·품질) · API 미전달 |
| 문진+사진 함께? | 문진 필드 + (photo 모드 시) base64 1장 · **프로바이더는 문진 텍스트만** |
| mock이 사진을 분석? | **아니오** — 텍스트 mock |
| openai/anthropic/ollama? | **이미지 미전송** · photo 프롬프트가 “픽셀 없음” 명시 |
| 이미지 없을 때? | `mode: "manual"` 또는 문진 경로 |
| 품질 실패 사진 API? | pass만 primary · 실패는 재촬영 |
| Blob 정리? | `revokePreviewUrl` / unmount cleanup — 구현됨 |
| 중복 분석 방지? | UI `inFlight` + 60s timeout · API idempotency는 약함 |

### 과장 금지

- ❌ 「다각도 AI 분석」「사진으로 피부를 진단」
- ✅ 「정면·좌·우 가이드로 표준 촬영 후, (현재) 문진·입력 기반 맞춤 안내」+ 사진 픽셀 AI 미사용이 해소되면 문구 갱신

관련 파일:

- `src/lib/analyze/guidedCapture/captureSession.ts` — `primaryShotForAnalysis`
- `src/components/analyze/guidedCapture/GuidedCaptureFlow.tsx` — `runAnalyze`
- `src/lib/ai/prompt.ts` — photo mode “no real image pixels”
- `src/app/api/analyze/route.ts` — photo 검증 후 `analyzeSkin`

---

## 5. AI provider 점검

| 항목 | 상태 |
|------|------|
| 미설정 (development) | Ollama 시도 → 실패 시 **mock** |
| 미설정 (production) | **CONFIG 에러** (설계상) |
| production + mock | **CONFIG 차단** (설계상) |
| Preview | Staging DB + 환경변수 의존 · **사람 확인 필요** (로컬 `check:deployment-env` 는 `hasAiProvider: false`) |
| OpenAI/Anthropic timeout·retry | **약함** (Ollama만 10s Abort) |
| 사용자 사진 외부 API | **미전송** |
| 동의 문구 | 「AI 피부 분석에 내 사진을 사용」— **실제 외부 AI 픽셀 사용과 불일치** |

**분류:**

- Production mock/미설정 → **P0** (출시 게이트)
- Preview mock → 허용 가능하나 **화면에 mock/개발 고지 없으면 P1**
- 「AI 피부 분석(사진)」표현 vs 픽셀 미사용 → **P0** (신뢰·동의)

---

## 6. 추천 엔진 점검

| 시나리오 | ID | Runtime |
|----------|-----|---------|
| A sensitive+redness cream | `kr-redness-sensitive-cream` | **연결** |
| B dry+barrier serum | `pilot-dryness-barrier-serum` | **연결** |
| C acne/sebum toner | `kr-acne-pores-toner` | **연결** |
| D UV sunscreen | `kr-uv-sunscreen-sensitive` | **insufficient** |
| E eye cream | `kr-aging-eye-cream` | **insufficient** |

- 가짜 Top N 채움: **없음** (`clampTopNWithoutPadding`)
- `recommendation_ready` ≠ commerce · CTA 분리: **구현**
- insufficient UX: 「검증 제품 보강 중」류 — **정직** → P2 (카탈로그 보강) / P1 (문구·빈 상태 UX 검수)

관련: `runScenarioPilotPhase2.ts`, `persistTopRankedProducts.ts`, `commerceStatus.ts`

---

## 7. 제품·판매처 (파일럿 정책 요약)

문서·이전 Preview 검증·selftest 기준 (이번 턴 DB write 없음):

| 기대 | 상태 |
|------|------|
| BOJ OOS + CTA OFF | 정책·commerce 분리로 설계됨 |
| Haruharu availability_unknown + CTA OFF | 동상 |
| COSRX/Anua in_stock + CTA ON | 파일럿 A/B/C 풀 |
| ROUND LAB unverified anon 미노출 | RLS/노출 정책 |
| D/E insufficient | early-return |

**출시 전:** Preview에서 A/B/C 각 1회 육안 + CTA 상태 재확인 → **수동 검수 (H)** · P1.

---

## 8. 촬영 UX

| 항목 | 상태 |
|------|------|
| flag 미설정 → landmark OFF | **확인** (`isEnabled.ts` default `"0"`) |
| debug 기본 미노출 | **확인** |
| 정면·미리보기·재촬영·좌·우·3장·분석 | 코드상 구현 · **Android/iPhone 육안은 사용자 검수** |
| track stop | unmount/cleanup 경로 존재 |
| 권한 거부 / 미지원 → 문진 | 구현 |
| 갤러리 | **미제공** |
| Phase 3.1 auto | implemented · tests passed · **real-device blocker · deferred** — **완료 아님** |

---

## 9. 개인정보·동의

| 항목 | 상태 | 이슈 |
|------|------|------|
| 사진 분석 동의 | UI 있음 | 문구가 「사진 사용」인데 AI 픽셀 미사용 → **P0 정합** |
| 비교 저장 동의 | 코드/정책 준비 | Storage·DB **미적용** → 비교 기능 **미출시** |
| 분석 후 임시 정리 | 클라이언트 revoke | 서버 영구 저장 없음(분석 라우트) |
| 신원 확인 미사용 | 카피 명시 | OK |
| 학습 동의 | 없음 | OK (미학습 전제 유지) |
| Storage | **미사용** | 문서와 일치 |
| 로그에 좌표/사진 | 카메라 진단은 이벤트 수준 · landmark 좌표 서버 로그 금지 설계 | P1 로그 감사 |

---

## 10. 의료·안전

| 항목 | 상태 |
|------|------|
| terms / footer disclaimer | 구현 |
| 위험 신호 · 상담 우선 | symptom safety · check-in | 구현 · selftest PASS |
| 진단 표현 금지 | 프롬프트·UI | 대체로 준수 |
| 「AI 피부 분석」배지 | results | **사진 분석 오인 가능 → P0/P1** |

---

## 11. 리텐션

| 기능 | 상태 |
|------|------|
| `/routine` | 구현 |
| localStorage 결과 | 구현 |
| 로그인 care 저장 | 구현 (환경 의존) |
| 3/7/15/30 체크인 UI | 구현 |
| 이메일 실발송 Production | **미연결** (Preview 테스트/게이트) |
| 웹푸시 | 정책·부분 · 실운영 제한 |
| 사진 비교 | **미구현 출시** (DRAFT migration · care-photos 미생성) |

문서상 「완료」와 실운영을 혼동하지 말 것 → 목록 F/G 참고.

---

## 12. 관리자·운영

| 항목 | 상태 |
|------|------|
| `/admin` · 로그인 | 구현 (Preview SSO 가능) |
| 제품/CSV/검수 | 구현 |
| staging/production 분리 | 설계·게이트 존재 |
| care admin | Staging grant 적용됨 · Preview 육안 이력 있음 |
| verified 전환·offer | 운영 가능하나 **사람 검수 필수** |

출시 후 카탈로그 운영 불가면 P1 — 현재 **최소 운영 경로는 있음**.

---

## 13. 환경·배포

| 항목 | 메모 |
|------|------|
| Vercel Preview | Ready 배포 확인 |
| Production domain | 이번 작업 미배포 |
| `AI_PROVIDER` | Production 출시 전 **필수 확인** |
| Supabase Preview→Staging | `.env.example` 패턴 |
| Production DB 오접속 방지 | deployment-env / readiness 스크립트 |
| secrets Git | `check:release-security` PASS (로컬) |
| CSP / camera / wasm | landmark OFF 시 WASM **런타임 미로드** · 패널 JS는 정적 import 잔존 |

---

## 14. 성능

| 항목 | 상태 | 우선순위 |
|------|------|----------|
| landmark flag OFF 시 MediaPipe WASM/model 로드 | **로드 안 함** (`load()` dynamic) | OK |
| `CameraCapturePanel` → landmarker 모듈 정적 import | **번들 잔존 가능** | **P1** |
| homepage /analyze FCP | Preview 육안 필요 | H |
| 320px overflow | `check:responsive` PASS (정적) | — |

---

## 15. 접근성 (코드·정적 기준)

- aria-live / 버튼 label / reduced motion 일부 존재
- 전체 a11y 감사 **미완** → **P1/P2** 수동 검수
- Android/iPhone 터치·포커스 → **H**

---

## 16. 테스트 상태 (이번 점검에서 실행)

| 스크립트 | 결과 | 신뢰 범위 |
|----------|------|-----------|
| `test:guided-capture` | **통과** | 로컬 순수 로직 |
| `test:guided-landmark` | **통과** | 로컬 · 실기기 아님 |
| `test:recommendation-commerce-separation` | **통과** | 정책 |
| `test:recommendation-scenario-phase2` | **통과** | 파일럿 A–E |
| `test:symptom-safety` | **통과** | 안전 분기 |
| `check:production` | **통과** | readiness 규칙 (실 Production 값 ≠) |
| `check:deployment-env` | **통과** · `hasAiProvider: false` (로컬) | 로컬 env |
| `check:release-security` | **통과** | 정적 |
| `check:responsive` | **통과** | 정적 |
| `test:pipeline` / `test:journey` / `test:smoke` | **미실행** (이번) | CI 이력에 의존 |
| Preview E2E 로그인 여정 | **미실행** | **H** |
| Production launch-blockers pull | **미실행** (비밀·승인) | **I/J** |

---

## 17. 코드·문서 불일치

| 불일치 | 조치 |
|--------|------|
| 「AI가 사진을 분석」UX vs 픽셀 미전달 | P0 문구·동의·배지 수정 (다음 작업) |
| analyze 페이지 「사진을 업로드한 뒤…」 | 갤러리 제거 후 **잔존 카피** → P1 |
| Phase 3.1 「완료」오기록 방지 | PROJECT_STATUS/ROADMAP에 deferred 반영됨 |
| Storage/사진 비교 「완료」≠ 출시 가능 | migration·bucket 미적용 명시 유지 |
| Preview URL 갱신 | 본 문서 기준 URL 기록 |

---

## 18. 사용자 화면에서 제거할/고칠 개발·과장 문구

| 문구/유형 | 위치 | 조치 |
|-----------|------|------|
| 「사진을 업로드한 뒤 AI 분석을…」 | `src/app/analyze/page.tsx` ~1748 | **삭제/수정 P1** |
| 「AI 피부 분석에 내 사진을 사용」 | `PhotoConsentPanel.tsx` | **실제 전송 범위에 맞게 P0** |
| 「사진을 안전하게 전달」 | `analysisProgress.ts` | 서버 검증 vs AI 미사용 구분 P0/P1 |
| 「AI 분석 반영됨」/「AI 피부 분석」 | results | 사진 비전 없을 때 완화 P0/P1 |
| mock / debug / raw_bounds | 기본 경로 | landmark OFF 시 미노출 확인 · 개발 버튼은 NODE_ENV 제한 |
| Staging 문구 | `/my` 일부 | 일반 사용자 노출 여부 검수 P1 |

---

## 19. WQ-G 결과표

| ID | 영역 | 문제 | 현재 상태 | 사용자 영향 | 출시 영향 | 우선순위 | 권장 조치 | 관련 파일 | 검증 방법 | Production 승인 |
|----|------|------|-----------|-------------|-----------|----------|-----------|-----------|-----------|------------------|
| WQG-P0-001 | AI/동의 | 사진 AI 분석처럼 보이지만 픽셀 미전달 | photo 모드 텍스트 only | 오인·동의 불일치 | **차단** | **P0** | 동의·카피·배지를 「현재 단계: 문진·입력 기반 안내 / 사진 픽셀 AI 미사용」으로 정합 또는 실제 vision 연동 | `prompt.ts`, `PhotoConsentPanel.tsx`, `GuidedCaptureFlow.tsx`, `results/page.tsx` | Preview 동의→분석→결과 문구 | 카피 배포는 Preview 가능 · vision 연동은 별도 승인 |
| WQG-P0-002 | AI/배포 | Production `AI_PROVIDER` mock/미설정 위험 | 코드상 차단 · 값 미확인 | 서비스 실패/mock 노출 | **차단** | **P0** | Production env 사람 확인 · `check-production-launch-blockers` | `analyzeSkin.ts`, launch-blockers script | 대시보드/승인 후 스크립트 | **예** |
| WQG-P0-003 | 분석 입력 | 3장 촬영 vs API 1장 · 비전 없음 | primary front only | 「다각도 분석」오인 | **차단**(표현) | **P0** | UX 문구를 촬영 목적(표준화·품질)과 분석 입력 범위로 분리 | `captureSession.ts`, analyze copy | 코드 리뷰 + Preview | 문구만이면 Preview |
| WQG-P1-001 | 카피 | 「사진을 업로드한 뒤…」잔존 | 갤러리 금지와 충돌 | 혼란 | 출시 전 | **P1** | 문구 삭제/카메라·문진 안내로 교체 | `analyze/page.tsx` | grep + Preview | 아니오 |
| WQG-P1-002 | 성능 | landmark 패널 정적 import | WASM OFF여도 JS 포함 가능 | 모바일 번들 | 출시 전 | **P1** | `dynamic()`로 CameraCapturePanel/landmark 분리 | `GuidedCaptureFlow.tsx`, `CameraCapturePanel.tsx` | bundle 분석 | 아니오 |
| WQG-P1-003 | 추천 | D/E insufficient · A/B/C Preview 육안 | 코드 OK · 육안 필요 | 빈 결과 이해 | 출시 전 | **P1** | Preview A/B/C CTA·빈상태 검수 · D/E 메시지 확인 | results, phase2 | Preview 시나리오 | 아니오 |
| WQG-P1-004 | 리텐션 | 이메일/푸시 실운영 범위 불명확 | dry-run·게이트 | 기대 불일치 | 출시 전 | **P1** | 출시 범위에 「사이트 내 체크인」만 포함할지 명시 | retention docs | 제품 결정 | 이메일 live는 **예** |
| WQG-P1-005 | a11y/모바일 | Android·iPhone·320px 육안 미완 | 정적 check만 | 사용성 | 출시 전 | **P1** | 실기기 수동 체크리스트 | guided capture | 실기기 H | 아니오 |
| WQG-P1-006 | 개인정보 | 서버로 base64 전송 vs 「즉시 삭제」카피 | 영구 저장 없음 · 일시 POST | 신뢰 | 출시 전 | **P1** | 전송 범위(앱 서버 검증) 명시 | privacy, consent | 법무/카피 | 정책 문구 승인 권장 |
| WQG-P2-001 | Phase 3.1 | 자동 landmark Android blocker | deferred | 자동 촬영 없음 | 출시 후 | **P2** | 실기기 안정화 후 flag=1 | PHASE31 doc | Android/iPhone | 아니오 |
| WQG-P2-002 | 사진 비교 | Storage/migration 미적용 | 코드만 | 비교 불가 | 출시 후 | **P2** | 승인 후 care-photos | WQ-B | Staging | **예** |
| WQG-P2-003 | 추천 | D/E 카탈로그 보강 | insufficient | 시나리오 공백 | 출시 후 | **P2** | verified 풀 확대 · 가짜 채움 금지 | catalog | Staging 검수 | Staging write는 **예** |
| WQG-P2-004 | AI | OpenAI/Anthropic timeout·retry | 약함 | 간헐 실패 | 출시 후 | **P2** | Abort/retry 정책 | analyzeWith*.ts | 부하 테스트 | 아니오 |
| WQG-P3-001 | 클리닉 | 제휴·실데이터 | 정책 위주 | 확장 | 장기 | **P3** | 단계 6 | clinic/* | — | 예 |
| WQG-P3-002 | 수익 | 광고·스폰서 | 미구현 | — | 장기 | **P3** | 단계 7 | — | — | 예 |

---

## 20. 별도 목록

### A. P0 출시 차단

1. WQG-P0-001 사진 AI 분석 오인·동의 불일치  
2. WQG-P0-002 Production AI_PROVIDER 확인  
3. WQG-P0-003 3장/비전 없는 분석에 대한 과장 표현 금지·카피 정합  

### B. P1 출시 전 필수

1. 업로드 잔존 문구 제거  
2. landmark 번들 분리(또는 허용 근거)  
3. A/B/C Preview 육안 · D/E 빈상태  
4. 리텐션 출시 범위 문서화  
5. 실기기 촬영 수동 UX  
6. 개인정보 전송 범위 문구  

### C. P2 출시 후

- Phase 3.1 재개 · 사진 비교 Storage · D/E 풀 · AI timeout  

### D. P3 장기

- 피부과 제휴 · 광고 · B2B · 완전 자동 갱신  

### E. 현재 구현 완료 (출시 관점 「동작」)

- 국가·언어 골격 · 문진 · 위험 신호 · 추천 안전 필터  
- Phase 3.0 수동 3각도 · 갤러리 금지  
- A/B/C 시나리오 runtime · commerce 분리 · 가짜 채움 금지  
- 루틴·사용 가이드 연결 · 체크인 UI · care dry-run 구조  
- admin 검수 골격 · 다수 selftest  

### F. 문서상만 / 미출시

- Phase 3.1 자동 정렬 「완료」  
- care-photos · 사진 비교 실저장  
- Production 체크인 이메일 live  
- 이미지 vision AI  

### G. mock / fallback 의존

- development AI 미설정 → Ollama → mock  
- Preview AI 설정 불명 시 mock 가능  
- photo 모드 AI = 사실상 incomplete-info 텍스트 가이던스  

### H. 사용자 수동 검수 필요

- Preview 전체 여정 (홈→촬영→결과→루틴→체크인)  
- Android Chrome / iPhone Safari 수동 촬영  
- A/B/C 추천·CTA  
- 동의·disclaimer 가독성  

### I. 대시보드에서 사용자가 확인할 항목

- Vercel Preview/Production env: `AI_PROVIDER`, Supabase URL, `APP_ENV`  
- Production launch-blockers (승인 후)  
- Staging 제품 verified/offer 샘플  

### J. Production 승인 필요

- Production 배포 · env · DB · main 병합  
- 이메일 live · care-photos · Storage  

### K. Staging DB 작업 후보

- 사진 비교 migration (승인 후)  
- D/E verified 풀 보강 (운영 검수)  

### L. main 병합 전 필수 테스트

- `test:guided-capture` · `test:guided-landmark`  
- `test:recommendation-scenario-phase2` · `test:recommendation-commerce-separation`  
- `test:symptom-safety` · `check:release-security` · `npm run build`  
- P0 카피 수정 후 Preview 육안  
- (권장) `test:journey` · `test:smoke` · `check:preview-scenario-phase21`  

---

## 21. 구현 순서 제안 (다음 작업)

1. **P0 카피·동의·결과 배지 정합** (앱 문구만 · vision 미도입) — Preview — Production 승인 불필요  
2. **P0 Production `AI_PROVIDER` 확인** — 대시보드 — **승인 필요**  
3. **P1 업로드 잔존 문구 제거** + landmark dynamic import — Preview  
4. **P1 Preview A/B/C·수동 촬영 실기기 체크리스트** — 사람  
5. **출시 범위 freeze** (체크인 이메일 live / 사진 비교 / landmark 자동 = 제외)  
6. main 병합·Production은 **P0+P1 최소선 통과 후**  
7. P2: landmark 재개 · D/E · Storage 비교 — 별도 승인  

원칙: 새 대규모 기능 금지 · 가짜 제품 금지 · landmark deferred 유지 · Storage는 P0 아니면 후순위.

---

## 22. 이번 작업에서 하지 않은 것 (준수)

- 앱 코드 변경 ❌  
- DB write / migration / Storage / care-photos ❌  
- Production env·배포 · main 병합 ❌  
- 자동 landmark 재수정 · 새 라이브러리 ❌  
- 실이메일 전송 ❌  

수행: 읽기 조사 · 로컬 테스트 · Preview URL 확인 · **본 문서 작성**

---

## 23. 요약 통계

| 등급 | 개수 (표 기준) |
|------|----------------|
| P0 | 3 |
| P1 | 6 |
| P2 | 4 |
| P3 | 2 |

**다음 작업 1순위:** WQG-P0-001 — 사진 AI 분석 오인 해소(동의·카피·배지 정합).  

**Production / main / DB:** 본 WQ-G 작업에서 **미변경**.
