# MEDICOS — MASTER BUILD PROMPT FOR CLAUDE CODE

> Copy everything below this line into Claude Code, from the root of an empty project folder (for example `D:\mediop\medicos-app`).
> Put the design images from `D:\mediop` into `docs/design/` first so Claude Code can look at them.

---

## 0. Who you are and how to work

You are the founding engineering team for **Medicos**: a principal engineer, product designer and clinical-safety lead rolled into one, with 20+ years of shipping production health software. You are building a real product that real doctors and patients in India will use. Act like it: think before you code, keep things simple, write tests, and never cut corners on safety or privacy.

The founder (Pranov) is the CTO and sole developer for now. He will run you across many sessions. Optimise for: **a codebase one person can understand, run and change**, with boring, proven technology.

**Working rules**

1. **Read this whole document first.** Then write `CLAUDE.md` at the repo root summarising the product rules (section 3), stack, commands and conventions, so every future session starts with them.
2. **Plan before building each phase.** For each phase in section 12, write a short plan in `docs/plans/phase-N.md` (goal, tasks, files, tests, done-when), then implement it. If skills such as `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `frontend-design`, `security-review` or `code-review` are installed, use them at the matching step.
3. **Work in small vertical slices.** Each slice runs end to end (DB → API → UI → test) before the next one starts. Commit after each green slice with a clear message.
4. **Never use real patient data** in development, seeds, tests, logs or prompts. Use the fictional patients in section 15.
5. **When something in this spec is ambiguous**, pick the safest, simplest option, write the decision in `docs/decisions.md` (one line: date, decision, why) and carry on. Stop and ask only when a choice affects clinical safety, legal exposure or money.
6. **Do not invent features** outside this spec without writing them as a proposal in `docs/ideas.md`.
7. At the end of every phase, run the full test suite, lint and type-check, update `README.md`, and print a short summary: what was built, how to run it, what is left.

---

## 1. Product in one paragraph

Medicos is a **Pre-Visit Intake Assistant** for Indian OPD clinics. Before an appointment, the patient talks to the Medicos AI from home, by chat or voice, in Hindi, English or Hinglish, and uploads photos and old reports. The AI asks the history questions a doctor would ask, one at a time, and organises the answers into a clean **Pre-Visit Summary**. The doctor reads it in about 30 seconds before the patient walks in, in a familiar SOAP layout where the AI has filled only **S (Subjective)** and **O (patient-reported Objective)**. **Assessment and Plan are always left blank for the doctor.** At the clinic, the doctor scans the patient's Medicos QR, the patient approves access, the doctor finalises the note and prescription, and the patient's **Medical Record Book** updates automatically. Patients pay ₹0, always. Doctors pay a monthly subscription.

**Tagline:** *Doctor ka time bachao. Patient ki baat poori suno.*
**North-star promise:** "Medicos gives doctors a clean patient history before the consultation, not an AI diagnosis."
**Target outcome:** about 3 minutes saved per patient (to be proven in the pilot).

The brand name "Medicos" is a working name. Keep it in one config value (`APP_NAME`) and one logo component so it can be renamed later.

---

## 2. Users and apps

| User | Surface | Core jobs |
|---|---|---|
| **Patient** (and family members) | Mobile-first PWA (installable), later WhatsApp | OTP login, Medicos ID + QR, consent, talk with AI (chat/voice + photos/reports), check "What you told us", choose verified doctor and book, share summary, approve record access at clinic, read Medical Record Book, reminders |
| **Doctor** | Web dashboard (desktop first, responsive to phone) | Onboarding + licence verification, clinic/fee/timings, intake templates, Today's queue, read summary with source links, scan QR, write Assessment/Plan/Rx, finalise, patient history, insights, plan & billing, staff |
| **Clinic staff** (receptionist) | Same web app, limited role | Add patient number + slot, send intake link, add walk-ins, print summaries, manage waiting-room QR |
| **Medicos team** | Internal web panels | Admin (verification, templates, quality review, safety log, consent/audit, support, billing), Founder (MRR, clinics, usage, pilot retention), Developer (model versions, provider switch, jobs, costs, errors) |

The patient never needs to download a native app. Native apps (Flutter or React Native) come later and are out of scope.

---

## 3. Golden rules (non-negotiable; enforce in code, not only in prompts)

1. **The AI never diagnoses.** It never names, guesses or hints at a disease or condition, to the patient or in the summary.
2. **The AI never prescribes or advises.** No medicines, doses, tests, diet, home remedies or treatment, and it does not answer medical questions. It politely redirects: "Yeh sawaal aap doctor sahab se zaroor poochiye. Main note kar leta hoon."
3. **No urgency score, no triage.** No red/amber/green, no "emergency detected", no AI-chosen specialty. Doctor search uses normal filters only.
4. **Fixed safety line, shown by a rule, never written by the AI.** If the patient's text or transcript matches the safety keyword list (Hindi + English + Hinglish, e.g. chest pain on exertion, "saans nahi aa rahi", stroke signs, heavy bleeding, fainting, suicidal thoughts, severe allergic reaction, pregnancy bleeding, child not responding), immediately show this exact text and continue only if the patient chooses to:
   > **"If you feel severely unwell, contact emergency services (112) or seek immediate in-person care. / Agar aap bahut bimaar mehsoos kar rahe hain, turant 112 par call karein ya nazdeeki hospital jaayein."**
   Log a `safety_line_shown` event. The doctor's queue shows a neutral marker "Safety message shown to patient" (not a score). Wording to be confirmed by a lawyer; keep it in one config file.
5. **The AI writes only into a fixed schema** (section 6.4) that has **no Assessment or Plan fields**. It physically cannot fill them.
6. **Output filter on every AI message and every summary** before anything is shown or stored as final: block and regenerate (max 2 retries, then fall back to a safe canned question) if it contains a drug name (from a drug-name list), dosage patterns (`\d+\s?(mg|ml|mcg)`), "diagnosis", "you have ___", "aapko ___ hai", "lagta hai ___ hai", disease names from a condition list, or treatment verbs ("take", "lijiye", "apply"). Log every block.
7. **Every summary line links to the patient's own words** (message id + quoted span). If the AI cannot cite a source message, the line is dropped.
8. **Every summary is labelled** on screen, in print, PDF and WhatsApp: **"AI-generated draft. Not a diagnosis or prescription. Treating doctor must review."**
9. **The doctor is always the decision-maker.** A summary stays `draft` until the doctor presses **Review & finalise**. Only the finalised doctor note goes into the Medical Record Book as a clinical record.
10. **Patient consent controls access.** Only the doctor the patient shared with (and that doctor's staff) can open the summary. Scanning a QR sends the patient an **"Allow Dr. X to see your records?"** prompt (or OTP); access lasts for that visit only (default 24 hours) and is logged.
11. **No training on patient data.** Use only AI APIs whose terms do not train on inputs. Strip name, phone, email, address and Medicos ID before any AI call (replace with tokens like `[PATIENT]`).
12. **Health data stays in India** (AWS `ap-south-1` Mumbai) in production.

Write automated tests for rules 4, 5, 6, 7, 10 and 11. These tests must never be skipped.

---

## 4. Tech stack (decided; record any change in `docs/decisions.md`)

Chosen for a solo founder: one language (TypeScript) end to end, boring and well documented.

| Layer | Choice |
|---|---|
| Monorepo | **pnpm workspaces + Turborepo** |
| Web apps | **Next.js (App Router, latest stable) + React + TypeScript (strict)**: `apps/web` hosts patient PWA (`/p/...`), doctor + staff dashboard (`/d/...`) and internal panels (`/admin/...`) with route-group layouts. One deployable keeps it simple; split later if needed. |
| UI | **Tailwind CSS + shadcn/ui (Radix)**, `lucide-react` icons, `react-hook-form` + `zod`, TanStack Query for server state |
| API | **NestJS** (`apps/api`), REST + OpenAPI (Swagger) generated from DTOs, `zod`/class-validator validation |
| AI service | `packages/ai` inside the API process at first (TypeScript, Anthropic TS SDK + provider adapters). Behind one interface so it can move to its own service (or Python/FastAPI) later without touching callers. |
| Background jobs | **BullMQ on Redis** (STT, summary generation, WhatsApp sends, reminders, PDF render) |
| Database | **PostgreSQL 16** with **Prisma** ORM and migrations |
| Files | **S3** (MinIO locally), private buckets, pre-signed URLs only, server-side encryption (SSE-KMS) |
| Auth | Own OTP auth: SMS via **MSG91** (adapter), email OTP via **AWS SES / Resend** (adapter). Short-lived JWT access token + rotating refresh token in httpOnly cookie. Doctors/staff/admins: TOTP 2FA required. |
| Payments | **Razorpay Subscriptions** (UPI Autopay + cards), GST invoices; manual invoices acceptable during pilot |
| Messaging | WhatsApp Business via **Meta Cloud API** (or Gupshup/Interakt as BSP) behind an adapter; SMS fallback |
| PDFs | Server-side render with Playwright/Chromium from an HTML template |
| QR | `qrcode` lib for generation; `@zxing/browser` (or `html5-qrcode`) for scanning in the doctor app camera |
| Observability | Pino structured logs (PHI-redacted), Sentry (PHI scrubbing on), OpenTelemetry-ready; health checks |
| Testing | **Vitest** (unit), Supertest (API), **Playwright** (E2E, mobile + desktop viewports), AI eval harness (section 6.7) |
| Local dev | **Docker Compose**: Postgres, Redis, MinIO, Mailpit. `pnpm dev` starts everything. Seed script with fictional data. |
| CI | GitHub Actions: lint, type-check, test, build, Prisma migration check, dependency audit, secret scan |
| Hosting (prod) | AWS Mumbai: ECS Fargate (or a single EC2/Lightsail to start), RDS Postgres, ElastiCache Redis, S3, KMS, CloudFront. IaC in `infra/` (Terraform or CDK) — write it in Phase 6, not before. |

**Repo layout**

```
medicos/
  apps/
    web/            # Next.js: patient PWA, doctor/staff dashboard, internal panels
    api/            # NestJS API + job workers
  packages/
    ai/             # LLM + STT providers, intake engine, summary writer, filters, safety rules
    db/             # Prisma schema, migrations, seed
    ui/             # shared design system components + tokens
    config/         # eslint, tsconfig, tailwind preset
    shared/         # zod schemas & types shared by web and api (incl. PreVisitSummary)
  docs/             # design/, plans/, decisions.md, ideas.md, safety.md, privacy.md, api.md
  infra/            # later
  docker-compose.yml
  CLAUDE.md
