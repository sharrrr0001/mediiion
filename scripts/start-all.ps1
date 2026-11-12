# Start the live Medicos backend on this PC, in the background:
# Docker (Postgres, Redis, S3), the production API on :4100 (reads .env.live) and the Cloudflare
# tunnel that the Vercel site talks to.
#
#   .\scripts\start-all.ps1           build + start all (logs in %TEMP%\medicos-live\*.log)
#   .\scripts\start-all.ps1 -NoBuild  skip the build (faster when the code has not changed)
#   .\scripts\stop-all.ps1            stop the API and the tunnel (Docker keeps running)
#
# Runs next to `pnpm dev` (dev uses :3001/:4000 and the medicos database; live uses medicos_live).
param([switch]$NoBuild)
# Continue, not Stop: Windows PowerShell 5.1 turns any stderr line from docker/pnpm into an error.
# Every native command's exit code is checked explicitly instead.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$state = Join-Path $env:TEMP 'medicos-live'
New-Item -ItemType Directory -Force $state | Out-Null

if (-not (Test-Path (Join-Path $root '.env.live'))) { throw 'No .env.live yet. Run .\scripts\setup-live.ps1 first.' }

function Wait-Until([scriptblock]$check, [int]$seconds, [string]$what) {
  foreach ($i in 1..$seconds) { if (& $check) { return }; Start-Sleep -Seconds 1 }
  throw "$what did not start within $seconds s. See the logs in $state"
}

# 1. Docker Desktop, then Postgres + Redis + S3.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Starting Docker Desktop...'
  $docker = @("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe", 'C:\Program Files\Docker\Docker\Docker Desktop.exe') |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  Start-Process $docker
  Wait-Until { docker info *> $null; $LASTEXITCODE -eq 0 } 180 'Docker'
}
Write-Host 'Postgres + Redis + S3...'
docker compose -f (Join-Path $root 'docker-compose.yml') up -d --wait postgres redis s3 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed.' }

Push-Location $root
try {
  # 2. Apply any new migrations, then build the API (and the packages it uses).
  pnpm --filter @medicos/db live:deploy | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Migrations failed (pnpm --filter @medicos/db live:deploy).' }
  if (-not $NoBuild) {
    Write-Host 'Building the API...'
    # pnpm (not turbo) so `prisma generate` is not re-run: it fails on Windows while `pnpm dev` holds the DLL.
    pnpm --filter '@medicos/api^...' --filter @medicos/api run build | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Build failed (pnpm --filter @medicos/api... run build).' }
  }
} finally { Pop-Location }

# 3. The production API on :4100 (restarted so a new build is picked up).
$apiPid = Join-Path $state 'api.pid'
if (Test-Path $apiPid) { taskkill /PID (Get-Content $apiPid) /T /F *> $null; Remove-Item $apiPid }
$p = Start-Process 'pnpm.cmd' -ArgumentList @('--filter', '@medicos/api', 'start:live') -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $state 'api.log') -RedirectStandardError (Join-Path $state 'api.err.log')
Set-Content $apiPid $p.Id
Write-Host "  started API (pid $($p.Id))"
Wait-Until {
  try { (Invoke-WebRequest -ErrorAction Stop -UseBasicParsing -TimeoutSec 3 'http://localhost:4100/health').StatusCode -eq 200 } catch { $false }
} 90 'The API'
$cfg = Invoke-RestMethod 'http://localhost:4100/config'
Write-Host "  API ready. AI: $($cfg.ai)  demo: $($cfg.demo)  login: $($cfg.channels -join ', ')  voice: $($cfg.voice)"

# 4. Tunnel for the live site (new address -> commit + push -> Vercel redeploys).
& (Join-Path $PSScriptRoot 'start-tunnel.ps1') -Push

Write-Host ''
Write-Host 'All running.'
Write-Host '  Live site: https://medicos-zeta.vercel.app (1-2 minutes after a push)'
Write-Host "  Logs:      $state"
