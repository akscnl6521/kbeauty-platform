# Verifies catalog staging env without printing secrets.
# Usage: .\scripts\verify-catalog-staging-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-DotEnvValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content $Path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    $i = $t.IndexOf("=")
    if ($i -le 0) { continue }
    $k = $t.Substring(0, $i).Trim()
    if ($k -ne $Key) { continue }
    $v = $t.Substring($i + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    return $v
  }
  return $null
}

function Mask-Ref {
  param([string]$Ref)
  if ([string]::IsNullOrWhiteSpace($Ref)) { return "missing" }
  if ($Ref.Length -le 8) { return ($Ref.Substring(0, 2) + "***") }
  return ($Ref.Substring(0, 4) + "***" + $Ref.Substring($Ref.Length - 3))
}

function Extract-RefFromUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  try {
    $u = [Uri]$Url
    $host = $u.Host
    $parts = $host.Split(".")
    if ($parts.Length -gt 0) { return $parts[0] }
  } catch {}
  return $null
}

$envLocal = Join-Path $root ".env.local"
$appEnv = $env:APP_ENV
if (-not $appEnv) { $appEnv = Get-DotEnvValue $envLocal "APP_ENV" }
$catalogDb = $env:CATALOG_DATABASE_ENV
if (-not $catalogDb) { $catalogDb = Get-DotEnvValue $envLocal "CATALOG_DATABASE_ENV" }
$ingestion = $env:CATALOG_INGESTION_ENABLED
if (-not $ingestion) { $ingestion = Get-DotEnvValue $envLocal "CATALOG_INGESTION_ENABLED" }
$dryRun = $env:CATALOG_DRY_RUN
if (-not $dryRun) { $dryRun = Get-DotEnvValue $envLocal "CATALOG_DRY_RUN" }
$autoPromote = $env:CATALOG_AUTO_PROMOTE
if (-not $autoPromote) { $autoPromote = Get-DotEnvValue $envLocal "CATALOG_AUTO_PROMOTE" }

$projRef = $env:SUPABASE_PROJECT_REF
if (-not $projRef) { $projRef = Get-DotEnvValue $envLocal "SUPABASE_PROJECT_REF" }
if (-not $projRef) {
  $url = $env:NEXT_PUBLIC_SUPABASE_URL
  if (-not $url) { $url = Get-DotEnvValue $envLocal "NEXT_PUBLIC_SUPABASE_URL" }
  $projRef = Extract-RefFromUrl $url
}

$prodRef = $env:PRODUCTION_SUPABASE_PROJECT_REF
if (-not $prodRef) { $prodRef = Get-DotEnvValue $envLocal "PRODUCTION_SUPABASE_PROJECT_REF" }
if (-not $prodRef) { $prodRef = "rhfrmvkjsummaylpzmns" }

$same = ($projRef -eq $prodRef)
$gate = "blocked"
$code = "STAGING_DATABASE_REQUIRED"
if ($appEnv -eq "production") {
  $code = "PRODUCTION_ENV"
} elseif ($same -or [string]::IsNullOrWhiteSpace($projRef)) {
  $code = "STAGING_DATABASE_REQUIRED"
} elseif ($catalogDb -ne "staging") {
  $code = "STAGING_DATABASE_REQUIRED"
} elseif ($ingestion -ne "true") {
  $code = "INGESTION_DISABLED"
} elseif ($dryRun -eq "false") {
  $code = "DRY_RUN_REQUIRED"
} elseif ($autoPromote -eq "true") {
  $code = "INGESTION_DISABLED"
} else {
  $gate = "allowed"
  $code = "STAGING_READY"
}

Write-Host "APP_ENV=$appEnv"
Write-Host "CATALOG_DATABASE_ENV=$catalogDb"
Write-Host "project_ref_masked=$(Mask-Ref $projRef)"
Write-Host "production_ref_masked=$(Mask-Ref $prodRef)"
Write-Host "refs_differ=$(-not $same)"
Write-Host "CATALOG_INGESTION_ENABLED=$ingestion"
Write-Host "CATALOG_DRY_RUN=$dryRun"
Write-Host "CATALOG_AUTO_PROMOTE=$autoPromote"
Write-Host "ingestion_gate=$gate"
Write-Host "gate_code=$code"

if ($gate -ne "allowed") { exit 2 }
exit 0
