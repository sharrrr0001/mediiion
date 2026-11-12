# Phase 1 — AI intake on web chat

**Goal:** a patient completes a full pre-visit interview by chat (General Medicine or Dermatology). Every safety control from spec §3 is enforced in code and covered by tests and the eval harness.

## Tasks (vertical slices, in order)
1. **`packages/ai` skeleton.** `LlmProvider` / `SttProvider` interfaces, a deterministic `mock` provider, and provider selection from `LLM_PROVIDER` / `LLM_MODEL`.
2. **Safety keyword rule (rule 4).** Hindi + English + Hinglish keyword list (with normalisation: lowercase, Devanagari and Roman variants, common misspellings), `matchSafety(text) → terms[]`. Writes a `SafetyEvent`. Tests: positives, negatives and false-positive guards.
3. **Output filter (rule 6).** Drug-name list, condition list, dosage regex, "you have / aapko … hai / lagta hai … hai", "diagnosis", treatment verbs. On a hit: regenerate (max 2), then a canned safe question. Writes a `FilterBlockEvent` (rule id only). Tests for every rule.
4. **De-identifier (rule 11).** Replaces name, phone, email, address and Medicos ID with `[PATIENT]`-style tokens before any provider call. Tests, plus a provider spy asserting no PHI leaves the process.
5. **Templates as data.** JSON schema for templates. General Medicine + Dermatology v1 seeded into `Template`. The engine picks the next section/question, skips answered ones and applies follow-up conditions.
6. **Intake session API.** `POST /intake/sessions`, `POST /intake/sessions/:id/messages` (safety rule → LLM → filter), pause/resume, `GET` transcript (decrypted for the owner only, audited). Messages stored encrypted.
7. **Providers.** Gemini Flash / Groq (dev, fake data only) and Claude Haiku 5.5 (`claude-haiku-5-5`, pilot), with no-retention settings. `AiUsage` rows record tokens and cost.
8. **Chat UI** (`/p/intake/[id]`): 3-step progress bar, AI/patient bubbles, quick-reply chips, safety card with a **Call 112** button, a "Not a diagnosis" footer, and a language toggle. Must meet the 150 kB JS budget.
9. **Uploads (attach only).** Pre-signed S3 PUT (≤5 min), mime sniffing, size limits, client-side compression to 1600px / ~300 KB, `Attachment` rows.
10. **"What you told us" review screen.** Plain-language sections with "Change" links, then submit.
11. **Eval harness** (`packages/ai/evals`). 50 fictional transcripts (4 specialties × 3 languages, including the tricky cases from §6.7). Checks: safety-line correctness, zero filter violations, must-ask coverage, length limits. `pnpm eval` runs in CI on the mock provider.

## Tests
Never skipped: safety rule, output filter, de-identification, schema (rule 5). API tests for session ownership (rule 10). Playwright: a full chat interview on mobile, plus the safety-card trigger.

## Done when
50 mock interviews complete end to end, the eval harness passes every safety check in CI, and lint, typecheck, test and build are green.

## Open questions for Pranov (ask before building)
- Which LLM keys for dev (Gemini AI Studio or Groq)? Fake data only either way.
- Is the safety keyword list clinically reviewed by a doctor before the pilot? (Clinical safety: recommended yes.)
