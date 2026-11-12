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

## UI upgrade — white + green responsive website ✅ (2026-11-12)
- [x] Tokens: new palette, shadows, radius, type scale; dark mode removed; light only
- [x] Components: Button sizes/variants, Card, SectionHeader, Input/Select/Textarea, OtpInput, Badge/StatusTag, Chip, Avatar, Tabs, Menu, Sheet/Dialog (native), Toast, StatCard, UsageBar, EmptyState (line-art), Skeleton, TimelineItem, DoctorCard, SoapSection
- [x] Shells: PublicShell, AuthSplit, PatientShell (top nav / bottom tab bar), DashboardShell → Doctor/Admin (sidebar → icon rail → drawer)
- [x] Pages: new landing; split-screen login/consent/profile; patient dashboard grid; My ID two-column; pre-visit start/chat (side panel on laptop)/review; new Visits + Records; doctor 3-pane preview with list → detail on phone; admin overview
- [x] Acceptance: dark-OS check, no overflow at 360–1920, axe zero serious on all pages, keyboard skip link + focus ring, 30 E2E passing
- [ ] Lighthouse mobile Performance ≥ 90 — currently landing 84, home 87–88 (A11y 100, Best practices 100). See Known issues.

## Phase 2 — Pre-Visit Summary + doctor view ✅ (2026-11-12)
- [x] Summary writer (schema §6.4): de-identified answers → one structured call → rule 7 (drop unsourced/misquoted), rule 6 + **Option A** (medicine names/doses only in medications/allergies when quoted), ≤2 regenerations, then drop; code-owned attachments/safety/meta; names re-inserted only at render
- [x] Storage + lifecycle: encrypted `PreVisitSummary`, draft → delivered (chosen doctor) → reviewed (finalised); opened-at tracking
- [x] Doctor TOTP 2FA (enrol + verify, replay-safe)
- [x] Patient picks a verified doctor (optional) at pre-visit start → share consent + 72 h grant + today's queue entry
- [x] Doctor Today queue (IST day, neutral safety marker first) and summary page: S/O with source popovers, A/P empty "For doctor" editors, examination, Rx builder, tests, follow-up, Review & finalise (confirm dialog), 👍/👎 feedback, print
- [x] Rule 9: record book gets the doctor note + prescription only on finalise; patient Record Book list + detail
- [x] AI usage/cost recorded per summary; filter blocks stored as rule ids
- [x] Evals: 50/50 cases now also check summary validity (schema, sources, filter, no A/P)
- [x] Tests: ai 210, api 56 (incl. full doctor e2e + 2FA), web E2E 30 (incl. browser doctor flow on phone + desktop)

## Phase 3 — Voice + Hindi/Hinglish polish (next)
Mic recording, STT adapters (Groq Whisper dev, Sarvam prod), transcript confirm, Paediatrics + Gynaecology templates, offline queue.

## Known issues / follow-ups
- **Open question (clinical safety):** a summary line whose *patient words* contain a blocked term (e.g. "kya yeh daad hai?" in patient questions) is currently dropped, so the doctor loses that question. Proposal: show such lines verbatim as "Patient said: “…”" (clearly a quote, not AI text). Needs Pranov's decision.
- Usage metering against the plan (summaries per month) is Phase 5 (billing).
- Doctor dashboard "Upcoming" tab, patient history and month stats are not wired yet (queue covers today).
- E2E: one desktop signup run timed out once under full-suite load on the dev server; passes on repeat. Run E2E against a production build in CI.
- Lighthouse mobile Performance 84 (/) and 87–88 (/p/home), target 90. Remaining cost: ~230 kB web fonts on throttled 4G (incl. an 84 kB Devanagari file triggered by the "हिंदी" picker label on every page) and ~145 kB first-load JS. Next steps: subset/self-host fonts (Devanagari only for hi), lazy-load the language sheet, consider a lighter data layer than React Query on public pages.
- Doctor/admin pages are previews with sample data; sidebar items without pages are shown disabled.
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
