# 30. GitHub + Supabase 자동 백업 연동

## 목표

Cursor에서 작업한 **코드·마이그레이션**을 GitHub에 백업하고,  
Supabase 스키마는 `supabase/migrations`로 버전 관리한다.

| 대상 | 백업 위치 | 자동 방식 |
|------|-----------|-----------|
| 앱 코드 | GitHub `main` | `git push` + GitHub Actions CI |
| DB 스키마 SQL | `supabase/migrations/` | git에 포함 → GitHub에 함께 백업 |
| 원격 DB 적용 | Supabase 프로젝트 | **수동** (`workflow_dispatch` 또는 CLI) |

> 원격 DB에 migration을 자동으로 매일 push 하지 않는다.  
> 잘못 적용되면 복구가 어렵기 때문에 **확인 후 적용**이 기본이다.

현재 연결 정보:

- GitHub: `https://github.com/akscnl6521/kbeauty-platform.git`
- Supabase: `https://rhfrmvkjsummaylpzmns.supabase.co` (project ref: `rhfrmvkjsummaylpzmns`)

## 1) 일상 백업 (코드 → GitHub)

### PowerShell 스크립트

```powershell
.\scripts\backup-to-github.ps1
.\scripts\backup-to-github.ps1 -Message "feat: catalog review page"
```

하거나 Cursor에서 커밋 요청 후:

```powershell
git add -A
git commit -m "메시지"
git push -u origin HEAD
```

`.env.local` 등 비밀값은 `.gitignore`로 제외된다.

### GitHub Actions (푸시 시)

- `.github/workflows/ci.yml` — `npm run build` + migration SQL 점검
- `.github/workflows/backup-healthcheck.yml` — 매일 경로 헬스체크

## 2) Supabase CLI 링크 (로컬 1회)

Access Token: [Account Tokens](https://supabase.com/dashboard/account/tokens)  
DB Password: Project Settings → Database

```powershell
npx supabase login
npx supabase link --project-ref rhfrmvkjsummaylpzmns
```

링크 후:

```powershell
# 원격에 아직 없는 migration만 적용 (주의: 운영 DB 변경)
npx supabase db push
```

`product_offers` migration은 검토가 끝난 뒤에만 push 한다.

## 3) GitHub → Supabase migration 적용 (수동 트리거)

1. GitHub repo → **Settings → Secrets and variables → Actions**
2. 시크릿 등록:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_ID` = `rhfrmvkjsummaylpzmns`
   - `SUPABASE_DB_PASSWORD`
3. **Actions → Supabase Migrations → Run workflow**
4. `confirm` 입력란에 `apply` 입력 후 실행

파일: `.github/workflows/supabase-migrations.yml`

## 4) Cursor에서 권장 루틴

1. 기능 작업 완료  
2. `npm run build`  
3. `.\scripts\backup-to-github.ps1` 또는 커밋+push  
4. DB 스키마 변경이 있으면 migration 파일 검토  
5. 준비되면 `supabase db push` 또는 Actions `apply`

## 5) 백업이 아닌 것

- Supabase **데이터(행)** 자동 덤프는 이 설정에 포함하지 않음  
  → Dashboard export 또는 Pro PITR 사용
- `.env.local` 은 GitHub에 올리지 않음  
  → 별도 비밀번호 관리자 / Vercel env에 보관

## 검증

1. `git remote -v` → origin이 GitHub인지  
2. push 후 GitHub Actions CI 초록불  
3. `supabase/migrations` 파일이 GitHub에 보이는지  
4. (선택) Actions에서 migration `apply` 성공  
