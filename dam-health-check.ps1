# dam-health-check.ps1
# Scheduled task: confirms the DAM sync queue is draining and
# alerts if assets are stuck or the dead-letter queue is growing.

param(
    [string]$DamApiBaseUrl = $env:DAM_API_BASE_URL,
    [string]$AlertWebhookUrl = $env:SYNC_ALERT_WEBHOOK,
    [int]$StuckThresholdMinutes = 30,
    [int]$DeadLetterAlertCount = 5
)

function Get-QueueSnapshot {
    param([string]$BaseUrl)

    $headers = @{ Authorization = "Bearer $env:DAM_API_TOKEN" }
    Invoke-RestMethod -Uri "$BaseUrl/sync/queue/status" -Headers $headers -Method Get
}

function Send-Alert {
    param([string]$Message)

    if (-not $AlertWebhookUrl) { return }

    $body = @{ text = $Message } | ConvertTo-Json
    Invoke-RestMethod -Uri $AlertWebhookUrl -Method Post -Body $body -ContentType "application/json"
}

try {
    $snapshot = Get-QueueSnapshot -BaseUrl $DamApiBaseUrl
    $now = Get-Date

    $stuck = $snapshot.inFlight | Where-Object {
        ((New-TimeSpan -Start ([datetime]$_.enqueuedAt) -End $now).TotalMinutes) -gt $StuckThresholdMinutes
    }

    if ($stuck.Count -gt 0) {
        $names = ($stuck | Select-Object -ExpandProperty assetName) -join ", "
        Send-Alert "DAM sync: $($stuck.Count) asset(s) stuck past $StuckThresholdMinutes min - $names"
        Write-Warning "Stuck assets detected: $names"
    }

    if ($snapshot.deadLetterCount -ge $DeadLetterAlertCount) {
        Send-Alert "DAM sync: dead-letter queue at $($snapshot.deadLetterCount) items - investigate"
        Write-Warning "Dead-letter queue threshold exceeded: $($snapshot.deadLetterCount)"
    }

    Write-Output "Health check complete: $($snapshot.inFlight.Count) in flight, $($snapshot.deadLetterCount) dead-lettered."
}
catch {
    Send-Alert "DAM sync health check failed to run: $($_.Exception.Message)"
    Write-Error "Health check error: $($_.Exception.Message)"
    exit 1
}
