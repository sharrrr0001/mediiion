# Phase 2 — Pre-Visit Summary + doctor view

**Goal:** a doctor runs a full mock OPD day, from the queue to finalised notes, and the patient sees the finalised records in their Medical Record Book.

## Tasks (vertical slices)
1. **Summary writer** (`packages/ai/src/summary`): one structured call on the de-identified transcript + attachment metadata → `PreVisitSummary` (schema §6.4). Then: zod-validate, **drop every line whose `messageId` is not in the transcript or whose quote is not in that message** (rule 7), run the output filter on every line (rule 6), regenerate ≤ 2, re-insert names only at render. Triggered on submit (BullMQ job); mock provider builds a deterministic summary for tests/evals.
2. **Summary storage + lifecycle**: `PreVisitSummary.jsonEnc` (encrypted), status draft → delivered (to the chosen doctor) → reviewed. Usage metering hook (a summary counts when delivered).
3. **Doctor auth (temporary for Phase 2 demo)**: TOTP 2FA for doctors (pulled forward from Phase 4, it unblocks doctor login).
4. **Doctor Today queue** `/d/today`: tabs Today/Upcoming, status tags, neutral "Safety message shown to patient" marker sorted to the top, ↑/↓/Enter keyboard.
5. **Doctor summary page**: SOAP layout, S + O filled with source popovers (patient's own words), **A · Assessment** and **P · Plan / Rx** empty editors labelled "For doctor", draft label (rule 8) everywhere, attachments viewer.
6. **Finalise flow** (rule 9): `DoctorNote` (assessment/plan/exam/tests encrypted), Prescription builder (doctor-typed formulary list), follow-up date, **Review & finalise** → `RecordBookEntry` rows; summary feedback 👍/👎.
7. **Patient Medical Record Book** `/p/records`: timeline (doctor notes, prescriptions, summaries, uploads), detail, PDF.
8. **Print / PDF**: A4 one-pager with clinic header, AI-draft label, blank A/P lines (Playwright/Chromium render job).
9. **AI usage/cost**: per-summary rupee cost; developer view of 7-day average with ₹6 alert.
10. **Evals**: extend the harness — schema valid, every line sourced, zero filter violations, no A/P content, summary of each eval case.

## Tests (never skipped)
Rule 5 (schema has no A/P; writer cannot add keys), rule 7 (unsourced or misquoted lines dropped), rule 6 on summaries, rule 8 (label on screen/print/PDF), rule 9 (record book only after finalise), rule 10 (only the shared doctor can open the summary).

## Done when
A doctor finishes a mock OPD day from queue to finalised notes on Playwright, and the patient sees the finalised note in their record book.

## Open question for Pranov — clinical safety (decide before step 1)
The output filter blocks medicine names everywhere. But the summary's **Medications** section has to list what the patient takes ("Telma 40, once daily, from strip photo"), or the doctor loses the most useful line. Options:
- **A (recommended):** allow a medicine name or dose in a summary line *only* in the `medications` and `allergies` sections, *and only* if the same name/dose appears in the cited patient quote. Everywhere else, and in all chat messages, the filter stays strict.
- **B:** keep the strict filter; medications appear only as the patient's raw quote (no AI rewording).
