$ErrorActionPreference = 'Stop'
Set-Location 'E:\VSCODE\central-hub-v3'

function Step([string]$msg) {
  Write-Host "`n=== $msg ==="
}

try {
  Step 'Load Hub service vars'
  $varsRaw = npx @railway/cli variables --service central-hub-v3 --json
  $vars = $varsRaw | ConvertFrom-Json
  $base = 'https://dissidenthub.mastertibbles.co.uk'

  Step 'Login to Hub'
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $loginPage = Invoke-WebRequest -Uri "$base/auth/login" -Method GET -WebSession $session -UseBasicParsing
  $csrfMatch = [regex]::Match($loginPage.Content, 'name="csrf_token"[^>]*value="([^"]+)"')
  if (-not $csrfMatch.Success) {
    throw 'Could not extract CSRF token from login page'
  }
  $csrfToken = $csrfMatch.Groups[1].Value

  $null = Invoke-WebRequest -Uri "$base/auth/login" -Method POST -WebSession $session -Body @{
    csrf_token = $csrfToken
    username = $vars.ADMIN_USER
    password = $vars.ADMIN_PASS
  } -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue

  $me = Invoke-RestMethod -Uri "$base/auth/me" -Method GET -WebSession $session
  Write-Host "AUTH user=$($me.username) admin=$($me.is_admin)"

  $ping = Invoke-RestMethod -Uri "$base/api/ping" -Method GET -WebSession $session
  Write-Host "API ping ok=$($ping.ok)"

  Step 'Resolve guild and test members'
  $guilds = Invoke-RestMethod -Uri "$base/api/guilds" -Method GET -WebSession $session
  if (-not $guilds -or $guilds.Count -eq 0) { throw 'No guilds available' }
  $guild = $null
  $members = $null
  foreach ($candidate in $guilds) {
    Write-Host "GUILD_CANDIDATE id=$($candidate.id) discord_id=$($candidate.discord_id) name=$($candidate.name)"
    try {
      $probe = Invoke-RestMethod -Uri "$base/api/guilds/$($candidate.id)/moderation/member-search?query=a&limit=10" -Method GET -WebSession $session
      if (-not $probe -or $probe.Count -eq 0) {
        $probe = Invoke-RestMethod -Uri "$base/api/guilds/$($candidate.id)/moderation/member-search?query=e&limit=10" -Method GET -WebSession $session
      }

      if ($probe -and $probe.Count -gt 0) {
        $guild = $candidate
        $members = $probe
        break
      }
    }
    catch {
      Write-Host "GUILD_CANDIDATE_SKIPPED id=$($candidate.id) reason=$($_.Exception.Message)"
    }
  }

  if (-not $guild) {
    throw 'No guild with searchable members found for moderation tests'
  }
  Write-Host "GUILD id=$($guild.id) discord_id=$($guild.discord_id) name=$($guild.name)"

  $target1 = $members | Select-Object -First 1
  $target2 = if ($members.Count -gt 1) { $members | Select-Object -Skip 1 -First 1 } else { $target1 }
  Write-Host "TARGET1 id=$($target1.id)"
  Write-Host "TARGET2 id=$($target2.id)"

  Step 'Single moderation action (warn)'
  $singlePayload = @{
    action = 'warn'
    user_id = "$($target1.id)"
    target_name = "$($target1.username)"
    reason = "Live validation single warn $(Get-Date -Format s)"
  } | ConvertTo-Json
  $single = Invoke-RestMethod -Uri "$base/api/guilds/$($guild.id)/moderation/actions" -Method POST -WebSession $session -Body $singlePayload -ContentType 'application/json'
  Write-Host "SINGLE success=$($single.success) message=$($single.message) caseId=$($single.caseId)"

  Step 'Bulk moderation action (warn)'
  $bulkPayload = @{
    action = 'warn'
    user_ids = @("$($target1.id)", "$($target2.id)")
    reason = "Live validation bulk warn $(Get-Date -Format s)"
  } | ConvertTo-Json
  $bulk = Invoke-RestMethod -Uri "$base/api/guilds/$($guild.id)/moderation/bulk" -Method POST -WebSession $session -Body $bulkPayload -ContentType 'application/json'
  Write-Host "BULK success=$($bulk.success) ok=$($bulk.summary.successful) fail=$($bulk.summary.failed) total=$($bulk.summary.total)"

  Step 'Global ban create/list/delete (temporary test user)'
  $testGlobalId = '123456789012345678'

  $globalCreatePayload = @{
    user_id = $testGlobalId
    username = 'validation-user'
    reason = "Live validation temporary global ban $(Get-Date -Format s)"
    evidence = 'temporary validation case'
    source_guild_id = $guild.id
    delete_messages = $false
  } | ConvertTo-Json
  $globalCreate = Invoke-RestMethod -Uri "$base/api/moderation/global-bans" -Method POST -WebSession $session -Body $globalCreatePayload -ContentType 'application/json'
  Write-Host "GLOBAL_CREATE success=$($globalCreate.success) userId=$($globalCreate.userId)"

  $globalList = Invoke-RestMethod -Uri "$base/api/moderation/global-bans" -Method GET -WebSession $session
  $exists = ($globalList | Where-Object { $_.user_id -eq $testGlobalId }).Count -gt 0
  Write-Host "GLOBAL_LIST contains_test_id=$exists count=$($globalList.Count)"

  $globalDeletePayload = @{ reason = "Live validation cleanup $(Get-Date -Format s)" } | ConvertTo-Json
  $globalDelete = Invoke-RestMethod -Uri "$base/api/moderation/global-bans/$testGlobalId" -Method DELETE -WebSession $session -Body $globalDeletePayload -ContentType 'application/json'
  Write-Host "GLOBAL_DELETE success=$($globalDelete.success) userId=$($globalDelete.userId)"

  Step 'Recent moderation check'
  $recent = Invoke-RestMethod -Uri "$base/api/moderation/recent" -Method GET -WebSession $session
  if ($recent.Count -gt 0) {
    Write-Host "RECENT count=$($recent.Count) top_action=$($recent[0].action)"
  }
  else {
    Write-Host 'RECENT count=0'
  }

  Write-Host "`nLIVE VALIDATION COMPLETED"
}
catch {
  Write-Host "`nLIVE VALIDATION FAILED: $($_.Exception.Message)"
  throw
}
