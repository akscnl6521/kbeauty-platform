# K-Beauty Match local pipeline worker (PowerShell)
# Does NOT register Task Scheduler automatically.
#
# Examples:
#   .\scripts\run-pipeline.ps1
#   .\scripts\run-pipeline.ps1 -Mode dry_run -Brands 5 -Tick 10
#   $env:PIPELINE_ADMIN_COOKIE="..."; .\scripts\run-pipeline.ps1 -Batch <id>

param(
  [ValidateSet("dry_run", "commit")]
  [string]$Mode = "dry_run",
  [int]$Brands = 5,
  [int]$Tick = 10,
  [string]$Batch = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "[pipeline] mode=$Mode brands=$Brands tick=$Tick"

$argsList = @("scripts/run-pipeline.mjs", "--mode=$Mode", "--brands=$Brands", "--tick=$Tick")
if ($Batch) { $argsList += "--batch=$Batch" }

node @argsList
exit $LASTEXITCODE
