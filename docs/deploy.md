# Live deployment (demo / pre-pilot)

Web on **Vercel**; API, Postgres, Redis and S3 run on this PC. The site reaches the API through a free **Cloudflare quick tunnel**, the same pattern as Replyra.

```
Browser ──> Vercel (Next.js, apps/web) ──/api/*──> https://<random>.trycloudflare.com ──> API :4100 (this PC)
                                         (vercel.json rewrite)                           └─ Postgres medicos_live, Redis, SeaweedFS
```

- Vercel project: `medicos`, team "sharrrr0001's projects", linked to github.com/sharrrr0001/mediiion, root directory `apps/web`.
- Site: https://medicos-zeta.vercel.app (also medicos-sharrrr0001s-projects.vercel.app)
- Same origin for the browser (`/api/*`), so httpOnly `SameSite=Strict` cookies work. The API refuses other origins (`WEB_ORIGINS`).

## First time

```powershell
.\scripts\setup-live.ps1     # .env.live with fresh secrets, database medicos_live, migrations, fictional seed
notepad .env.live            # add your keys (below). Never commit this file, never paste keys in chat.
.\scripts\start-all.ps1      # build + start the API on :4100, start the tunnel, push the new address
```

## Every day

| Do this | Command |
|---|---|
| Start everything (after a reboot) | `.\scripts\start-all.ps1` (add `-NoBuild` if the code has not changed) |
| Only the tunnel died | `.\scripts\start-tunnel.ps1 -Push` |
| Force a new tunnel | `.\scripts\start-tunnel.ps1 -Restart -Push` |
| Stop | `.\scripts\stop-all.ps1` (stops only Medicos's API and tunnel; Docker keeps running) |
| Logs | `%TEMP%\medicos-live\api.log`, `api.err.log`, `tunnel.log` |

A quick tunnel gets a new address each time it starts. `-Push` commits `apps/web/vercel.json` on `main` and pushes it, and Vercel redeploys in 1–2 minutes. The site only works while this PC is on.

Live and dev run side by side: dev uses ports 3001/4000 and the `medicos` database, live uses port 4100 and `medicos_live`.

## Keys in `.env.live`

**Login codes (Gmail):**
1. Turn on 2-Step Verification on the Google account.
2. Create an App Password at Google Account → Security → App passwords.
3. Set `SMTP_USER=you@gmail.com`, `SMTP_PASS=<16 characters, no spaces>`, `EMAIL_FROM=Medicos <you@gmail.com>`.

Gmail allows about 500 emails a day. Phone login stays hidden until an SMS provider (MSG91 with DLT) is added.

**AI: the server picks the provider from the key you set** (`LLM_PROVIDER=auto`):

| Key set | AI used | Mode |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Haiku 5.5 | Pilot grade: no training on inputs, no banner |
| `GEMINI_API_KEY` only | Gemini 2.5 Flash (free tier) | **Demo**: banner "use made-up details only" |
| neither | Scripted questions (no real AI) | **Demo** |

If both keys are set, Claude wins. To force one, set `LLM_PROVIDER=gemini` (or `anthropic`, `mock`).

**Voice (optional):** `SARVAM_API_KEY` (India, pilot grade) or `GROQ_API_KEY` (demo). With neither, voice answers are switched off on the live site, because mock speech-to-text would make up answers.

After changing keys, restart: `.\scripts\start-all.ps1 -NoBuild`. It prints the AI, mode, login channels and voice status it picked.

## Try the doctor dashboard live

The seed doctors have fictional phone numbers, and the live site has no SMS. Attach **your** email to the demo doctor once:

```powershell
pnpm --filter @medicos/db live:attach-email -- --phone +919000000101 --email you@example.com
```

Then go to `/d/login`, choose Email, enter the code, and enrol an authenticator app (TOTP). Use an email you have not already used to log in as a patient.

## Safety notes

- `NODE_ENV=production`: the dev OTP outbox is off (`/api/dev/outbox` returns 404), Swagger is off, cookies are `Secure`, HSTS and CSP are on, and the server refuses to start with the console email sender.
- Demo mode (Gemini or scripted) is for **fictional data only**: the banner says so on every app page. Real patients need Claude (or another no-training provider), Sarvam for voice, and India hosting (AWS Mumbai, Phase 6). See `docs/release-checklist.md`.
- `TRUST_PROXY_HOPS=2`: per-IP OTP limits use the real client IP from Vercel's `X-Forwarded-For` header, not Cloudflare's or Vercel's address.
- The tunnel exposes only the API port. Postgres, Redis and S3 stay on localhost.
