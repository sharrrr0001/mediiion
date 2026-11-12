# AI models — which model for which step

Confirmed by Pranov on 2026-11-12. The intake job is narrow (ask, listen, organise), so a small, fast model is enough. Free tiers for the demo, low-cost paid APIs with proper data terms for real patients, and a fully self-hosted open-source path kept as an option.

| Step | Demo / MVP (free, **test data only**) | Clinic pilot & production (paid, real patients) | Self-hosted option (open source) |
|---|---|---|---|
| Voice → text (Hindi, English, Hinglish) | Groq Whisper (free tier) or Bhashini (Govt of India) | Sarvam AI speech-to-text (Indian company, India data) | AI4Bharat IndicConformer (MIT, 22 Indian languages) or Whisper |
| Intake chat (asks the next question) | Gemini Flash (Google AI Studio free tier) or Llama on Groq | Claude Haiku 5.5 (`claude-haiku-5-5`) | Qwen 3.6 or Gemma 4 (Apache 2.0) on vLLM, India GPU |
| Pre-Visit Summary (fixed JSON, no A/P) | Same model as chat | Claude Haiku 5.5 | Same open model as chat |
| Report photos | Attach only, no AI reading | Attach only in v1; AI text-reading later after testing | Gemma 4 (multimodal) later |
| Safety line | Keyword rule in code (Hindi + English + Hinglish list). **No model.** | same | same |
| Output check | Word filter on every AI reply (medicine names, "diagnosis", "aapko ___ hai" …) before anything is shown | same | same |
| Doctor search | Normal filters (specialty, area, slot). **No AI matching** (not triage) | same | same |

## How this maps to code (`packages/ai`)
| `LLM_PROVIDER` | Use for | Notes |
|---|---|---|
| `mock` | tests, CI, offline dev | deterministic, scripted |
| `gemini` | demo (AI Studio free tier) | `GEMINI_API_KEY`, e.g. `LLM_MODEL=gemini-2.5-flash` |
| `openai-compatible` | Llama on Groq (demo) **or** self-hosted vLLM | `LLM_BASE_URL`, `LLM_API_KEY`; Groq: `https://api.groq.com/openai/v1` |
| `anthropic` | pilot & production | `ANTHROPIC_API_KEY`, `LLM_MODEL=claude-haiku-5-5` |

The API refuses to start in `production` with `mock`, `gemini` or a free-tier Groq setup unless `LLM_DATA_TERMS=no-training` is set explicitly, so real patient data can't reach a free tier by accident.

## Why not keep the free tier for real patients
- Free tiers can use inputs to improve their models — not acceptable for health data.
- Strict rate limits: fine for a demo and 5–10 test doctors only.
- No data processing agreement or India data-residency promise.

## Privacy setup for production
- Remove name, phone, email, address and Medicos ID before any AI call (`deidentify()` in `packages/ai`).
- Use only API terms that do not train on our data.
- Store data in India (AWS Mumbai); check India-region availability of each model.
- Keep the AI layer behind one interface so the provider can be swapped.
