# K-Beauty Match unattended pipeline worker (PowerShell)
# Reads .env.local via Node script — never pass secrets as arguments.
#
# Examples:
#   .\scripts\run-pipeline.ps1
#   .\scripts\run-pipeline.ps1 -Mode dry_run -Brands 3 -Tick 3
#   .\scripts\run-pipeline.ps1 -Batch <uuid>

param(
  [ValidateSet("dry_run", "commit")]
  [string]$Mode = "dry_run",
  [int]$Brands = 3,
  [int]$Products = 5,
  [int]$Tick = 3,
  [int]$MaxTicks = 30,
  [string]$Batch = "",
  [switch]$AllowCommit
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root "data\pipeline\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "pipeline-$stamp.log"

Get-ChildItem $logDir -Filter "pipeline-*.log" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 40 |
  Remove-Item -Force -ErrorAction SilentlyContinue

$lockFile = Join-Path $root "data\pipeline\runtime\worker.lock"
New-Item -ItemType Directory -Force -Path (Split-Path $lockFile) | Out-Null
if (Test-Path $lockFile) {
  $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($lockAge.TotalMinutes -lt 30) {
    "[{0}] skip — worker.lock present (age {1:N1}m)" -f (Get-Date).ToString("o"), $lockAge.TotalMinutes |
      Tee-Object -FilePath $logFile -Append
    exit 0
  }
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $lockFile -Value ("pid={0}; at={1}" -f $PID, (Get-Date).ToString("o"))

try {
  if (-not (Test-Path (Join-Path $root ".env.local"))) {
    throw ".env.local missing (existence check only; contents not logged)"
  }

  $nodeArgs = @(
    "--mode=$Mode",
    "--brands=$Brands",
    "--products=$Products",
    "--tick=$Tick",
    "--maxTicks=$MaxTicks"
  )
  if ($Batch) { $nodeArgs += "--batch=$Batch" }
  if ($Mode -eq "commit") {
    if (-not $AllowCommit) { throw "commit requires -AllowCommit" }
    $nodeArgs += "--allowCommit=true"
  }

  "[{0}] start mode={1} brands={2}" -f (Get-Date).ToString("o"), $Mode, $Brands |
    Tee-Object -FilePath $logFile -Append

  & node (Join-Path $root "scripts\run-pipeline-worker.mjs") @nodeArgs 2>&1 |
    Tee-Object -FilePath $logFile -Append
  $code = $LASTEXITCODE
  "[{0}] exit=$code" -f (Get-Date).ToString("o") | Tee-Object -FilePath $logFile -Append
  exit $code
}
finally {
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
