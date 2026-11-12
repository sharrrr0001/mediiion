# Stop what start-all.ps1 started: the live API and the Medicos tunnel (by PID only, so other
# cloudflared tunnels on this PC keep running). Docker containers keep running; data is kept.
$state = Join-Path $env:TEMP 'medicos-live'
foreach ($name in 'api', 'tunnel') {
  $f = Join-Path $state "$name.pid"
  if (Test-Path $f) {
    taskkill /PID (Get-Content $f) /T /F *> $null
    Remove-Item $f
    Write-Host "stopped $name"
  }
}
