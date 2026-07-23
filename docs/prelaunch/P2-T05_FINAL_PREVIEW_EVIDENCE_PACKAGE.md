# P2-T05 — Final Preview evidence · human approval package

최종 갱신: 2026-07-24
분류: `verified_complete` (증거 패키지 계약·Phase 2 자동 회귀·아티팩트) · Preview 육안·실기기·Dashboard·공식 출처·main/Production은 `external_only` / `dashboard_only_unknown` / `blocked`

## 목적

Phase 2(P2-T01~T04 + T06) 자동 검증을 **한 번 더 묶고**, 사람 승인 항목을 **버킷별로 분리**한 최종 증거 패키지를 만든다.

| 버킷 | 에이전트 완료 가능 |
|------|-------------------|
| 자동 테스트·빌드·라우트 | 예 (selftest/보안) |
| 스크린샷·육안 검수 대기 | 아니오 |
| Android Chrome · iPhone Safari | 아니오 |
| 외부 출처 승인 | 아니오 |
| Vercel·Supabase Dashboard 전용 | 아니오 (`dashboard_only_unknown`) |
| main·Production 승인 게이트 | 아니오 (`blocked` / `RELEASE_GATE_PENDING`) |

**출시 가능으로 보지 않음.** `visualApprovalClaimed=false` · `deviceApprovalClaimed=false` · `releaseReadyClaimed=false`.

## 명령

```bash
# 계약·문서·패키지 무결성 selftest
npm run test:phase2-final-evidence

# Phase 2 필수 자동 검증 실행 + artifacts 기록
npm run check:phase2-final-evidence

# 자동 명령 생략 · 패키지 구조만
npm run check:phase2-final-evidence -- --skip-commands
```

## 아티팩트

| 경로 | 내용 |
|------|------|
| `artifacts/phase2-final-evidence/latest-result.json` | machine-readable 패키지 |
| `artifacts/phase2-final-evidence/latest-summary.md` | 사람용 요약·1회성 검수 절차 |

gitignore 대상. 스크린샷 원본은 P2-T01 `artifacts/preview-route-validation/`.

## 계약·경로

| 경로 | 역할 |
|------|------|
| `src/lib/release/phase2FinalEvidencePackage.ts` | 버킷·사람 절차·리포트 빌더 |
| `scripts/phase2-final-evidence-selftest.ts` | selftest |
| `scripts/run-phase2-final-evidence.ts` | 러너 |
| `docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md` | 본 문서 |

## 1회성 사람 검증 (정확히 이 순서)

에이전트가 대신 완료했다고 표시하지 않는다. **각 항목은 한 번만** 수행하면 된다.

### 1) Preview 육안 (P0-003 / P1-003)

1. 브라우저에서 최신 Preview 주소를 연다.
2. `/analyze` → `/results` → `/routine` 순으로 본다.
3. 추천 A/B/C·구매 CTA·빈 상태·사용 가이드 fallback에 가짜 재고·과장·「AI가 사진을 본다」 오인이 없는지 확인한다.
4. 실패 시 스크린샷·경로만 남기고 Production은 진행하지 않는다.

### 2) Preview 관리자 로그인

1. Preview `/admin/login`에서 **정상 로그인**한다 (우회 금지).
2. `/admin/review` · `/admin/catalog/ops`가 열리는지 본다.
3. fixture·미승인 항목이 사용자 공개처럼 보이지 않는지 확인한다.

### 3) Android Chrome (P1-005)

1. Android 폰 Chrome으로 Preview `/analyze`를 연다.
2. 카메라 **수동** 정면·좌45·우45가 되는지 확인한다.
3. 갤러리 업로드가 없고 landmark 자동촬영이 기본으로 돌지 않아야 한다.

### 4) iPhone Safari (P1-005)

1. iPhone Safari로 동일 경로를 확인한다 (좁은 화면 포함).
2. 촬영 안내·버튼이 가려지지 않는지 본다.

### 5) Supabase Dashboard (값 채팅 금지)

1. Authentication → URL 설정에서 Staging Redirect URL을 확인한다.
2. Storage에서 `care-photos` 존재 여부만 확인한다 (없으면 승인 대기로 남김).
3. Migrations에서 `beauty_profiles` / care-photos 관련 **미적용**이 유지되는지 본다.
4. **키·전체 ref를 채팅에 붙이지 않는다.**

### 6) Vercel Dashboard (값 채팅 금지)

1. 프로젝트 Settings → Environment Variables에서 **Preview** 쪽만 본다.
2. Production 환경변수는 **변경하지 않는다.**
3. 키 값을 문서·채팅에 기록하지 않는다.

### 7) 공식 병원 출처 (T07)

1. 공식 출처 승인 후에만 관리자 검수 → publishable.
2. fixture 게시는 금지.

### 8) P1-006 정책·법무

1. 「앱 서버 일시 전송·영구 저장 없음·문진 기반」 문구가 코드/화면과 맞는지 담당 확인.
2. 에이전트 단독 완료 금지.

### 9) Production 직전 게이트 (지금 미실행)

1. **WQG-P0-002** `AI_PROVIDER`는 Production 배포 **직전**에만 확인.
2. main 병합 · Production 배포 · Production DB/env는 **명시 승인 전 금지**.
3. 지금 상태는 `RELEASE_GATE_PENDING`.

## 정직 경계 (위장 금지)

| 주장 | 사실 |
|------|------|
| selftest 통과 | 코드·계약 회귀만 |
| 스크린샷 40장 | 육안 승인 아님 |
| Staging 게이트 static | Dashboard 설정 확인 아님 |
| dry-run 온보딩 | 실공식 데이터 아님 |
| 본 패키지 생성 | 출시 승인 아님 |

## 금지

- main 병합 · Production 배포 · Production DB/Storage/env 변경
- Preview SSO/로그인/CAPTCHA 우회
- 자동 스크린샷을 육안 승인으로 표기
- 비밀키·전체 프로젝트 ref 출력
- commit/push (outer runner 담당)

## 관련

- P2-T01~T04 · T06 · WQ-G: `docs/prelaunch/`
- next_task: `T07` 공식 병원 실출처 (`external_only`)
