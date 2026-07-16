# OPTIONAL one-time register. Agents must not auto-run.
# Fixed action only — see update-pipeline-task.ps1 / docs/83.

param(
  [string]$TaskName = "KBeautyMatch-Pipeline",
  [int]$EveryHours = 6
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$ps1 = Join-Path $root "scripts\run-pipeline.ps1"

if (-not (Test-Path $ps1)) { throw "Missing $ps1" }
if (-not (Test-Path (Join-Path $root ".env.local"))) {
  throw ".env.local missing (not reading contents)"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node not found in PATH"
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "EXISTS: $TaskName — use update-pipeline-task.ps1 once if args need fixing"
  exit 0
}

$trArg = "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`""
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

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($triggerLogon, $triggerDaily) `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Registered $TaskName (fixed worker entry)"