```

---

## 5. AI models (from the model research done for Medicos)

The job is narrow (ask, listen, organise), so a **small, fast model is enough**. All AI calls go through `packages/ai` interfaces:

```ts
interface LlmProvider { chat(req: ChatRequest): Promise<ChatResponse>; structured<T>(req: StructuredRequest<T>): Promise<T>; }
interface SttProvider { transcribe(audio: Buffer, opts: { languageHint?: 'hi'|'en'|'hi-en' }): Promise<Transcript>; }
```

Choose the provider per environment with env vars (`LLM_PROVIDER`, `LLM_MODEL`, `STT_PROVIDER`). The Developer panel shows the active provider/model and cost per summary.

| Step | Dev / demo (free, **fake data only**) | Pilot & production (real patients) | Self-hosted option (later) |
|---|---|---|---|
| Voice → text | Groq Whisper (free tier) or Bhashini | **Sarvam AI speech-to-text (Saarika)** — Indian company, Hindi/Hinglish strength | AI4Bharat IndicConformer or Whisper |
| Intake chat (next question) | Gemini Flash (AI Studio free tier) or Llama on Groq | **Claude Haiku 5.5** (`claude-haiku-5-5`) via Anthropic API, or AWS Bedrock in Mumbai if available there | Qwen / Gemma open models on vLLM |
| Pre-Visit Summary (structured JSON) | same as chat | **Claude Haiku 5.5** with structured output / tool-use JSON schema. If pilot quality is not enough, switch only this step to **Claude Sonnet 5.5** (`claude-sonnet-5-5`) via config. | same open model |
| Report / prescription photos | **Attach only** — no AI reading in v1 | Attach only in v1. AI text extraction later, behind a feature flag, after testing. | — |
| Safety line | Keyword rule in code. **No model.** | same | same |
| Output check | Word/regex filter in code (rule 6) | same | same |
| Doctor search | Normal filters. **No AI.** | same | same |

Also build a **`mock` provider** (deterministic, scripted replies) used by tests and offline dev.

**Cost target:** about ₹1–2 per summary in production (voice included). Track tokens, audio seconds and rupee cost per summary in an `ai_usage` table. Alert in the Developer panel if the 7-day average goes above ₹6.

**Privacy for AI calls:** de-identify before sending; never send the Medicos ID, name, phone or address; set no-retention / no-training options where the provider offers them; log only token counts and ids, never prompt text, in production logs.

---

## 6. The AI intake engine (heart of the product)

### 6.1 Flow

```
start → identity check ("Aap Rahul ji hain? Umar 28?" or "Kis ke liye bhar rahe hain?")
      → consent check → chief complaint → template questions (adaptive)
      → medicines (strip photo accepted) → allergies → past illness/surgery
      → family/social/pregnancy (only where relevant) → home readings (BP, sugar, temp, weight)
      → uploads → "Aapko sabse zyada kis baat ki chinta hai?" → "Doctor se kya poochna chahte hain?"
      → review screen "What you told us" (patient can edit) → submit
