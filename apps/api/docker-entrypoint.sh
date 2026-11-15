#!/bin/sh
# Apply pending database migrations, load the FICTIONAL demo seed once (if asked), then start the API.
set -e
cd /app/packages/db
npx prisma migrate deploy
if [ "${SEED_ON_START:-false}" = "true" ] && [ ! -f /app/.seeded ]; then
  npx tsx prisma/seed.ts && touch /app/.seeded || echo "seed skipped"
fi
cd /app
exec "$@"
