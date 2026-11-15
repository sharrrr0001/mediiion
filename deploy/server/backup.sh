#!/usr/bin/env bash
# Daily Postgres backup on the server (cron, see setup.sh). Dumps hold ENCRYPTED patient fields; the keys
# live only in .env.server, never next to the dumps. Copy dumps off the VM now and then (e.g. to your PC).
set -euo pipefail
cd "$(dirname "$0")"
OUT="$HOME/medicos-backups"
mkdir -p "$OUT"
FILE="$OUT/medicos-$(date +%Y%m%d-%H%M%S).dump"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
$DOCKER compose exec -T postgres pg_dump -U medicos -d medicos -Fc --no-owner > "$FILE"
[ "$(stat -c %s "$FILE")" -gt 1024 ] || { echo "backup too small, removing"; rm -f "$FILE"; exit 1; }
chmod 600 "$FILE"
ls -1t "$OUT"/medicos-*.dump | tail -n +15 | xargs -r rm -f
echo "$(date -Is) backup ok: $FILE"
