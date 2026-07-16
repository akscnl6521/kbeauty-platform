# Verifies catalog staging env without printing secrets.
# Usage:
#   .\scripts\verify-catalog-staging-env.ps1
#   .\scripts\verify-catalog-staging-env.ps1 -EnvFile .env.preview.staging
#
# Exit 0 + READY_FOR_STAGING_MIGRATION when staging is isolated and gated for dry-run.
# Exit 2 on blocked / mismatch states.

param(
  [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-DotEnvValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path -Encoding utf8) {
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
    $parts = $u.Host.Split(".")
    if ($parts.Length -gt 0) { return $parts[0] }
  } catch {}
  return $null
}

function Resolve-Value {
  param([string]$Key, [string]$FilePath)
  $fromEnv = [Environment]::GetEnvironmentVariable($Key)
  if (-not [string]::IsNullOrWhiteSpace($fromEnv)) { return $fromEnv }
  if ($FilePath) {
    $fromFile = Get-DotEnvValue $FilePath $Key
    if (-not [string]::IsNullOrWhiteSpace($fromFile)) { return $fromFile }
  }
  return $null
}

$candidates = @()
if ($EnvFile) { $candidates += (Join-Path $root $EnvFile) }
$candidates += (Join-Path $root ".env.preview.staging")
$candidates += (Join-Path $root ".env.local")

$envPath = $null
foreach ($c in $candidates) {
  if (Test-Path -LiteralPath $c) {
    $envPath = $c
    break
  }
}

$appEnv = Resolve-Value "APP_ENV" $envPath
$catalogDb = Resolve-Value "CATALOG_DATABASE_ENV" $envPath
$ingestion = Resolve-Value "CATALOG_INGESTION_ENABLED" $envPath
$cronEnabled = Resolve-Value "CATALOG_CRON_ENABLED" $envPath
$dryRun = Resolve-Value "CATALOG_DRY_RUN" $envPath
$autoPromote = Resolve-Value "CATALOG_AUTO_PROMOTE" $envPath
$maxPerSource = Resolve-Value "CATALOG_MAX_PRODUCTS_PER_SOURCE" $envPath

$projRef = Resolve-Value "SUPABASE_PROJECT_REF" $envPath
if (-not $projRef) {
  $url = Resolve-Value "NEXT_PUBLIC_SUPABASE_URL" $envPath
  $projRef = Extract-RefFromUrl $url
}

$prodRef = Resolve-Value "PRODUCTION_SUPABASE_PROJECT_REF" $envPath
if (-not $prodRef) { $prodRef = "rhfrmvkjsummaylpzmns" }

$serviceKey = Resolve-Value "SUPABASE_SERVICE_ROLE_KEY" $envPath
$serviceKeyPresent = -not [string]::IsNullOrWhiteSpace($serviceKey)

$same = ($projRef -eq $prodRef)
$gate = "blocked"
$code = "STAGING_DATABASE_REQUIRED"

if ($appEnv -eq "production") {
  $code = "PRODUCTION_DATABASE_DETECTED"
} elseif ($same) {
  $code = "PRODUCTION_DATABASE_DETECTED"
} elseif ([string]::IsNullOrWhiteSpace($projRef)) {
  $code = "STAGING_DATABASE_REQUIRED"
} elseif ($catalogDb -ne "staging") {
  $code = "ENVIRONMENT_MISMATCH"
} elseif ($appEnv -ne "preview") {
  $code = "ENVIRONMENT_MISMATCH"
} elseif (-not $serviceKeyPresent) {
  $code = "SERVICE_KEY_MISSING"
} elseif ($ingestion -ne "true") {
  $code = "ENVIRONMENT_MISMATCH"
} elseif ($cronEnabled -eq "true") {
  $code = "ENVIRONMENT_MISMATCH"
} elseif ($dryRun -eq "false") {
  $code = "ENVIRONMENT_MISMATCH"
} elseif ($autoPromote -eq "true") {
  $code = "ENVIRONMENT_MISMATCH"
} else {
  $gate = "allowed"
  $code = "READY_FOR_STAGING_MIGRATION"
}

$envFileLabel = if ($envPath) { Split-Path -Leaf $envPath } else { "none" }

Write-Host "env_file=$envFileLabel"
Write-Host "APP_ENV=$appEnv"
Write-Host "CATALOG_DATABASE_ENV=$catalogDb"
Write-Host "project_ref_masked=$(Mask-Ref $projRef)"
Write-Host "production_ref_masked=$(Mask-Ref $prodRef)"
Write-Host "refs_differ=$(-not $same)"
Write-Host "CATALOG_INGESTION_ENABLED=$ingestion"
Write-Host "CATALOG_CRON_ENABLED=$cronEnabled"
Write-Host "CATALOG_DRY_RUN=$dryRun"
Write-Host "CATALOG_AUTO_PROMOTE=$autoPromote"
Write-Host "CATALOG_MAX_PRODUCTS_PER_SOURCE=$maxPerSource"
Write-Host "service_key_present=$serviceKeyPresent"
Write-Host "ingestion_gate=$gate"
Write-Host "gate_code=$code"

if ($gate -ne "allowed") { exit 2 }
exit 0
