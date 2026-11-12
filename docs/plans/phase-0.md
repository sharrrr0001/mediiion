# Phase 0 — Foundation

**Goal:** a runnable monorepo where a patient can sign up with OTP, give consent, create a profile, and get a Medicos ID + QR — with RBAC, audit log, CI and seed data in place.

## Tasks
1. Monorepo: pnpm workspaces, Turborepo, shared tsconfig/eslint/prettier (`packages/config`).
2. Docker Compose: Postgres 16 (:5433), Redis 7, MinIO, Mailpit. `.env.example`.
3. `packages/shared`: Medicos ID (generate/validate, Luhn mod 32), auth/profile/consent zod schemas, `PreVisitSummary` schema (§6.4), safety-line config, AI draft label.
4. `packages/db`: Prisma schema v1 covering §10 (+ `Session`, `OtpChallenge`), first migration, append-only trigger on `AuditLog`, seed with §15 fictional data.
5. `apps/api` (NestJS): config (zod env), Prisma module, field crypto (AES-GCM + HMAC blind index), pino with PHI redaction, global auth guard + `@Public()`, `can()` policy, audit service, OTP auth (phone via console adapter, email via Mailpit), JWT + rotating refresh sessions, origin check, rate limits, `/me`, consent, patient profile + Medicos ID, health check, Swagger.
6. `packages/ui`: design tokens (light/dark), Button, Input, OtpInput, Card, StatusTag, QRCard, Logo (`APP_NAME`).
7. `apps/web` (Next.js): next-intl (en, hi, hi-Latn), patient routes `/p/login`, `/p/consent`, `/p/profile`, `/p/home`, `/p/id`; route-group layouts for `/d` and `/admin` placeholders.
8. Tests: Vitest unit (Medicos ID, schema has no A/P, crypto, policy rule 10, log redaction), Supertest API (OTP signup → consent → profile), Playwright E2E for the signup flow.
9. CI: GitHub Actions — install, generate, lint, typecheck, test (with Postgres service), build, migration drift check, audit, gitleaks.

## Files
`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, `.env.example`, `packages/{config,shared,db,ui}/**`, `apps/{api,web}/**`, `.github/workflows/ci.yml`, `README.md`.

## Done when
- `pnpm infra:up && pnpm db:migrate && pnpm db:seed && pnpm dev` runs web + api.
- A patient signs up with phone OTP, accepts consent, creates a profile, sees home + Medicos ID QR.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green locally; CI workflow present.
