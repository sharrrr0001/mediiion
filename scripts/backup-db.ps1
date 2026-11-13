# Back up a Medicos database (default: medicos_live) to a compressed dump.
#
#   .\scripts\backup-db.ps1                      -> backups\medicos_live-YYYYMMDD-HHMMSS.dump
#   .\scripts\backup-db.ps1 -Database medicos    (local dev data)
#
# Dumps contain ENCRYPTED patient fields (AES-GCM; keys are NOT in the dump), but still treat them as
# sensitive: keep them off shared drives, never commit them (backups/ is git-ignored). In production
# (AWS) RDS automated backups + snapshots replace this script; see docs/runbooks/backup-restore.md.
param([string]$Database = 'medicos_live', [int]$Keep = 14)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir "$Database-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$compose = Join-Path $root 'docker-compose.yml'

# Custom format (-Fc): compressed, restorable table by table with pg_restore. Dumped INSIDE the container
# and copied out: Windows PowerShell 5.1 re-encodes binary data piped through '>' (corrupts the dump).
$tmp = "/tmp/$Database.dump"
docker compose -f $compose exec -T postgres pg_dump -U medicos -d $Database -Fc --no-owner -f $tmp
if ($LASTEXITCODE -eq 0) { docker compose -f $compose cp "postgres:$tmp" $file 2>&1 | Out-Null }
docker compose -f $compose exec -T postgres rm -f $tmp | Out-Null
if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1024) { Remove-Item $file -ErrorAction SilentlyContinue; throw "Backup of $Database failed." }
Write-Host "Backup written: $file ($([math]::Round((Get-Item $file).Length / 1KB)) KB)"

Get-ChildItem $dir -Filter "$Database-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item
