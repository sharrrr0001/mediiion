# Privacy (DPDP Act 2023) — working notes

**Status:** engineering notes, to be reviewed by a healthcare + AI lawyer before the pilot.

## Principles in the build
- Explicit, granular, versioned consent (`Consent` table: type, version, grantedAt, revokedAt). Consent is collected **before** any profile data.
- Purpose limitation: data used only to prepare the pre-visit summary for the doctor the patient chooses.
- Minimisation: AI calls receive de-identified text only (no name, phone, email, address, Medicos ID).
- Encryption: TLS in transit; at rest via RDS/S3 KMS (prod) **and** application-level AES-256-GCM for name, DOB, message text, summaries, notes. Phone/email as HMAC blind index.
- Access: deny by default; doctor access only via patient share or QR-approved `AccessGrant` (24 h default). Every read of patient data is written to the append-only `AuditLog`.
- Residency: production data only in AWS ap-south-1 (Mumbai).
- Voice: audio cannot be de-identified, so production speech-to-text is Sarvam only (India-hosted, DPA, no training). Audio is stored privately; the LLM only ever receives the patient-confirmed, de-identified text.
- Logs: pino redaction of cookies, auth headers, phone, email, OTP, names; no PHI in logs, URLs or analytics.

## Patient rights (to build — Phase 4/5)
- Download my data (JSON + PDFs).
- Delete my account/data: `DeletionRequest` → hard-delete job after a 30-day window; only legally required billing records are kept.
- See who accessed my records (from `AuditLog` / `AccessGrant`) and revoke access.
- Grievance officer contact in the app (name/email TBD).

## Breach-notification runbook (draft)
1. Contain: revoke keys/sessions, isolate affected systems.
2. Assess: what data, how many principals, time window (use `AuditLog`).
3. Notify the Data Protection Board and affected patients without delay, as required by DPDP rules; record every step.
4. Post-incident review and fixes; update this document.
