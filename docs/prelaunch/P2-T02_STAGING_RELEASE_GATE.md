# P2-T02 — Staging read-only release gates

최종 갱신: 2026-07-24
분류: `verified_complete` (게이트 계약·static/selftest) · Dashboard 실확인·원격 적용 이력은 `dashboard_only_unknown` / `external_only`

## 목적

Staging 출시 전 **읽기 전용** 게이트로 아래를 검증한다.

| 영역 | 내용 |
|------|------|
| environment identity | Staging vs Production ref · APP_ENV · CATALOG_DATABASE_ENV |
| health | `/api/health` 소스·계약 · (선택) 라이브 응답 |
| tables / contracts | 기대 테이블 목록 · (선택) anon SELECT head |
| auth callback | `token_hash` / `type` / `code` / `next` · OTP·PKCE · safe-next |
| storage | `care-photos` 이름·DRAFT · **실버킷은 Dashboard 전용** |
| publication states | `discovered`→`published` · pipeline 파괴 플래그 OFF |
| migrations | dated 파일 존재 · DRAFT 존재 · **적용 이력은 Dashboard 전용** |

**기본은 read-only / static.** Production 쓰기·migration apply·Storage 생성 없음.

## 명령

```bash
# 계약·static 게이트 selftest (서버·Staging 불필요)
npm run test:staging-release-gate

# 기본 static 게이트 (로컬 파일·env presence)
npm run check:staging-release-gate

# 선택: 읽기 전용 라이브 probe (헬스 + SELECT head)
BASE_URL=http://127.0.0.1:3000 npm run check:staging-release-gate -- --mode=readonly
```

## 아티팩트

| 경로 | 내용 |
|------|------|
| `artifacts/staging-release-gate/latest-result.json` | machine-readable |
| `artifacts/staging-release-gate/latest-summary.md` | 사람용 요약 |

gitignore 대상.

## 정직 경계 (위장 금지)

| factKind | 의미 |
|----------|------|
| `verified` | 코드/파일/SELECT-only로 확인 |
| `dashboard_only_unknown` | Supabase/Vercel Dashboard에서만 확인 (Redirect URL, Storage 버킷, migration 적용 이력, published 집계) |
| `skipped` | 자격 증명·BASE_URL 없어 생략 |
| `blocked` | Production 식별 → 즉시 중단 |

Dashboard-only 항목을 `pass`로 바꾸지 않는다.

## 금지

- Production 호스트·Production project ref probe
- INSERT / UPDATE / DELETE / migration apply
- 비밀키·전체 project ref 출력
- Auth Redirect URL·Storage 버킷 존재를 코드만으로 완료 주장

## 재사용

- 계약: `src/lib/release/stagingReleaseGate.ts`
- Production 차단: `KNOWN_PRODUCTION_SUPABASE_REF` · Staging `KNOWN_STAGING_SUPABASE_REF`
- 파이프라인 플래그: `config/pipeline-operation.json` ( `check:release-security` 와 동일 계열 )
- care-photos: `CARE_PHOTO_BUCKET` · DRAFT migration

## 관련

- T06 릴리스 증거: `docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md`
- WQ-G: `docs/prelaunch/WQ-G_PRELAUNCH_GATE.md` (WQG-P0-002는 Production 직전 · 지금 미실행)
- Auth: `docs/153-domain-auth-validation.md` · `docs/149-staging-deployment.md`
