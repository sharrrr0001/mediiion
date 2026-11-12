# Medicos

**Pre-Visit Intake Assistant for Indian OPD clinics.** Patients tell an AI their history before the visit (chat/voice, Hindi/English/Hinglish); the doctor gets a clean, source-linked Pre-Visit Summary. The AI never diagnoses or prescribes — see [docs/safety.md](docs/safety.md).

> *Doctor ka time bachao. Patient ki baat poori suno.*

**Status:** Phase 0 (foundation) and Phase 1 (AI intake chat) are done. Next up is Phase 2 (Pre-Visit Summary and the doctor view). See [docs/TASKS.md](docs/TASKS.md).

## Requirements
Node 20.18+ (tested on 24), pnpm 10 (`npm i -g pnpm@10.15.0`), Docker Desktop.

## Setup (fresh clone)
```bash
pnpm install
cp .env.example .env          # then put real random values in the 3 secret lines (command is in the file)
pnpm infra:up                 # Postgres :5434, Redis :6380, S3 (SeaweedFS) :9000, Mailpit :8025
pnpm db:generate && pnpm --filter @medicos/db build
pnpm db:deploy                # apply migrations
pnpm db:seed                  # fictional people only
pnpm dev                      # web http://localhost:3001 · api http://localhost:4000 · Swagger http://localhost:4000/docs
```

Open http://localhost:3001 and sign up with any 10-digit number that starts with 6–9. In development the OTP is printed in the API console (masked phone) and stored in a dev-only outbox. Email OTPs show up in Mailpit at http://localhost:8025.

## Commands
| Command | What it does |
|---|---|
| `pnpm dev` | API (watch), web (Next dev on :3001), shared (tsc watch) |
| `pnpm build` | Build every package and app |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript strict |
| `pnpm test` | Unit tests and API tests (API tests use the `medicos_test` DB, so infra must be up) |
| `pnpm e2e` | Playwright on Pixel 7 + desktop Chrome, with axe accessibility checks (starts `pnpm dev` if it isn't running) |
| `pnpm db:migrate` | Create/apply a migration in dev (`prisma migrate dev`) |
| `pnpm db:seed` | Idempotent fictional seed |
| `pnpm infra:up` / `infra:down` | Start/stop local Docker services |

## Environment variables
| Name | Purpose | Dev value |
|---|---|---|
| `DATABASE_URL` | Postgres for the app | `postgresql://medicos:medicos@localhost:5434/medicos` |
| `TEST_DATABASE_URL` | Throwaway DB for API tests | `…/medicos_test` |
| `REDIS_URL` | BullMQ (Phase 1+) | `redis://localhost:6380` |
| `FIELD_ENCRYPTION_KEY` | AES-256-GCM key for PHI fields (32 bytes, base64) | generate |
| `BLIND_INDEX_KEY` | HMAC key for phone/email lookup (different from the above) | generate |
| `JWT_SECRET` | Access-token signing (≥32 chars) | generate |
| `API_PORT`, `API_URL` | API port, and the URL the web proxy targets | `4000`, `http://localhost:4000` |
| `WEB_ORIGINS` | Allowed origins for state-changing requests (CSRF) | `http://localhost:3001` |
| `REFRESH_COOKIE_PATH` | Path for the refresh cookie | `/api/auth` |
| `SMS_PROVIDER` | `console` only for now (MSG91 in Phase 5). Rejected in production | `console` |
| `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` | Email OTP via Mailpit locally | `smtp`, `localhost`, `1025` |
| `DEV_OUTBOX` | Dev-only OTP outbox for E2E. Must be `false` in production (enforced) | `true` |
| `S3_*` | Object storage (Phase 1 uploads) | SeaweedFS |
| `LLM_PROVIDER`, `LLM_MODEL`, `STT_PROVIDER` | AI providers (Phase 1+) | `mock` |

## Switching AI providers / running evals
Set these in `.env` and restart `pnpm dev` (see [docs/ai-models.md](docs/ai-models.md)):

| Use | Settings |
|---|---|
| Offline / tests | `LLM_PROVIDER=mock` |
| Demo, Gemini Flash (**fake data only**) | `LLM_PROVIDER=gemini` · `LLM_MODEL=gemini-2.5-flash` · `GEMINI_API_KEY=…` |
| Demo, Llama on Groq (**fake data only**) | `LLM_PROVIDER=openai-compatible` · `LLM_BASE_URL=https://api.groq.com/openai/v1` · `LLM_MODEL=<groq model id>` · `LLM_API_KEY=…` |
| Pilot / production | `LLM_PROVIDER=anthropic` · `LLM_MODEL=claude-haiku-5-5` · `ANTHROPIC_API_KEY=…` · `LLM_DATA_TERMS=no-training` |

In production the API refuses to start with `mock`/`gemini` or without `LLM_DATA_TERMS=no-training`.

Evals: `pnpm eval` runs 50 fictional cases on the mock provider (CI fails on any safety check). `pnpm eval:live` runs them against the configured provider.

## Layout
```
apps/web        Next.js: patient PWA (/p), doctor dashboard (/d), internal panels (/admin)
apps/api        NestJS API
packages/shared zod schemas + types (PreVisitSummary, Medicos ID, auth)
packages/db     Prisma schema, migrations, seed, field encryption
packages/ui     design tokens + shared components
packages/config tsconfig + eslint presets
docs/           spec, plans, decisions, safety, privacy, tasks, design references
```

## Golden rules
Read [CLAUDE.md](CLAUDE.md) before changing code. In short: no diagnosis, no prescribing, no triage; the safety line is shown by a keyword rule; the summary schema has no Assessment/Plan; patient consent controls access; never use real patient data.