```

- **One question per message**, short, simple words, in the patient's language (detect from first reply; patient can switch with a toggle: हिंदी / English / Hinglish).
- Target **5–8 minutes, max ~20 questions**. Show the 3-step progress bar: **1 Symptoms & history → 2 Medicines → 3 Reports**.
- Quick-reply chips for common answers (Haan / Nahi / Pata nahi; 1 din / 2–3 din / 1 hafta / zyada).
- Voice: hold-to-record mic button; transcript is shown back to the patient before it is used ("Humne yeh suna: … Sahi hai?").
- **Pause and resume** any time (state saved server-side; resume link valid until the appointment).
- A **family member can answer** for a child or elderly parent ("Main unki beti hoon").
- Every patient message runs through the **safety keyword rule first**, then the LLM.
- The AI replies are run through the **output filter** before display.

### 6.2 Specialty templates (MVP: 4)

**General Medicine, Paediatrics, Gynaecology, Dermatology.** (Pilot starts with Dermatology or General Medicine.)

Templates are **data, not code**: stored as versioned JSON in the DB, edited in the Admin **Template Studio**, tested against saved cases before release. A template defines: sections, must-ask questions, optional follow-ups with conditions, specialty extras (Paeds: birth history, vaccination, growth, feeding; Gynae: LMP, cycle, obstetric history, pregnancy status; Derm: photos of the area, spread, itching, new products/soaps, family members affected), and the safety keywords specific to that specialty. A doctor can add **own must-ask questions** and choose **report style** (short bullets / detailed, English / Hinglish).

### 6.3 System prompt for the intake agent (starting point; keep in `packages/ai/prompts/intake.md`, versioned)

```
You are the Medicos pre-visit intake assistant for {{clinic_name}}, working for Dr. {{doctor_name}} ({{specialty}}).
Your only job is to collect the patient's history before the visit and to organise it for the doctor.

You MUST:
- Ask exactly one short question at a time, in {{language}} (Hindi in Devanagari, English, or Hinglish in Roman script, matching the patient).
- Be warm and respectful (use "ji", "aap"). Use simple words, no medical jargon.
- Follow the template sections in order, skipping questions already answered, and asking follow-ups only when the template allows.
- Ask for photos of medicine strips, old reports or the affected area when the template asks for them.
- If the patient asks a medical question, asks what they have, or asks what to take, reply only:
  "Yeh sawaal main doctor sahab ke liye note kar raha hoon, woh aapko sahi jawaab denge." and continue.

You MUST NEVER:
- Name, suggest or hint at any disease, condition or cause.
- Suggest any medicine, dose, test, diet, home remedy or treatment.
- Say anything is serious, not serious, urgent, or normal.
- Give reassurance about outcomes.
- Invent facts the patient did not say.

Return JSON only: {"message": string, "section": string, "done": boolean, "quick_replies": string[]}.
```

### 6.4 The Pre-Visit Summary schema (single source of truth in `packages/shared`)

```ts
const SourceRef = z.object({ messageId: z.string(), quote: z.string().max(300) });
const Line = z.object({ text: z.string().max(400), sources: z.array(SourceRef).min(1) });

