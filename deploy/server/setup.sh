#!/usr/bin/env bash
# One-command setup of the always-on Mediaura backend on a fresh Ubuntu VM (Oracle Cloud Always Free).
#
#   curl -fsSL https://raw.githubusercontent.com/sharrrr0001/mediiion/main/deploy/server/setup.sh | bash
#   (or: git clone the repo, then  bash deploy/server/setup.sh)
#
# Safe to run again: keeps existing secrets/data, pulls the latest code and restarts the containers.
set -euo pipefail

REPO="${REPO:-https://github.com/sharrrr0001/mediiion.git}"
DIR="${DIR:-$HOME/medicos}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

say "Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

say "Firewall: allow HTTP/HTTPS (Oracle Ubuntu images block them in iptables by default)"
if command -v iptables >/dev/null 2>&1; then
  for p in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport "$p" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null 2>&1; then sudo netfilter-persistent save; fi
fi

say "Code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR/deploy/server"

ENVF=.env
if [ ! -f "$ENVF" ]; then
  say "Creating $ENVF with fresh secrets"
  IP="$(curl -fsS https://api.ipify.org || curl -fsS ifconfig.me)"
  HOST="${SITE_HOST:-$(echo "$IP" | tr . -).sslip.io}"
  rnd() { head -c "$1" /dev/urandom | base64 | tr -d '\n'; }
  S3KEY="medicos$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  S3SECRET="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  cat > "$ENVF" <<EOF
# Mediaura server settings. Keep this file private (it holds secrets). Edit, then: bash setup.sh
SITE_HOST=$HOST
POSTGRES_PASSWORD=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
FIELD_ENCRYPTION_KEY=$(rnd 32)
BLIND_INDEX_KEY=$(rnd 32)
JWT_SECRET=$(rnd 48)
APP_NAME=Mediaura
# Your Vercel site address(es), comma-separated.
WEB_ORIGINS=https://medicos-zeta.vercel.app,https://medicos-sharrrr0001s-projects.vercel.app
PUBLIC_WEB_URL=https://medicos-zeta.vercel.app
REFRESH_COOKIE_PATH=/api/auth
OTP_MAX_PER_IP=30
DEV_OUTBOX=false
LOG_LEVEL=info
S3_REGION=ap-south-1
S3_BUCKET=medicos-files
S3_ACCESS_KEY=$S3KEY
S3_SECRET_KEY=$S3SECRET
# Load the fictional demo doctors/clinics once (spec §15). Set to false for a clean pilot database.
SEED_ON_START=true

# ---- Login codes by email (Gmail App Password: 16 letters, no spaces) ----
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
SMS_PROVIDER=console

# ---- AI: paste ONE key. Claude = pilot grade; Gemini = demo (banner shown); none = scripted ----
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=auto
# ---- Voice (optional): Sarvam (India) or Groq (demo). None = voice off ----
SARVAM_API_KEY=
GROQ_API_KEY=
STT_PROVIDER=auto
EOF
  chmod 600 "$ENVF"
fi

# S3 credentials file for SeaweedFS, derived from .env.
set -a; . "./$ENVF"; set +a
cat > s3.json <<EOF
{ "identities": [ { "name": "medicos", "credentials": [ { "accessKey": "$S3_ACCESS_KEY", "secretKey": "$S3_SECRET_KEY" } ], "actions": ["Admin", "Read", "Write", "List", "Tagging"] } ] }
EOF
chmod 600 s3.json

say "Building and starting (first build takes a few minutes)"
$DOCKER compose up -d --build

say "Daily database backup at 02:30 (keeps 14 days in ~/medicos-backups)"
chmod +x "$DIR/deploy/server/backup.sh"
( crontab -l 2>/dev/null | grep -v medicos-backup; echo "30 2 * * * $DIR/deploy/server/backup.sh >> $HOME/medicos-backup.log 2>&1 # medicos-backup" ) | crontab -

say "Waiting for the API"
for i in $(seq 1 60); do
  if curl -fsS "https://$SITE_HOST/health" >/dev/null 2>&1; then break; fi
  sleep 5
done
curl -fsS "https://$SITE_HOST/health" && echo
curl -fsS "https://$SITE_HOST/config" && echo
cat <<EOF

Done. API address: https://$SITE_HOST
Next on your PC:  .\scripts\set-api-url.ps1 -Url https://$SITE_HOST -Push
Edit secrets:     nano $DIR/deploy/server/$ENVF   then   bash $DIR/deploy/server/setup.sh
Logs:             cd $DIR/deploy/server && $DOCKER compose logs -f api
EOF
