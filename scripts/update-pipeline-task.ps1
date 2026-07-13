# OPTIONAL: rewrite KBeautyMatch-Pipeline to the FIXED command only.
# Cursor / agents must NOT run this automatically — operator runs elevated once if needed.
#
# Target action (no secrets, no brands/products/allowCommit):
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<repo>\scripts\run-pipeline.ps1"
# which invokes: node scripts/run-pipeline-worker.mjs

param(
  [string]$TaskName = "KBeautyMatch-Pipeline",
  [int]$EveryHours = 6
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$ps1 = Join-Path $root "scripts\run-pipeline.ps1"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "MISSING: $TaskName — register manually once, then re-run this script elevated"
  exit 1
}

$trArg = "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`""
if ($trArg -match "SERVICE_ROLE|eyJ|cookie|password|secret|allowCommit|Brands|Products|-Mode") {
  throw "Refusing non-fixed scheduler args"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $trArg -WorkingDirectory $root
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerDaily = New-ScheduledTaskTrigger -Daily -At "00:30"
$minutes = [Math]::Max(60, $EveryHours * 60)
$rep = (New-ScheduledTaskTrigger -Once -At "00:30" -RepetitionInterval (New-TimeSpan -Minutes $minutes) -RepetitionDuration (New-TimeSpan -Hours 23)).Repetition
$triggerDaily.Repetition = $rep

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 10) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($triggerLogon, $triggerDaily) -Settings $settings | Out-Null
Write-Host "Updated $TaskName to FIXED config-driven worker (no CLI knobs)"
Write-Host "Arguments: $trArg"
