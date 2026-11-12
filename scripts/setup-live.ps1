# One-time setup for the live site (Vercel web + this PC's API behind a Cloudflare tunnel).
#
#   .\scripts\setup-live.ps1
#
# - creates .env.live (git-ignored) from .env.live.example with FRESH secrets
# - creates the medicos_live database, applies migrations and loads the fictional seed data
# Safe to run again: existing .env.live and data are kept.
# Continue, not Stop: Windows PowerShell 5.1 turns any stderr line from docker/pnpm into an error.
# Every native command's exit code is checked explicitly instead.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$envLive = Join-Path $root '.env.live'

function New-Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  [Convert]::ToBase64String($b)
}

if (-not (Test-Path $envLive)) {
  $text = Get-Content (Join-Path $root '.env.live.example') -Raw
  $text = $text -replace 'FIELD_ENCRYPTION_KEY=__GENERATE__', "FIELD_ENCRYPTION_KEY=$(New-Secret 32)"
  $text = $text -replace 'BLIND_INDEX_KEY=__GENERATE__', "BLIND_INDEX_KEY=$(New-Secret 32)"
  $text = $text -replace 'JWT_SECRET=__GENERATE__', "JWT_SECRET=$(New-Secret 48)"
  [System.IO.File]::WriteAllText($envLive, $text)
  Write-Host 'Created .env.live with fresh secrets.'
  Write-Host '  Open it and fill in SMTP_USER, SMTP_PASS, EMAIL_FROM and one AI key.'
} else {
  Write-Host '.env.live already exists (kept).'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop and run this again.' }
Write-Host 'Starting Postgres, Redis, S3...'
docker compose -f (Join-Path $root 'docker-compose.yml') up -d --wait postgres redis s3 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed.' }

$exists = docker compose -f (Join-Path $root 'docker-compose.yml') exec -T postgres psql -U medicos -d medicos -tAc "SELECT 1 FROM pg_database WHERE datname='medicos_live'"
if ("$exists".Trim() -ne '1') {
  docker compose -f (Join-Path $root 'docker-compose.yml') exec -T postgres psql -U medicos -d medicos -c 'CREATE DATABASE medicos_live' | Out-Null
  Write-Host 'Created database medicos_live.'
}

Push-Location $root
try {
  pnpm --filter @medicos/db live:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Migrations failed.' }
  pnpm --filter @medicos/db live:seed
  if ($LASTEXITCODE -ne 0) { throw 'Seed failed.' }
} finally { Pop-Location }

Write-Host ''
Write-Host 'Live setup done. Next: fill in .env.live, then run .\scripts\start-all.ps1'
