param([string]$TaskName = "KBeautyMatch-Pipeline")
$ErrorActionPreference = "Stop"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Unregistered: $TaskName"
