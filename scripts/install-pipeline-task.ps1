# Registers KBeautyMatch-Pipeline scheduled task (dry_run).
# May require elevated PowerShell (UAC). Arguments never include secrets.

param(
  [string]$TaskName = "KBeautyMatch-Pipeline",
  [int]$EveryMinutes = 60
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

$trArg = "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`" -Mode dry_run -Brands 3 -Products 5 -Tick 3 -MaxTicks 40"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $trArg -WorkingDirectory $root

# At logon + daily repeating window (finite duration — MaxValue is invalid on some Windows builds)
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerDaily = New-ScheduledTaskTrigger -Daily -At "00:15"
$triggerDaily.Repetition = (New-ScheduledTaskTrigger -Once -At "00:15" -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Hours 23)).Repetition

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($triggerLogon, $triggerDaily) `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Registered task: $TaskName"
Write-Host "WorkingDirectory: $root"
Write-Host "Mode: dry_run (no secrets in task arguments)"
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State, TaskPath
