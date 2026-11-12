# Expose the live Medicos API (:4100) to the Vercel site through a free Cloudflare quick tunnel,
# and point the site at it.
#
#   .\scripts\start-tunnel.ps1          start the tunnel and update apps/web/vercel.json
#   .\scripts\start-tunnel.ps1 -Push    ...and commit + push, so Vercel redeploys (1-2 minutes)
#   .\scripts\start-tunnel.ps1 -Restart ...a new tunnel even if the current one still works
#
# A quick tunnel gets a new random address every time it starts, so run this with -Push after
# each restart. Only Medicos's own tunnel is stopped (by PID), never other cloudflared tunnels.
param([switch]$Push, [switch]$Restart)

# Continue, not Stop: Windows PowerShell 5.1 turns git's progress output (stderr) into an error.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$vercelJson = Join-Path $root 'apps\web\vercel.json'
$state = Join-Path $env:TEMP 'medicos-live'
$log = Join-Path $state 'tunnel.log'
$pidFile = Join-Path $state 'tunnel.pid'
New-Item -ItemType Directory -Force $state | Out-Null

try { $null = Invoke-WebRequest -ErrorAction Stop -UseBasicParsing -TimeoutSec 5 'http://localhost:4100/health' }
catch { throw 'The live API is not running on :4100. Run .\scripts\start-all.ps1 instead.' }

function Get-TunnelProcess {
  if (-not (Test-Path $pidFile)) { return $null }
  Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'cloudflared' }
}

# Keep a tunnel that still works (its address is the one in vercel.json), unless -Restart.
$current = [regex]::Match((Get-Content $vercelJson -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com').Value
if (-not $Restart -and $current -and (Get-TunnelProcess)) {
  try {
    $null = Invoke-WebRequest -ErrorAction Stop -UseBasicParsing -TimeoutSec 10 "$current/health"
    Write-Host "Tunnel: $current (still working, kept)"
    return
  } catch {
    Write-Host 'The running tunnel does not answer; starting a new one.'
  }
}

$old = Get-TunnelProcess
if ($old) { Write-Host 'Stopping the previous Medicos tunnel...'; Stop-Process -Id $old.Id -Force }
Remove-Item $log -ErrorAction SilentlyContinue
$p = Start-Process cloudflared -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://localhost:4100', '--logfile', $log) -WindowStyle Hidden -PassThru
Set-Content $pidFile $p.Id

$url = $null
foreach ($i in 1..60) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Where-Object { $_.Line -notmatch 'api\.trycloudflare' } | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}
if (-not $url) { throw "No tunnel address after 60 s. See $log" }
Write-Host "Tunnel: $url"

$json = Get-Content $vercelJson -Raw
$new = $json -replace 'https://[a-z0-9-]+\.trycloudflare\.com', $url
[System.IO.File]::WriteAllText($vercelJson, $new)
Write-Host 'Updated apps/web/vercel.json'

if ($Push) {
  if ($json -eq $new) { Write-Host 'Address unchanged; nothing to push.'; return }
  # Vercel deploys main: only commit there, and only this file (never other staged work).
  $branch = (git -C $root rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne 'main') {
    Write-Host "On branch '$branch', not main: vercel.json is updated but not committed."
    return
  }
  git -C $root commit -m "chore: point the live site at the current API tunnel" -- apps/web/vercel.json
  git -C $root push
  if ($LASTEXITCODE -eq 0) { Write-Host 'Pushed. Vercel redeploys in 1-2 minutes.' }
  else { Write-Host 'The push failed: commit and push apps/web/vercel.json yourself so Vercel picks it up.' }
} else {
  Write-Host 'Run again with -Push (or commit and push apps/web/vercel.json) so Vercel picks it up.'
}
