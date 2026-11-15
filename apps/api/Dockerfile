# Medicos API image (build context = repository root).
#   docker build -f apps/api/Dockerfile -t medicos-api .
# Works on x86_64 and ARM64 (Oracle Cloud Ampere). Prisma generates its engine for the build platform.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

# Install dependencies for the API and the workspace packages it uses (not the web app).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@medicos/api..." --filter @medicos/db

COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/ai packages/ai
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @medicos/db exec prisma generate \
 && pnpm --filter "@medicos/api^..." --filter @medicos/api run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.15.0 --activate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
