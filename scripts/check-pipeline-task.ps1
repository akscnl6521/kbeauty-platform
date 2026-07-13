param([string]$TaskName = "KBeautyMatch-Pipeline")
$ErrorActionPreference = "Continue"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "MISSING: $TaskName"
  exit 1
}

Write-Host "TaskName:" $task.TaskName
Write-Host "State:" $task.State
$actions = ($task | Get-ScheduledTaskInfo)
$task.Actions | ForEach-Object {
  Write-Host "Execute:" $_.Execute
  Write-Host "Arguments:" $_.Arguments
  Write-Host "WorkingDirectory:" $_.WorkingDirectory
  if ($_.Arguments -match "SERVICE_ROLE|supabase\.co|eyJ|cookie|password|secret") {
    Write-Host "WARN: possible secret pattern in arguments"
    exit 2
  }
}
Write-Host "OK: no obvious secrets in arguments"
exit 0
