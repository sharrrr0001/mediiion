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

## Phase 1 — AI intake on web chat ✅ (2026-11-12)
- [x] `packages/ai`: provider interface + mock, Claude Haiku 5.5, Gemini (demo), OpenAI-compatible (Groq / self-hosted vLLM); INR cost per call
- [x] Safety keyword rule (rule 4) — EN/Hinglish/Hindi, **draft: doctor review required before pilot** (release checklist)
- [x] Output filter (rule 6) — max 2 regenerations, then the template's reviewed text; `FilterBlockEvent` stores rule ids only
- [x] De-identifier (rule 11) — names, phones, emails, Medicos IDs, PIN codes, addresses; tested at the provider boundary
- [x] Templates as data: General Medicine + Dermatology v1 (EN/HI/Hinglish), seeded into `Template`
- [x] Engine: code plans questions (coverage + ≤20), model phrases/follows up; identity → consent → questions → closing; fixed medical-question redirect; language detection
- [x] Intake API: start, view, message (safety first), continue-after-safety, retry, pause, language, review, edit answer (re-checked for safety), submit, uploads (magic-byte sniffing, 8 MB, private S3, 5-min signed URLs)
- [x] Chat UI: 3-step progress, quick replies, safety card with Call 112, upload with on-phone compression, save & exit, retry on AI failure; "What you told us" review with edit + submit
- [x] Eval harness: 50 fictional cases (GM/Derm/Paeds/Gynae, 3 languages, tricky + misbehaving-model cases); `pnpm eval` in CI, `pnpm eval:live` on demand
- [x] Chat route JS 144 kB (budget 150 kB) via zod-free `@medicos/shared/client` + side-effect-free UI package
- [x] Tests: ai 199, api 44 (+ intake e2e), web E2E 10 (incl. safety card + full interview, axe on every screen)

## Phase 2 — Pre-Visit Summary + doctor view (next)
See [plans/phase-2.md](plans/phase-2.md).

## Known issues / follow-ups
- /p/login (241 kB) and /p/profile (276 kB) still load zod for form validation; chat and other patient routes are under 150 kB.
- Live providers (Gemini, Groq, Claude) are wired but untested end to end — no API keys configured yet. Run `pnpm eval:live` once keys are in `.env`.
- Offline answer queue (IndexedDB) and voice are Phase 3.
- On Windows, `prisma generate` fails with EPERM while the dev API is running (engine DLL locked). Stop `pnpm dev` or use `pnpm turbo run <task> --only`.
- `apps/api/src/intake/intake.service.ts` is ~300 lines; split turn-advancing into its own class when Phase 2 touches it.
- Throttler uses in-memory storage: fine for one instance. Move to Redis storage before running more than one API instance (Phase 6).
- Doctor/staff/admin sign-in is blocked until TOTP 2FA lands (Phase 4) — intentional.
- Field encryption uses an env key. KMS envelope encryption comes in Phase 6.
- Consent text is an engineering draft and needs lawyer review before the pilot.
- The CI workflow hasn't run yet: there's no GitHub remote. The steps were verified locally.
