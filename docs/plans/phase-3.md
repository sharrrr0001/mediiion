# Phase 3 — Voice + Hindi/Hinglish polish

**Goal:** a patient can do the whole pre-visit by voice in Hinglish on a cheap Android phone, see what was heard before it is used, and not lose answers when the network drops.

## Tasks
1. **Templates:** Paediatrics (birth history, vaccination, growth, feeding; answered by a parent) and Gynaecology (LMP, cycle, obstetric history, pregnancy status) as validated data in EN/HI/Hinglish, plus specialty safety patterns. Seeded; selectable on the start page. Eval cases for paeds/gynae switch to them.
2. **STT providers** (`packages/ai/src/stt`): `SttProvider` with `mock` (deterministic Hinglish answers for dev/tests), `groq` (Whisper via Groq's OpenAI-compatible API, demo, fake data only) and `sarvam` (Saarika, production, India). Selected by `STT_PROVIDER`; cost per audio second tracked in `AiUsage`.
3. **Voice API:** `POST /intake/sessions/:id/voice` — audio ≤ 60 s / 2 MB, type sniffed from bytes, stored privately (S3), transcribed, returned as a *draft* (`VoiceClip`), never posted automatically. The patient confirms or edits; the confirmed text is posted as a normal message (safety rule first) linked to the clip (`audioKey`, `transcriptConfidence`).
4. **Voice UI:** hold-to-record mic (also tap-to-start/stop for accessibility and keyboard), timer + level meter, slide/cancel, "We heard: … Is this right?" card (Send / Edit / Record again). Chat-or-voice choice on the start page.
5. **Offline:** the pending answer is saved in IndexedDB and sent automatically when the connection returns (also after a reload); a minimal service worker caches the app shell and static assets (never `/api`).
6. **Tests:** STT adapters (mock + request shape), voice API (size/type limits, ownership, draft-not-posted, safety on confirmed transcript), Playwright voice-only Hinglish interview with fake microphone on a throttled low-end Android profile → summary in the doctor queue.

## Done when
A voice-only Hinglish interview completes on the low-end Android emulation profile and produces a correct summary; lint, typecheck, tests and evals are green.

## Privacy note
Voice cannot be de-identified before transcription. Production STT is Sarvam (Indian company, India data) under a DPA with no-training terms; raw audio stays in our private bucket and is never sent to the LLM — only the (de-identified) confirmed text is.
