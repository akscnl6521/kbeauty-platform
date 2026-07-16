param([string]$TaskName = "KBeautyMatch-Pipeline")
# Read-only inspection for operators. Agents should not run this in loops.

$ErrorActionPreference = "Continue"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "MISSING: $TaskName"
  exit 1
}

$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "TaskName:" $task.TaskName
Write-Host "State:" $task.State
Write-Host "LastRunTime:" $info.LastRunTime
Write-Host "LastTaskResult:" $info.LastTaskResult
Write-Host "NextRunTime:" $info.NextRunTime

$fail = $false
$task.Actions | ForEach-Object {
  Write-Host "Execute:" $_.Execute
  Write-Host "Arguments:" $_.Arguments
  Write-Host "WorkingDirectory:" $_.WorkingDirectory
  if ($_.Arguments -match "SERVICE_ROLE|supabase\.co|eyJ|cookie|password|secret") {
    Write-Host "FAIL: secret pattern in arguments"
    $fail = $true
  }
  if ($_.Arguments -match "allowCommit|Brands|Products|--brands|--products|-Mode\s+commit") {
    Write-Host "WARN: variable CLI knobs still present — prefer fixed run-pipeline.ps1 only"
  }
}

if ($fail) { exit 2 }
Write-Host "OK: inspected (operator tool; not part of Cursor agent loop)"
exit 0
