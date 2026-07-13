# Staging Supabase Setup — K-Beauty Match

Preview와 Production이 **동일한** Supabase 프로젝트(`rhfr***mns`)를 쓰면  
카탈로그 실수집·migration 적용은 코드 게이트에 의해 차단됩니다.

이 문서는 **별도 staging 프로젝트**를 만든 뒤 Preview만 연결하는 절차입니다.

## 1. Supabase Dashboard에서 신규 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) → New project
2. 권장 이름: `kbeauty-match-staging`
3. 리전은 Production과 동일하게 유지해도 됩니다 (데이터는 완전히 분리)
4. 생성된 **Project URL / anon key / service role key**를 안전한 곳에만 보관

## 2. Vercel Preview 환경변수

Preview 환경에만 설정 (Production은 기존 프로젝트 유지):

| Variable | Preview 값 | Production 값 |
|----------|------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | staging URL | 기존 Production URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon | 기존 anon |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service role | 기존 service role |
| `SUPABASE_PROJECT_REF` | staging ref | Production ref |
| `APP_ENV` | `preview` | `production` |
| `CATALOG_DATABASE_ENV` | `staging` | `production` |
| `CATALOG_INGESTION_ENABLED` | `true` | `false` |
| `CATALOG_CRON_ENABLED` | `false` | `false` |
| `CATALOG_DRY_RUN` | `true` | `true` |
| `CATALOG_AUTO_PROMOTE` | `false` | `false` |
| `CATALOG_MAX_PRODUCTS_PER_SOURCE` | `20` | `0` 또는 미사용 |
| `PRODUCTION_SUPABASE_PROJECT_REF` | `rhfrmvkjsummaylpzmns` | 동일 |

## 3. 로컬 `.env.local` (staging 작업 시)

로컬에서 실수집 dry-run을 할 때만 staging 값으로 교체합니다.  
**절대 git에 commit하지 마세요.**

## 4. project ref 비교

```powershell
.\scripts\verify-catalog-staging-env.ps1
```

기대 결과:

- `CATALOG_DATABASE_ENV=staging`
- masked project ref ≠ Production masked ref
- `ingestion gate: allowed` (dry-run)

동일 ref면:

- `code: STAGING_DATABASE_REQUIRED`
- migration / crawl / insert 모두 금지

## 5. migration 적용 (staging만)

게이트 통과 후에만:

```powershell
# 예시 — 실제 CLI는 로컬 supabase link 후
npx supabase db push --project-ref <STAGING_REF>
```

포함 파일 예:

- `20260714010000_create_catalog_staging_automation.sql`
- `20260714020000_catalog_staging_fixture_isolation.sql`
- `20260714030000_add_scalp_hair_catalog_fields.sql`

**현재 shared Production 프로젝트에는 적용하지 마세요.**

## 5b. staging 연결 후 scalp/hair 초기 수집 목표 (dry-run)

수량을 맞추기 위해 미확인 제품을 승인하지 않습니다.

| 그룹 | 목표 |
|------|------|
| 일반 샴푸 | 30 |
| 지성 두피 샴푸 | 15 |
| 건성·민감 두피 샴푸 | 15 |
| 비듬·각질 관리 샴푸 | 15 |
| 탈모 증상 완화 기능성(공식 확인) | 최대 20 |
| 컨디셔너 | 20 |
| 트리트먼트·헤어마스크 | 20 |
| 두피 토닉·세럼 | 15 |
| 헤어 오일·리브인 | 20 |

허용 source: 브랜드 공식몰, 승인된 쿠팡/올리브영 connector, 공인 판매처, 공개 성분 DB 보조.

## 6. dry-run

```powershell
npx tsx scripts/run-catalog-automation-dry-run.ts
```

초기: `CATALOG_DRY_RUN=true`, `CATALOG_AUTO_PROMOTE=false`, source당 최대 20개.

## 7. 폐기 (rollback 대신)

staging 프로젝트가 더 이상 필요 없으면 Supabase Dashboard에서 프로젝트 삭제로 폐기합니다.  
Production DB를 “되돌리는” 방식이 아닙니다.

## 8. 절대 commit하면 안 되는 값

- `.env` / `.env.local`
- Supabase URL / anon / service role
- 쿠팡·제휴 키
- 쿠키·세션
- raw HTML dump

## 9. 다음 명령 (한 줄)

Staging 프로젝트 생성 + Preview env 연결이 끝나면:

```text
.\scripts\verify-catalog-staging-env.ps1
```

통과 후 Real Catalog / scalp-hair dry-run Sprint를 재실행하세요.
