# Tasks

## Phase 0 — Foundation ✅ (2026-11-12)
- [x] Monorepo (pnpm + Turborepo), shared tsconfig/eslint/prettier
- [x] Docker Compose: Postgres 16, Redis 7, SeaweedFS (S3), Mailpit
- [x] `packages/shared`: Medicos ID (Luhn mod 32), PreVisitSummary schema (no A/P, strict), safety-line config, auth/profile schemas
- [x] `packages/db`: Prisma schema v1 (all §10 tables + Session, OtpChallenge), append-only AuditLog trigger, AES-GCM field crypto + blind index, fictional seed
- [x] `apps/api`: env validation (fails closed in prod), phone/email OTP (rate limits, 5 attempts, 5-min expiry, 30s resend), rotating refresh sessions with reuse detection + device binding, origin/CSRF guard, deny-by-default auth guard, `can()` policy, audit service, consent → profile → Medicos ID, health, Swagger, PHI-redacted pino logs
- [x] `packages/ui`: tokens (light/dark), Button, Field/Input/Select, OtpInput, Logo, Card, StatusTag, Skeleton, EmptyState, QrCode
- [x] `apps/web`: next-intl (en / hi / hi-Latn), patient login, consent, profile, home, Medicos ID card; `/d` and `/admin` shells; PWA manifest; offline banner
- [x] Tests: shared (28), db crypto (6), api unit + Supertest (36), Playwright E2E with axe (6 = 3 tests × 2 viewports)
- [x] CI workflow (lint, typecheck, test, build, migration drift, seed, audit, gitleaks)

## Phase 1 — AI intake on web chat (next)
See [plans/phase-1.md](plans/phase-1.md).

## Known issues / follow-ups
- Patient routes ship ~250 kB first-load JS (zod 4.6 + React Query on the client). The 150 kB budget applies to the chat route; trim in Phase 1 (lighter client validation, code-split).
- Throttler uses in-memory storage: fine for one instance. Move to Redis storage before running more than one API instance (Phase 6).
- Doctor/staff/admin sign-in is blocked until TOTP 2FA lands (Phase 4) — intentional.
- Field encryption uses an env key. KMS envelope encryption comes in Phase 6.
- Consent text is an engineering draft and needs lawyer review before the pilot.
- The CI workflow hasn't run yet: there's no GitHub remote. The steps were verified locally.
