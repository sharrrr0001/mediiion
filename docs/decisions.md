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
- 2026-11-12 — OTP route throttle raised to 30/min/IP (flood guard); real OTP limits are per phone (3/10 min) and per IP (`OTP_MAX_PER_IP`, default 10/10 min) in OtpService. Authenticated routes throttle per device cookie — patients often share one clinic Wi-Fi or carrier NAT.
- 2026-11-12 — **Light theme only (white + green)**; dark mode removed, `color-scheme: light` — the site must look the same whatever the OS theme (Pranov's UI brief).
- 2026-11-12 — Menus, sheets and dialogs use a small in-house menu + native `<dialog>` instead of Radix — accessible (focus trap, Escape, inert background) at a fraction of the bundle; keeps the chat route under 150 kB.
- 2026-11-12 — Patient routes split into `app/p/(auth)` (focused split layout: login, consent, profile) and `app/p/(app)` (PatientShell); URLs unchanged.
- 2026-11-12 — Doctor `/d/today` and `/admin` show **clearly labelled fictional sample data** until Phases 2/5; A/P remain empty "For doctor" editors (rule 5).
- 2026-11-12 — Fonts: Inter + Bricolage `display: optional` (no late swap repaint on slow networks); Devanagari and mono not preloaded. CSS inlined (`experimental.inlineCss`). Translations sent per area, not all on every page.
- 2026-11-12 — **Option A (Pranov, clinical-safety decision):** in Pre-Visit Summary lines, a medicine name or dose is allowed only in `subjective.medications` and `subjective.allergies`, and only when that exact name/dose appears in the line's cited patient quote. Everywhere else (other sections, all chat messages) the output filter stays strict.
- 2026-11-12 — Doctor TOTP 2FA pulled forward from Phase 4 (doctors must sign in to read summaries). RFC 6238 on node:crypto, tested against RFC vectors; enrol/verify via a 5-minute signed ticket; replay blocked with `User.totpLastStep`.
- 2026-11-12 — Summary is written synchronously on submit (not yet a BullMQ job) — simplest path for the pilot volumes; move to a job with retries when real-model latency or volume needs it.
- 2026-11-12 — Sharing with the chosen doctor = `share_with_doctor` consent + `AccessGrant` (grantedVia share) for **72 hours**, so a next-day appointment still works. QR-at-clinic grants stay 24 h (Phase 4).
- 2026-11-12 — If the patient's own chief-complaint words contain a blocked term (e.g. a condition name in their question), the AI-written line stays neutral and the patient's words remain the line's source quote. Other lines that fail the filter are dropped (see open question in TASKS).
- 2026-11-12 — Print = browser print with print-only CSS (shell hidden). Server-side Playwright PDF render job deferred to Phase 5 with WhatsApp sharing.
- 2026-11-12 — Voice: STT providers mock / Groq Whisper (demo, fake data) / Sarvam Saarika (production). Audio cannot be de-identified, so production refuses any STT other than Sarvam (Indian company, India data, DPA). Raw audio stays in our private bucket; only the patient-confirmed, de-identified text reaches the LLM.
- 2026-11-12 — A voice transcript is a draft (`VoiceClip`) until the patient confirms or edits it; it is never posted automatically, and the confirmed text runs through the safety rule like typed text.
- 2026-11-12 — Offline: one pending answer per interview in IndexedDB (the interview is turn-based); sent automatically on reconnect or reload. Service worker registered in production only, caches static assets + patient page shells, never `/api`.
- 2026-11-12 — Chat route JS budget: `@medicos/shared/client` may only re-export **types** from modules that import zod; runtime constants live in `constants.ts`. Image compressor and offline queue load on demand.

## 2026-11-13 — Phase 4 + live deployment
- **Live deployment:** web on Vercel (`medicos`, root `apps/web`), API on this PC behind a Cloudflare quick tunnel (`scripts/start-all.ps1`, `start-tunnel.ps1 -Push`), separate `medicos_live` database and fresh secrets in `.env.live`. See `docs/deploy.md`.
- **AI provider picked by key** (`LLM_PROVIDER=auto`): `ANTHROPIC_API_KEY` → Claude Haiku 5.5 (pilot grade); only `GEMINI_API_KEY` → Gemini Flash in **demo mode** (banner "made-up details only"); neither → scripted mock (demo). Demo mode exists only in production; dev data is always fictional.
- **Phone login hidden in production** until a real SMS provider exists; email OTP through Gmail SMTP (App Password). Voice is off in production without a real STT key (mock STT would invent answers).
- **Double booking** is prevented by a per-doctor Postgres advisory lock inside the booking transaction (a partial unique index would be dropped by Prisma's drift check).
- **AI-first order:** an interview finished without a doctor stays a draft; booking (or a QR Allow) shares it with that doctor only.
- **QR access:** doctor scan creates an `AccessRequest` (10 min); only the patient's Allow creates a 24 h `AccessGrant` + `record_access` consent; Allow also puts a walk-in in today's queue and attaches the last unshared interview (7 days).
- **Clinic staff see visit metadata only** (time, initials, Medicos ID, doctor, status) — no complaint or summary text, no records. Least privilege; staff make no clinical decisions. Walk-ins still need the patient's Allow.
- **Doctor signup** converts a fresh OTP account (no patient profiles) into a pending doctor and revokes its sessions so 2FA is enrolled at next login. Staff, doctor, admin and patient identities never share an account.
- **Share links** to non-member doctors: 24-byte random token in the URL only (HMAC stored), 72 h, revocable, every open audited; shows first name + age/sex and the AI-draft label, never the surname.
