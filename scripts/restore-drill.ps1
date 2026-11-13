# Backup/restore DRILL (spec §12 Phase 6): restore the newest dump into a throwaway database and prove it
# is usable — same tables, same row counts, migrations table intact, audit trigger present. Never touches
# the source database.
#
#   .\scripts\restore-drill.ps1                       (newest medicos_live dump)
#   .\scripts\restore-drill.ps1 -Database medicos
param([string]$Database = 'medicos_live')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root 'docker-compose.yml'
$target = 'medicos_restore_drill'

$dump = Get-ChildItem (Join-Path $root 'backups') -Filter "$Database-*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dump) { throw "No backup for $Database. Run .\scripts\backup-db.ps1 -Database $Database first." }
Write-Host "Restoring $($dump.Name) into $target ..."
$started = Get-Date

# SQL goes through stdin: Windows PowerShell 5.1 strips double quotes from native-command arguments.
function Psql([string]$db, [string]$sql) {
  $sql | docker compose -f $compose exec -T postgres psql -U medicos -d $db -tA -v ON_ERROR_STOP=1
}

Psql 'postgres' "DROP DATABASE IF EXISTS $target" | Out-Null
Psql 'postgres' "CREATE DATABASE $target" | Out-Null
docker compose -f $compose cp $dump.FullName postgres:/tmp/restore.dump 2>&1 | Out-Null
docker compose -f $compose exec -T postgres pg_restore -U medicos -d $target --no-owner /tmp/restore.dump 2>&1 | Out-Null
docker compose -f $compose exec -T postgres rm -f /tmp/restore.dump | Out-Null

$tables = "'User','PatientProfile','Doctor','Appointment','IntakeSession','IntakeMessage','PreVisitSummary','AuditLog','AccessGrant'"
# Exact counts (pg_stat can lag right after a restore).
$countSql = ($tables -split ',' | ForEach-Object { $n = $_.Trim("'"); "SELECT '$n=' || count(*) FROM `"$n`"" }) -join ' UNION ALL '
$src = (Psql $Database $countSql) -join ' '
$dst = (Psql $target $countSql) -join ' '
$migrations = (Psql $target 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL') -join ''
$trigger = (Psql $target "SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%audit%'") -join ''
$seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)

Write-Host "Source : $src"
Write-Host "Restore: $dst"
Write-Host "Migrations applied in restore: $migrations - audit triggers: $trigger - took $seconds s"
$ok = ($src -match 'User=\d+') -and ($src -eq $dst) -and ([int]$migrations -gt 0) -and ([int]$trigger -gt 0)
Psql 'postgres' "DROP DATABASE IF EXISTS $target" | Out-Null
if ($ok) { Write-Host 'DRILL PASSED: restore matches the source.' } else { throw 'DRILL FAILED: restored data does not match. See output above.' }
