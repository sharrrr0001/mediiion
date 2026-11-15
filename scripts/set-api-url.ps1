# Point the Vercel site at a permanent API address (e.g. the always-on server) instead of a tunnel.
#
#   .\scripts\set-api-url.ps1 -Url https://152-67-10-20.sslip.io -Push
#
# Rewrites the /api destination in apps/web/vercel.json; with -Push commits only that file on main.
param([Parameter(Mandatory = $true)][string]$Url, [switch]$Push)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$vercelJson = Join-Path $root 'apps\web\vercel.json'
$Url = $Url.TrimEnd('/')
if ($Url -notmatch '^https://[a-z0-9.-]+$') { throw 'Use an https address without a path, e.g. https://152-67-10-20.sslip.io' }
try { $null = Invoke-WebRequest -ErrorAction Stop -UseBasicParsing -TimeoutSec 15 "$Url/health" }
catch { throw "$Url/health does not answer. Is the server running?" }

$json = Get-Content $vercelJson -Raw | ConvertFrom-Json
$json.rewrites[0].destination = "$Url/:path*"
[System.IO.File]::WriteAllText($vercelJson, ($json | ConvertTo-Json -Depth 10))
Write-Host "apps/web/vercel.json now sends /api to $Url"
if ($Push) {
  git -C $root commit -m "chore: point the live site at the always-on API server" -- apps/web/vercel.json
  git -C $root push
  Write-Host 'Pushed. Vercel redeploys in 1-2 minutes. You can stop the PC tunnel: .\scripts\stop-all.ps1'
}
