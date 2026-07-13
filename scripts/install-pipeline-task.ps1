# Generates a Task Scheduler XML/command for unattended pipeline runs.
# Does NOT register the task automatically (system change requires user).
#
# Usage:
#   .\scripts\install-pipeline-task.ps1
# Then follow printed schtasks command if you choose to register.

param(
  [string]$TaskName = "KBeautyMatch-Pipeline-DryRun",
  [string]$EveryMinutes = "60"
)

$root = Split-Path -Parent $PSScriptRoot
$ps1 = Join-Path $root "scripts\run-pipeline.ps1"

Write-Host "=== K-Beauty Match Pipeline Task Helper ==="
Write-Host "This script does NOT register a scheduled task."
Write-Host "Proposed task name: $TaskName"
Write-Host "Interval minutes: $EveryMinutes"
Write-Host ""
Write-Host "Manual register example (run elevated if required):"
Write-Host ("schtasks /Create /TN `"$TaskName`" /TR `"powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ps1`"`" /SC MINUTE /MO $EveryMinutes /F")
Write-Host ""
Write-Host "Set PIPELINE_BASE_URL and PIPELINE_ADMIN_COOKIE in the task environment yourself."
Write-Host "Never commit cookies or service role keys."
