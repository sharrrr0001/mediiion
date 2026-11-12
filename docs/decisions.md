# Decisions log

One line each: date — decision — why.

- 2026-11-12 — Stack as spec §4: pnpm + Turborepo, Next.js App Router, NestJS, Prisma + PostgreSQL 16, Redis/BullMQ, S3/MinIO, Vitest/Supertest/Playwright — one language, boring, well documented for a solo founder.
- 2026-11-12 — Pinned majors: Next 15.5, React 19.1, NestJS 11, Prisma 6.x (not 7), zod 4, Tailwind 4, next-intl 4 — versions with known, stable APIs; upgrade deliberately later.
- 2026-11-12 — Local Postgres container exposed on host port **5434** — a 5432 (native Postgres) and 5433 (another project) are busy on the dev machine. Web dev server runs on **3001** (3000 busy).
- 2026-11-12 — Web calls API via Next.js rewrite `/api/*` → `http://localhost:4000` — same origin, so httpOnly cookies work without CORS; simpler CSRF story.
- 2026-11-12 — CSRF: auth cookies are `SameSite=Strict` + API rejects state-changing requests whose `Origin` is not in `WEB_ORIGINS` — cheap, robust protection for cookie auth.
- 2026-11-12 — Access token = 15-min JWT in httpOnly cookie; refresh token = random 256-bit opaque value, stored as SHA-256 hash in `Session`, rotated on each use; reuse of an old token revokes the whole session family — spec §4/§11.
- 2026-11-12 — Consent screen comes **before** the profile screen (spec §7.1 lists profile first) — DPDP: ask consent before collecting name/DOB. `Consent` therefore has `userId` (account holder) and optional `patientProfileId`.
- 2026-11-12 — Field encryption in Phase 0 uses AES-256-GCM with a local key from env (`FIELD_ENCRYPTION_KEY`), key-id prefixed ciphertext (`v1:`) so KMS envelope encryption can replace it in Phase 6 without schema change.
- 2026-11-12 — Phone/email stored as HMAC-SHA256 blind index (lookup) + encrypted value (for sending) — spec §11.
- 2026-11-12 — Medicos ID = `MED-XXXX-XXXX`: 7 random Crockford base32 chars + 1 Luhn mod-32 check char — catches all single-char typos and adjacent swaps, no symbols outside base32.
- 2026-11-12 — Doctor/staff/admin login is **blocked** until TOTP 2FA ships (Phase 4) — spec requires 2FA for these roles; deny is the safe default. Seed accounts exist but cannot sign in yet.
- 2026-11-12 — Dev OTP delivery: SMS via console adapter (masked phone, code printed only when `NODE_ENV!=production`); email via Mailpit SMTP. A dev-only in-memory outbox (`/dev/outbox`, disabled in production) lets E2E tests read OTPs.
- 2026-11-12 — `AuditLog` is append-only at the database level (Postgres trigger rejects UPDATE/DELETE) — not just by convention.
- 2026-11-12 — API validation with zod 4 (`ZodPipe`) and Swagger bodies from `z.toJSONSchema` instead of class-validator DTOs — one schema language shared with the web app.
- 2026-11-12 — NestJS runs via `nest start` (tsc) and tests via Vitest + `unplugin-swc` — Nest DI needs `emitDecoratorMetadata`, which esbuild/tsx do not emit.
- 2026-11-12 — `packages/shared` and `packages/db` compile to CommonJS `dist/` (consumed by Nest and Next); `packages/ui` ships TS source via Next `transpilePackages` (web-only).
- 2026-11-12 — i18n without locale in the URL: language stored in `NEXT_LOCALE` cookie — keeps routes `/p/...` stable and short for patients.
- 2026-11-12 — Local Redis on host port **6380** and S3 via **SeaweedFS** (MinIO images no longer public) — port 6379 busy on dev machine; app only speaks the S3 API so the store is swappable.
- 2026-11-12 — Upgraded to latest patch/minor in each pinned major (Next 15.5.29, NestJS 11.2, Prisma 6.19, zod 4.6, Playwright 1.65), nodemailer 10.3.1, and pnpm overrides for sharp/postcss/deepmerge-ts — clear all high/critical `pnpm audit` advisories without major framework jumps. Revisit overrides when moving to Next 16 / Prisma 7.
- 2026-11-12 — **AI model plan confirmed by Pranov** (see `docs/ai-models.md`): dev/demo = Gemini Flash (AI Studio) or Llama on Groq + Groq Whisper/Bhashini, test data only; pilot/prod = Claude Haiku 5.5 for chat + summary, Sarvam STT; self-hosted option = Qwen/Gemma on vLLM + IndicConformer. Report photos attach-only. Safety line and output check are code rules, no model. Doctor search uses filters, no AI.
- 2026-11-12 — Providers: `mock`, `gemini`, `openai-compatible` (covers Groq **and** self-hosted vLLM with one adapter), `anthropic`. One interface in `packages/ai`, selected by `LLM_PROVIDER`/`LLM_MODEL`.
- 2026-11-12 — **Safety keyword list will be clinically reviewed by a doctor before the pilot** (Pranov, clinical-safety decision). Until then the list is marked `reviewStatus: 'draft'` and the release checklist blocks the pilot on it.
