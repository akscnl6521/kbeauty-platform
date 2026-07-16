<#
.SYNOPSIS
  로컬 변경을 GitHub(origin/main)에 백업 push 합니다.

.DESCRIPTION
  - .env* 는 커밋하지 않습니다.
  - 커밋 메시지가 없으면 타임스탬프 기본 메시지를 사용합니다.
  - Supabase 원격 DB는 건드리지 않습니다 (스키마는 git의 migrations로 백업).

.EXAMPLE
  .\scripts\backup-to-github.ps1
  .\scripts\backup-to-github.ps1 -Message "chore: backup catalog work"
#>
param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "== git status ==" -ForegroundColor Cyan
git status -sb

$dirty = git status --porcelain
if (-not $dirty) {
  Write-Host "커밋할 변경이 없습니다. remote sync만 확인합니다." -ForegroundColor Yellow
  git push -u origin HEAD
  exit 0
}

# Block secrets
$blocked = @(
  ".env",
  ".env.local",
  ".env.production",
  "credentials.json"
)
foreach ($line in ($dirty -split "`n")) {
  $path = ($line.Trim() -replace '^..\s+', '').Trim()
  foreach ($b in $blocked) {
    if ($path -eq $b -or $path -like "*/$b") {
      throw "보안: '$path' 는 커밋할 수 없습니다. .gitignore를 확인하세요."
    }
  }
}

git add -A
# unstage env if somehow staged
git reset HEAD -- .env .env.local .env.* 2>$null

if (-not $Message) {
  $Message = "chore: backup $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git commit -m $Message
git push -u origin HEAD

Write-Host "GitHub 백업 완료." -ForegroundColor Green
Write-Host "Supabase 스키마 백업: supabase/migrations/*.sql (원격 적용은 별도)" -ForegroundColor Green
