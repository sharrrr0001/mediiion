# Medicos

## Overview
Medicos is a **Pre-Visit Intake Assistant** for Indian OPD clinics. Patients talk to an AI (chat/voice, Hindi/English/Hinglish) before a visit; the AI organises their answers into a **Pre-Visit Summary** (SOAP layout, only **S** and patient-reported **O** filled). The doctor reviews, writes Assessment/Plan, and finalises. Patients pay ₹0; doctors subscribe.
The full spec is `docs/spec.md` (copy of the master build prompt). Read it before large changes.

## Golden rules (enforce in code, not only in prompts)
1. AI never diagnoses — never names/guesses/hints at a disease, to the patient or in the summary.
2. AI never prescribes or advises (no medicines, doses, tests, diet, remedies, treatment, no medical answers). Redirect: "Yeh sawaal aap doctor sahab se zaroor poochiye. Main note kar leta hoon."
3. No urgency score, no triage, no AI-chosen specialty.
4. Fixed safety line, triggered by a **keyword rule** (never written by the AI), text lives in one config file. Log `safety_line_shown`; doctor queue shows neutral "Safety message shown to patient".
5. AI writes only into the fixed `PreVisitSummary` schema (`packages/shared`) which has **no Assessment/Plan fields**.
6. Output filter on every AI message + summary (drug names, dosage regex, "diagnosis", "you have …", "aapko … hai", condition names, treatment verbs) → block, regenerate (max 2), then safe canned question. Log every block.
7. Every summary line cites the patient's own words (messageId + quote) or it is dropped.
8. Every summary is labelled: **"AI-generated draft. Not a diagnosis or prescription. Treating doctor must review."**
9. Summary stays `draft` until the doctor presses **Review & finalise**. Only finalised doctor notes enter the Medical Record Book as clinical records.
10. Patient consent controls access (AccessGrant, default 24h, logged). Deny by default.
11. No training on patient data; strip name/phone/email/address/Medicos ID before any AI call (`[PATIENT]` tokens).
12. Health data stays in India (AWS ap-south-1) in production.

Tests for rules 4, 5, 6, 7, 10, 11 must never be skipped. **Never use real patient data** — only the fictional seed people (spec §15).

## Tech Stack
TypeScript everywhere. pnpm workspaces + Turborepo. Next.js 15 App Router (`apps/web`: patient PWA `/p`, doctor `/d`, internal `/admin`), Tailwind v4 + shadcn-style components, next-intl (en, hi, hi-Latn). NestJS 11 API (`apps/api`) with zod validation + Swagger. PostgreSQL 16 + Prisma 6. Redis/BullMQ (from Phase 1). SeaweedFS (S3 API) locally. Vitest, Supertest, Playwright. Docker Compose for local infra. See `docs/decisions.md` for why.

## Folder Structure
```
apps/web        Next.js app (patient PWA, doctor dashboard, internal panels)
apps/api        NestJS API (+ job workers later)
packages/shared zod schemas + types shared by web and api (PreVisitSummary, Medicos ID, auth DTOs)
packages/db     Prisma schema, migrations, seed
packages/ui     design tokens (CSS vars) + shared React components
packages/config tsconfig bases, eslint config
packages/ai     (Phase 1) LLM/STT providers, intake engine, safety rule, output filter
docs/           spec, plans/, decisions.md, ideas.md, safety.md, privacy.md, TASKS.md, design/
```

## Commands (run from repo root)
- Install: `pnpm install`
- Infra: `pnpm infra:up` (Postgres :5434, Redis :6380, S3 (SeaweedFS) :9000, Mailpit :8025)
- DB: `pnpm db:migrate` · `pnpm db:seed` · `pnpm --filter @medicos/db check-drift` (uses medicos_shadow, never the test DB)
- Dev: `pnpm dev` (web http://localhost:3001, api http://localhost:4000, Swagger /docs)
- Build: `pnpm build` · Lint: `pnpm lint` · Types: `pnpm typecheck`
- Test: `pnpm test` (unit + API; API tests need infra up) · E2E: `pnpm e2e`

## Conventions
- TS strict; no `any` without a comment. Files < 250 lines. kebab-case files, PascalCase components/classes.
- Validate all input with zod at the boundary (`ZodPipe`). Errors: `{ error: { code, message } }`, never stack traces.
- Every endpoint: auth by default (`@Public()` to opt out), `can(user, action, resource)` check, audit entry for patient data.
- PHI (name, DOB, message text, summaries, notes) is field-encrypted (`apps/api/src/crypto`). Phone/email stored as HMAC blind index + encrypted value. Never log PHI; pino redaction is on.
- Web calls the API through the Next rewrite `/api/*` → API (same origin, httpOnly cookies, SameSite=Strict).
- All UI strings through next-intl; keys in `apps/web/messages/{en,hi,hi-Latn}.json`.
- Ambiguity → safest simple option + one line in `docs/decisions.md`. New feature ideas → `docs/ideas.md`.
- Commit after each green slice (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Current Status
- Last session: 2026-11-12 — Phase 0 (foundation) built. See `docs/TASKS.md`.
- In progress: —
- Known issues: see `docs/TASKS.md` → Known issues.
- Next step: Phase 1 plan `docs/plans/phase-1.md` → build AI intake on web chat.