export const PreVisitSummary = z.object({
  schemaVersion: z.literal(1),
  thirtySecondSummary: z.array(Line).max(5),            // key points, patient's facts only
  subjective: z.object({
    chiefComplaint: Line,                                // in patient's words
    historyOfPresentIllness: z.array(Line),              // onset, duration, severity, pattern, triggers
    pertinentNegatives: z.array(Line),                   // "no fever", "no breathlessness"
    pastHistory: z.array(Line),                          // illnesses, surgeries, hospital stays
    medications: z.array(Line),                          // as reported / from strip photo (attached)
    allergies: z.array(Line),
    familySocial: z.array(Line),                         // smoking, alcohol, family history, occupation
    specialtyExtras: z.array(Line),                      // e.g. LMP, vaccination, rash spread
    patientConcern: Line.optional(),                     // "What worries you most?"
    patientQuestions: z.array(Line),                     // questions the patient wants to ask
  }),
  objectivePatientReported: z.object({
    homeReadings: z.array(Line),                         // BP 138/88 (home, yesterday), temp, sugar, weight
    attachments: z.array(z.object({ fileId: z.string(), kind: z.enum(['report','prescription','medicine_strip','photo_of_problem','other']), date: z.string().optional(), label: z.string() })),
    examination: z.literal('To be done by doctor'),
  }),
  historyGapsForDoctor: z.array(z.string().max(200)),   // ONLY history gaps: "onset not clear", "dose of BP tablet unknown"
  safety: z.object({ safetyLineShown: z.boolean(), shownAt: z.string().optional() }),
  meta: z.object({ language: z.string(), interviewMinutes: z.number(), answeredBy: z.enum(['self','family']), templateId: z.string(), templateVersion: z.number(), model: z.string() }),
});
// NOTE: there is intentionally NO assessment, diagnosis, plan, differential or advice field.
```

Generation: one structured call on the full de-identified transcript + attachment metadata. Validate with zod; reject any line without valid sources; run the output filter; re-insert real names only at render time.

### 6.5 Two views of the same data

- **Patient view — "What you told us"**: plain language, no SOAP letters, no medical terms, editable before submit, with: "This is not a diagnosis. Your doctor will check you."
- **Doctor view — "Pre-Visit Summary"**: SOAP layout. **S** and **O** filled; **A · Assessment** and **P · Plan / Rx** are empty editors labelled "For doctor". Every line shows a small source icon; tap/hover shows the patient's original words (and plays the voice clip if it came from voice).

### 6.6 Freshness check

If the appointment is 2+ days after the interview, send "Kuch badla hai pichhle jawaabon ke baad?" 12 hours before the slot; append updates as a dated addendum.

### 6.7 AI quality harness (build in Phase 2, run in CI)

- `packages/ai/evals/cases/*.json`: at least **50 fictional transcripts** across the 4 specialties, in Hindi, English and Hinglish, including tricky ones (patient asks "mujhe kya hua hai?", mentions chest pain mid-chat, gives contradictory answers, family member answering, sends only voice notes).
- Automatic checks: schema valid; every line has a source; **zero** filter violations; no A/P content; safety line shown when and only when keywords appear; must-ask questions covered; interview length within limits.
- Report a score table; CI fails if any safety check fails. Run against the `mock` provider in CI and against the real provider on demand (`pnpm eval:live`).

---

## 7. Screen-by-screen UX

Visual references are in `docs/design/` (`medicos-patient-doctor-journey.png`, `medicos-doctor-dashboard.png`, `medicos-doctor-onboarding-profile.png`, `medicos-product-panels.png`, `what it look .pdf`). Match their layout and feel. **One deliberate difference:** the designs show A and P filled by AI — in the build, A and P stay empty for the doctor (rule 5).

### 7.1 Patient PWA (mobile first, 360px wide baseline)

1. **Welcome / Login** — logo, "Welcome to Medicos", mobile number field (+91) with **Send OTP**, "or" email OTP. 6-box OTP input with auto-read (WebOTP API) and 30s resend timer. Language picker (हिंदी / English) at top.
2. **First-time profile** — name, age (or DOB), gender, city, preferred language. One screen, big inputs.
3. **Consent** — plain Hindi/English text: what we collect, why, who sees it, how long we keep it, how to delete. Checkbox + "I agree". Stores consent version + timestamp. Without consent, the user cannot continue.
4. **Home ("Hello, Pranov")** — subtitle "Manage your health, visits and records in one place"; big green **Start AI pre-visit** button with "Tell us about your health concerns before your visit"; cards: **Upcoming appointment** (date, time, doctor, specialty, clinic, distance), **My medical records**, **My Medicos ID**; family switcher chip ("For: Me ▾"); lock note "Your data is private. Only you and the doctor you choose can see it." Menu top-left, bell top-right.
5. **Talk with AI** — choose 💬 Chat or 🎤 Voice, plus 📷 Add photo and 📄 Add report. Chat screen with the 3-step progress bar, AI bubbles left, patient bubbles right, quick-reply chips, text box, mic button, attach button. Footer: "Not a diagnosis. This collects your information for your doctor." Safety line appears as a full-width red-bordered card with **Call 112** button when triggered.
6. **What you told us** — sections in plain words, each editable ("Change"), attachments as thumbnails, **Looks right, continue** button.
7. **Choose your doctor** — filters **Specialty** and **Area** (plus fee, language, "available today"); doctor cards: photo, name, green **✔ Verified**, degrees, years of experience, rating (reviews), distance, fee, **Next available** slot; **Select Dr. X**. If the clinic sent the link, skip this step (doctor pre-set). Both orders work: doctor first → AI, or AI first → doctor.
8. **Doctor profile + slot picker** — about, degrees, registration verified, languages, clinic address with map, timings, fee; date strip + time chips; **Book appointment**.
9. **Booking confirmed** — big green tick, doctor card, date/time/clinic; green box **"Pre-visit summary attached — only shared with your chosen doctor"**; **View appointment** / **Back to home**; "Share summary with a doctor not on Medicos" (secure expiring link or PDF — growth channel).
10. **My Medicos ID** — large QR, ID in big mono text (`MED-7K4P-29XQ`), "Show this to your doctor", brightness boost, **Add to WhatsApp / Download card** (printable).
11. **Access request** (push/in-app/SMS) — "Dr. A. Mehta wants to see your records for today's visit. **Allow** / **Deny**." Shows duration (24h).
12. **Medical Record Book** — timeline sorted by date: doctor notes & prescriptions, AI pre-visit summaries, uploaded reports, old prescriptions; filters by type; open item → detail; download PDF.
13. **Reminders** — medicine reminders and follow-up date from the doctor's finalised note (patient can turn off).
14. **Settings** — family members (each with own Medicos ID and record book), language, who has access (active and past grants, revoke), download my data, delete my account/data, privacy policy, help.

### 7.2 Doctor onboarding (7 steps, progress line ending in "Profile live")

1. **Doctor login** — mobile/email + password or OTP, then TOTP 2FA setup; "Create doctor account".
2. **Create account** — full name, specialty, mobile, email, city; 4-step bar Account → Verify → Clinic → Go live.
3. **Medical licence verification** — registration number + council (NMC / State Medical Council), upload registration certificate, degree, government ID, photo. State: "Verification in progress, our team is checking your documents (within 48 hours)". Doctor cannot receive patients until verified.
4. **Clinic details** — clinic name, address with map pin, photos, weekly days (Mon–Sun) and hours, slot length (e.g. 15 min), "I work at more than one clinic" toggle.
5. **Consultation fee** — consult fee (₹800), follow-up fee (₹400), payment modes (pay at clinic, UPI). "Patients see your fee before booking."
6. **Choose plan** — Free / Pro / Clinic / Hospital cards (section 9), current usage bar, GST invoice download.
7. **Intake template & profile preview** — pick specialty template, add own questions, report style; preview public profile card. Done: **"Profile live — ready to receive pre-visit summaries"**, plus how to get the waiting-room QR standee.

### 7.3 Doctor dashboard (web, desktop first; route `/d/today`)

- **Left sidebar (dark green):** doctor photo, name, **✔ Verified Doctor**; menu: Dashboard, Today, Patients, Pre-Visit Summaries, Reports, Schedule, Insights, Plan & billing, Staff, Settings.
- **Top bar:** "Good morning, Dr. Mehta" + date; **clinic picker**; search "Search patient or Medicos ID (MED-XXXX-XXXX)"; **Scan QR** button; bell.
- **Today's queue (left card):** tabs **Today (12)** / **Upcoming (8)**; **+ Add walk-in**; rows: time, patient (initials + age/sex after access, else Medicos ID), complaint one-liner, status tag — green **Summary ready**, blue **In progress**, purple **Walk-in**, grey **Not started**; neutral marker "Safety message shown" when applicable (sorted to the top, no colour score). Keyboard: ↑/↓ to move, Enter to open.
- **Patient summary (big right card):** header (ID, arrival time, visit type: New / Follow-up), **AI pre-visit completed** tag, uploaded files as chips (open in side viewer with zoom); **30-second summary** box; **Pre-Visit Summary** with red tag **Doctor review required**: S and O filled with source icons; **A · Assessment** and **P · Plan** rich-text editors (empty, "For doctor"); **Prescription builder** (drug search from a local formulary list typed by the doctor, dose, frequency, duration, instructions; doctor-only), tests advised, follow-up date; buttons **Edit draft**, **Print**, and green **Review & finalise**. Rating widget after finalise: "Was this summary useful? 👍 / 👎 + what was wrong".
- **Bottom row (3 cards):** **Patient history** (past visits by date), **Upcoming schedule**, **This month** (summaries reviewed, minutes saved estimate, completed visits, summary quality %) + plan usage bar (e.g. 42 / 300) and **Manage plan**.
- **Other pages:** Patients (search, list, open with consent), Schedule (week calendar, block slots), Insights (charts: summaries/month, avg interview time, completion rate, minutes saved, feedback), Templates (own questions, style), Plan & billing (Razorpay, invoices), Staff (invite receptionist, roles), Settings (profile, clinics, 2FA, notifications).
- **Print layout:** clean A4 one-pager with clinic header, the AI-draft label and blank A/P lines for clinics that use paper.

### 7.4 Clinic staff

Today's queue (read-only summaries, no clinical edits), **Add patient** (mobile + slot → sends WhatsApp/SMS intake link 12–24h before, one reminder), **Add walk-in**, **Waiting-room QR** (download/print standee: "Doctor se pehle 5 minute AI se baat karein"), print summary.

### 7.5 Internal panels

- **Admin:** dashboard (interviews today, completion rate, summaries opened before visit, safety messages shown, active doctors, MRR); **Doctor verification queue** (documents side-by-side, approve/reject with reason templates, yearly re-check); **Template Studio** (edit JSON templates in a form UI, version history, run evals on saved cases before publish); **Quality review queue** (low-rated or heavily edited summaries, de-identified, reviewer tags root cause); **Safety log** (every safety-line trigger with the matched words, clinic seen/not seen); **Consent & audit log** (who opened what and when, deletion requests); **Support tickets**; **Billing** (plans, coupons, trials, failed payments).
- **Founder:** MRR, paying vs free doctors, active clinics, summaries per week, pilot retention, city progress, AI cost per summary trend.
- **Developer:** active LLM/STT provider + model per step (switch via config with audit), prompt/template versions, job queues and failures, latency, error rate, cost per summary, feature flags.

### 7.6 Empty, loading and error states

Design every screen's empty state (e.g. "No patients yet today — share your waiting-room QR"), skeleton loaders, offline banner on the PWA ("Aapke jawaab save hain, internet aate hi bhej denge"), retry on failed uploads, and friendly Hinglish error messages. Never show stack traces.

---

## 8. Design system

Calm, trustworthy, clinical-but-warm, built for Bharat: cheap Android phones, bright sunlight, slow 3G, first-time smartphone users, elderly eyes.

**Colour tokens** (CSS variables in `packages/ui`, with dark mode):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#0B6B50` | `#3FBF91` | primary buttons, links, ticks |
| `--brand-deep` | `#06402F` | `#0E2A21` | doctor sidebar |
| `--brand-soft` | `#DCEFE7` | `#173A2E` | success/ready backgrounds |
| `--accent` (saffron) | `#C9620A` | `#F0A35C` | highlights, "for doctor" labels |
| `--bg` | `#F6F8F6` | `#0F1714` | page |
| `--surface` | `#FFFFFF` | `#16211D` | cards |
| `--ink` | `#14231D` | `#E3ECE8` | text |
| `--muted` | `#556860` | `#9DB1A8` | secondary text |
| `--line` | `#D7E1DC` | `#2A3B35` | borders |
| `--danger` | `#B4322A` | `#FF8A80` | safety card, "review required" tag |
| status | ready green, in-progress blue `#2563EB`, walk-in purple `#7C3AED`, not-started grey `#6B7280` | | queue tags |

**Typography:** Inter (UI) + **Noto Sans Devanagari** (Hindi) + a display face for headings (e.g. Bricolage Grotesque) + JetBrains Mono for Medicos IDs. Patient app base size 17px, doctor app 15px. Line height 1.5+.

**Components (shadcn/ui based):** Button (primary/secondary/ghost/danger, min 48px tall on patient app), OTP input, ChatBubble (AI/patient/system/safety), QuickReplyChips, MicButton (hold to record, waveform, cancel by swipe), UploadTile, ProgressSteps, DoctorCard, SlotPicker, StatusTag, SummaryLine (with source popover), SoapSection, RxBuilder, QRCard, ConsentSheet, Timeline item, StatCard, UsageBar, EmptyState, Skeleton.

**Rules:** 8px spacing grid; radius 12px cards / 999px chips; touch targets ≥ 48×48; WCAG 2.1 AA contrast; full keyboard support and visible focus on doctor app; screen-reader labels in both languages; respect `prefers-reduced-motion`; motion is subtle (150–200ms). Icons always paired with text for low-literacy users. Numbers in tabular figures. All strings through i18n (`next-intl`), keys in `en`, `hi`, `hi-Latn` (Hinglish).

**Performance budget (patient PWA):** first load < 150 KB JS gzipped for the chat route, LCP < 2.5s on a mid-range Android over slow 4G, works offline for an in-progress interview (queue messages in IndexedDB), images compressed client-side before upload (max 1600px, ~300 KB).

---

## 9. Business model in the product

Patients pay **₹0**, always. Doctors/clinics subscribe. Prices excl. 18% GST, to be validated in the pilot, so keep them in a `plans` table, not in code.

| Plan | Price / month | Yearly | Doctors | Summaries included | Extra | Staff logins | Notes |
|---|---|---|---|---|---|---|---|
| Free | ₹0 | — | 1 | 30 | — | — | 1 template |
| Pro | ₹2,999 | ₹29,990 | 1 | 300 | ₹6 each | 1 | all templates, own questions, waiting-room QR |
| Clinic | ₹6,999 | ₹69,990 | up to 3 | 1,200 | ₹5 each | 5 | priority support |
| Hospital | contract | — | unlimited | per summary ₹8–12 | — | unlimited | integrations, manager |

Build: usage metering (a summary counts when it is delivered to the doctor), soft limit warnings at 80%/100%, Razorpay subscription webhooks, GST invoice PDF, pilot coupon (2 months free Pro), referral credit (1 month free per referred paid doctor). Phase-2 add-on "Featured profile" must always be labelled as featured.

---

## 10. Data model (Prisma; adjust names as needed, keep the shape)

- `User` (id, phone, email, role: patient | doctor | staff | admin | founder | developer, status, createdAt) — auth identity.
- `PatientProfile` (id, ownerUserId, **medicosId** unique `MED-XXXX-XXXX` (Crockford base32, no ambiguous chars, checksum char), name*, dob*, gender, city, language, isPrimary) — one user can own many (family). *encrypted fields.
- `Consent` (id, patientProfileId, type: data_processing | share_with_doctor | record_access | research_optin, version, grantedAt, revokedAt, scope, expiresAt).
- `Doctor` (id, userId, name, specialty, degrees[], registrationNo, council, yearsExperience, languages[], photoKey, verificationStatus: pending | verified | rejected | suspended, verifiedAt, recheckDue, reportStyle).
- `VerificationDocument` (id, doctorId, kind, s3Key, status, reviewerId, note).
- `Clinic` (id, name, address, geo, photos[], ownerDoctorId), `ClinicMember` (clinicId, userId, role: doctor | staff), `Schedule` (doctorId, clinicId, weekday, start, end, slotMinutes), `Fee` (doctorId, clinicId, consult, followUp, modes[]).
- `Appointment` (id, patientProfileId, doctorId, clinicId, startsAt, type: new | follow_up | walk_in, status: booked | confirmed | checked_in | completed | cancelled | no_show, source: patient_app | clinic_link | waiting_room_qr).
- `IntakeSession` (id, patientProfileId, doctorId?, appointmentId?, templateId, templateVersion, language, status: started | paused | submitted | expired, answeredBy, startedAt, submittedAt, safetyLineShown).
- `IntakeMessage` (id, sessionId, role: ai | patient | system, text*, audioKey?, transcriptConfidence?, createdAt, filtered: bool).
- `Attachment` (id, ownerPatientProfileId, sessionId?, kind, s3Key, mime, sizeBytes, sha256, takenAt?).
- `PreVisitSummary` (id, sessionId, version, json* (schema 6.4), status: draft | delivered | reviewed, deliveredAt, openedByDoctorAt).
- `DoctorNote` (id, appointmentId, summaryId?, assessment*, plan*, examination*, testsAdvised*, followUpDate, finalisedAt, finalisedBy) and `Prescription` + `PrescriptionItem` (drug, dose, frequency, duration, instructions).
- `RecordBookEntry` (id, patientProfileId, kind: doctor_note | prescription | pre_visit_summary | uploaded_report, refId, date, title) — what the patient's Medical Record Book shows.
- `AccessGrant` (id, patientProfileId, doctorId, grantedVia: share | qr_prompt | otp, scope, grantedAt, expiresAt, revokedAt).
- `Template` (id, specialty, version, json, status: draft | published, publishedBy), `DoctorTemplateOverride` (doctorId, extraQuestions json, style).
- `SummaryFeedback` (summaryId, doctorId, useful bool, issues[], comment, editDistance).
- `SafetyEvent` (id, sessionId, matchedTerms[], shownAt, clinicSeenAt).
- `FilterBlockEvent` (id, sessionId, stage: chat | summary, rule, createdAt) — no PHI text in prod.
- `AiUsage` (id, sessionId, step, provider, model, inputTokens, outputTokens, audioSeconds, costInr, latencyMs).
- `Plan`, `Subscription` (clinicId/doctorId, planId, razorpayId, status, periodEnd), `UsageCounter`, `Invoice`, `Coupon`.
- `Notification` (channel: whatsapp | sms | email | push, template, status), `ReminderSchedule`.
- `AuditLog` (id, actorUserId, actorRole, action, entity, entityId, patientProfileId?, ip, userAgent, at) — **append-only**, every read of patient data included.
- `SupportTicket`, `FeatureFlag`, `DeletionRequest`.

Indexes on all foreign keys, `medicosId`, `(doctorId, startsAt)`, `(patientProfileId, date)`. Soft-delete only where deletion requests require hard delete jobs.

---

## 11. Security, privacy and compliance (India)

Get a healthcare + AI lawyer to review before the pilot. Build these in from day one:

- **DPDP Act 2023:** explicit, granular consent (Hindi + English), purpose limitation, consent versioning, "download my data", "delete my data" (hard delete job with 30-day window, keeps only legally required billing records), breach-notification runbook in `docs/privacy.md`, grievance officer contact in the app.
- **Telemedicine Practice Guidelines 2020 / NMC:** AI never counsels or prescribes; doctor-to-patient advice only from verified doctors; reports private to the treating doctor; no advertising claims in the app.
- **CDSCO / Medical Devices Rules 2017:** stay an intake & documentation tool (no diagnosis, no triage, no AI specialty suggestion). Keep `docs/safety.md` describing intended use and the controls in section 3.
- **ICMR AI-in-health guidelines 2023:** human oversight, transparency labels, source links, safety policy page.
- **Encryption:** TLS 1.2+ everywhere, HSTS; at rest via RDS/S3 KMS; **application-level field encryption** (envelope encryption with KMS data keys; libsodium/AES-GCM) for name, DOB, message text, summary JSON, notes; blind index (HMAC) for searchable phone/email.
- **Access control:** RBAC + resource checks in one NestJS guard/policy layer (`can(user, action, resource)`), deny by default; doctors see a patient only with a valid `AccessGrant` or a shared appointment; staff see queue metadata and summaries but cannot edit clinical fields; internal reviewers see **de-identified** data only.
- **Auth hardening:** OTP 6 digits, 5-minute expiry, max 5 attempts, rate limits per phone/IP, device binding for refresh tokens, TOTP 2FA for doctor/staff/admin, session list + "log out all devices".
- **App security:** OWASP ASVS L2 mindset: input validation with zod, output encoding, CSP, CSRF protection for cookie auth, file upload checks (mime sniffing, size limits, AV scan hook), pre-signed URLs ≤ 5 min, no PHI in URLs, query strings or logs, secrets in AWS Secrets Manager (`.env` only locally, `.env.example` committed).
- **Audit:** every read/write of patient data writes `AuditLog`; patient can see who accessed their records.
- **AI vendors:** DPAs, no-training terms, de-identification before calls, India region where available.
- **Backups:** daily automated + PITR, monthly restore test documented; error monitoring and alerts.
- **Security audit** (external) before the clinic pilot; `pnpm audit`, dependency updates, secret scanning in CI.

---

## 12. Phased build plan (each phase ends with a demo and green tests)

**Phase 0 — Foundation (week 1)**
Monorepo, Docker Compose, Prisma schema v1, NestJS + Next.js skeletons, design tokens + core UI components, i18n setup, auth module (phone/email OTP with console/Mailpit adapters in dev), RBAC guard, audit log, CI pipeline, seed data.
*Done when:* `pnpm dev` runs; a patient can sign up with OTP, gets a Medicos ID + QR and a consent record; CI is green.

**Phase 1 — AI intake on web chat (weeks 2–3)**
Template engine + General Medicine and Dermatology templates, intake session API, chat UI with progress bar and quick replies, mock + Gemini/Groq (dev) + Claude Haiku 5.5 providers, safety keyword rule + safety card, output filter, pause/resume, "What you told us" review screen, file uploads (attach only).
*Done when:* 50 internal mock interviews complete; eval harness passes all safety checks.

**Phase 2 — Pre-Visit Summary + doctor view (weeks 3–4)**
Structured summary writer (schema 6.4) with source links, de-identification, doctor Today queue and summary page, A/P editors, finalise flow, Prescription builder, Medical Record Book auto-update, print/PDF, summary feedback, AI usage/cost tracking, eval harness in CI.
*Done when:* a doctor can run a full mock OPD day from queue to finalised notes, and the patient sees the records in their book.

**Phase 3 — Voice + Hindi/Hinglish polish (week 5)**
Mic recording, STT provider adapters (Groq Whisper dev, Sarvam prod), transcript confirm step, Paediatrics and Gynaecology templates, full `hi` and `hi-Latn` strings, offline queue in the PWA.
*Done when:* a voice-only Hinglish interview produces a correct summary on a low-end Android emulation profile.

**Phase 4 — Doctors, verification, booking, QR access (weeks 6–7)**
Doctor onboarding (7 steps), verification queue in Admin, clinics/schedules/fees, doctor search + profile + slot booking, both orders (doctor-first / AI-first), clinic staff role (add patient, send link, walk-in, waiting-room QR), QR scan in doctor app + patient Allow/Deny prompt + 24h access grant, family profiles, share-to-non-member link/PDF.
*Done when:* the full journey (login → AI → summary → book → clinic QR → allow → finalise → record book) passes a Playwright E2E test.

**Phase 5 — WhatsApp, notifications, billing, panels (weeks 8–9)**
WhatsApp Cloud API adapter (sandbox): intake link, reminders, summary-ready notice to doctor; SMS fallback; medicine/follow-up reminders; freshness check; Razorpay subscriptions, plans, usage metering, invoices, coupons; Insights; Admin (Template Studio, quality review, safety log, consent/audit, support); Founder and Developer panels.
*Done when:* a clinic can be onboarded, billed and monitored without touching the database.

**Phase 6 — Production hardening & pilot readiness (week 10)**
Field-level encryption review, rate limits, CSP, backup/restore drill, Terraform/CDK for AWS Mumbai, staging environment, PHI-safe logging/Sentry, load test (200 concurrent interviews), accessibility audit, security review, privacy policy/terms pages, runbooks, pilot onboarding kit (QR standee PDF, doctor quick-start).
*Done when:* staging passes the release checklist in section 13 and is ready for 10 pilot doctors.

**Later (do not build now; keep in `docs/ideas.md`):** AI reading of report photos, follow-up check-ins after the visit, more languages (Marathi, Bengali, Tamil, Telugu), IVR phone interview, ABHA/ABDM linking, EMR/HIS integrations, native apps, public listing with labelled featured profiles, video consultation, hospital per-summary contracts.

---

## 13. Quality bar and definition of done

- TypeScript strict, no `any` without a comment; ESLint + Prettier clean.
- Unit tests for business logic; API tests for every endpoint's auth rules; Playwright E2E for the golden journey on mobile (Pixel-class) and desktop viewports; eval harness for AI. Safety and privacy tests are never skipped or marked flaky.
- Every endpoint: validated input, authorisation check, audit entry for patient data, typed response, OpenAPI docs.
- Accessibility: axe checks in Playwright on key screens, zero serious violations.
- Performance budgets in section 8 met on the patient chat route.
- No PHI in logs, errors, analytics or test fixtures (add a test that scans log output for seeded patient names).
- Migrations are reversible or documented; seed works on a fresh DB.
- `README.md`: setup in < 10 commands, env vars table, how to switch AI providers, how to run evals.
- **Release checklist** (`docs/release-checklist.md`): tests green, evals green, migrations reviewed, backups verified, feature flags set, rollback plan, privacy/legal text current.

---

## 14. Metrics to instrument (privacy-safe, no PHI)

Interview completion rate (target 75%+), average interview minutes, summaries opened by doctor before the visit (85%+), summaries rated useful (90%+), doctor edits per summary (falling weekly; < 5% with serious error), estimated minutes saved per patient (2–3), AI cost per summary (≤ ₹6, target ₹1–2), safety messages shown and seen by clinic (100% seen), doctor monthly churn (< 4%), paying doctors and MRR. Show them in Insights (doctor) and Founder panel.

Pilot go/no-go: 70%+ completion, doctors open 80%+ before the consult, 85%+ rated useful with < 5% serious errors, ≥ 2 minutes saved, 6 of 10 pilot doctors willing to pay.

---

## 15. Seed data (fictional only)

- Patients: **Rahul Mehta, 28 M** (fever 2 days, max 101°F, sore throat, no cough; one old prescription photo); **Ramesh K., 46 M** (burning in chest after meals × 2 weeks, worse at night, no exertional pain, BP patient on a tablet from strip photo, smoker 10/day, lipid report Mar 2026); **Sunita, 52 F** (knee pain 3 months); a Dermatology case (itchy red rash on both forearms × 10 days, worse at night, chemist cream photo); a Paediatrics case answered by the mother.
- Doctors: **Dr. A. Mehta**, MD Dermatology, 12 yrs, ₹800, CityCare Clinic, verified; **Dr. A. Sharma**, MBBS MD General Medicine, 12 yrs, ₹400, Indore, verified; **Dr. R. Verma**, MBBS, 8 yrs, ₹300, pending verification.
- One receptionist, one admin, one founder, one developer account. Example Medicos ID format: `MED-7K4P-29XQ`.

---

## 16. Start now

1. Read `docs/design/` images.
2. Write `CLAUDE.md`, `docs/decisions.md` (log the stack above), `docs/safety.md` (intended use + golden rules) and `docs/plans/phase-0.md`.
3. Build Phase 0. When it is green, show me how to run it and the Phase 1 plan, then continue phase by phase.
