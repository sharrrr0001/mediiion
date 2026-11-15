# Security & privacy review (internal, Phase 6)

**Status:** internal engineering review, 2026-11-15. It does not replace the external audit required before real patients (`docs/release-checklist.md`).

## Threat model (what we protect, from whom)
| Asset | Threats | Main controls |
|---|---|---|
| Patient health data (messages, summaries, notes, uploads) | stolen DB/backup, insider browsing, other patients, unverified "doctors" | field-level AES-256-GCM, deny-by-default `can()`, consent grants (24–72 h), append-only audit log, 404 instead of 403 |
| Accounts | OTP brute force, session theft, CSRF | 6-digit OTP, 5 tries, 5 min expiry, per-identifier/IP/route limits; httpOnly SameSite=Strict cookies, rotating refresh with reuse detection; Origin guard; TOTP 2FA for doctor/staff/admin |
| AI pipeline | PHI sent to model, model gives medical advice | de-identification before every call; output filter + max 2 regenerations + canned fallback; keyword safety rule (never AI-written); no-training providers only for real patients |
| Payments | forged webhooks | HMAC-SHA256 over the raw body, constant-time compare |
| Share links | guessing, leakage | 24 random bytes, only an HMAC stored, 72 h, revocable, every open audited, `no-referrer` |

## Field-level encryption review
Encrypted (AES-256-GCM, per-column AAD): patient name, DOB, intake message text, voice transcripts, summaries (JSON), doctor notes (assessment, plan, examination, tests), phone and email (plus an HMAC blind index for lookup), TOTP secrets, OTP identifiers.
**Not encrypted, on purpose:** birth year, gender, city, language (needed for filters/queries, low sensitivity); prescription items (drug/dose); doctor directory data (public).
**Follow-up before the pilot:** move the field key from the env file to a KMS-wrapped data key (AWS KMS in production), and encrypt prescription items too.

## Checks done in this review
- [x] Every controller is authenticated by default (`@Public()` opt-out); public routes reviewed: health, config, auth, doctor directory, shared links, Razorpay webhook (signed).
- [x] Every patient-data read/write is audited (tests assert audit rows for access, share and finalise flows).
- [x] Rate limits: global throttler + per-route limits on OTP, verification, QR access, uploads, coupon, share links.
- [x] Security headers: strict CSP (no third-party scripts), HSTS, frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy (camera/mic self only).
- [x] Logs: pino redaction of cookies, auth headers, phone, email, OTP and names; delivery errors strip email addresses; notifications never contain health details; Caddy logs drop query strings.
- [x] Dev OTP outbox and console email refused in production by env validation.
- [x] Staff see visit metadata only; pending doctors see nothing; Template Studio blocks unsafe question text.
- [x] Backups verified by an automated restore drill (row counts per table, migrations, audit trigger).
- [x] Dependency audit runs in CI (`pnpm audit`); secret scan (gitleaks) in CI.

## Known gaps / risks (tracked in `docs/TASKS.md`)
1. CSP allows `'unsafe-inline'` scripts (Next.js bootstrap). Next step: nonce-based CSP via middleware.
2. Single-VM hosting (Oracle free): one disk, no automatic failover. Mitigation: daily backups plus off-VM copies. Production path: AWS RDS with PITR.
3. No malware scanning of uploads yet (`scanForMalware` is a stub; the MIME sniff only accepts images/PDF/audio).
4. Error monitoring is log-based (no Sentry yet). If Sentry is added, it must use `sendDefaultPii: false` and strip request bodies.
5. OTP over SMS is disabled until a DLT-registered provider is added; email OTP depends on Gmail limits (about 500 per day).
