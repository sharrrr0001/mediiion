# Runbooks

Short, do-this-now guides. Commands assume the always-on server (`docs/deploy-oracle.md`); for the PC setup see `docs/deploy.md`.

## 1. Site down / API not answering
1. Check `https://<api-host>/health`. If `db: down`: `docker compose ps` → `docker compose restart postgres api`.
2. No answer at all: SSH to the server → `cd ~/medicos/deploy/server && docker compose ps` → `docker compose up -d`.
3. Check the website calls the right API: `apps/web/vercel.json` → `rewrites[0].destination`.
4. Still down: `docker compose logs --tail 200 api`. Errors carry codes only, never patient data.

## 2. Login codes not arriving
1. `docker compose logs api | grep "OTP delivery failed"`.
2. `535 Username and Password not accepted`: create a new Gmail App Password (16 letters, no spaces) → `.env` → `bash setup.sh`.
3. Gmail daily limit (about 500): wait 24 h, or move to a transactional email provider (decision needed).

## 3. Restore from backup
1. Pick a dump in `~/medicos-backups` (or a copy on your PC).
2. Test it first on the PC: copy it to `backups/` and run `.\scripts\restore-drill.ps1`. It must say **DRILL PASSED**.
3. On the server: `docker compose stop api` → `docker compose exec -T postgres pg_restore -U medicos -d medicos --clean --if-exists --no-owner < file.dump` → `docker compose start api`.
4. Restoring needs the **same** `FIELD_ENCRYPTION_KEY` / `BLIND_INDEX_KEY` that wrote the data (in `.env`). Never lose them: keep an offline copy.

## 4. Suspected data breach (DPDP Act)
Follow `docs/privacy.md` → *Breach-notification runbook*:
1. **Contain:** rotate `JWT_SECRET` (logs everyone out), revoke sessions, rotate the database password and storage keys.
2. **Assess:** use the audit log (Admin → Logs) for who accessed what and when.
3. **Notify** the Data Protection Board and affected people as the DPDP rules require; record each step.
4. Write a short post-incident review.

## 5. Safety escalation (patient wrote about an emergency)
The fixed safety line already showed the patient "Call 112". The doctor sees a neutral "Safety message shown" marker. Admin → Logs → Safety lists every trigger. Medicos staff never give medical advice. If a clinic reports a missed emergency phrase, add it to the keyword list (`packages/ai/src/safety/keywords.ts`), get a doctor's review, and release.

## 6. Rotate keys
| Key | Effect of rotating | How |
|---|---|---|
| `JWT_SECRET` | everyone logs in again | edit `.env`, re-run setup |
| SMTP / AI / Razorpay keys | none | edit, re-run setup |
| `FIELD_ENCRYPTION_KEY`, `BLIND_INDEX_KEY` | **existing data becomes unreadable** | only with a re-encryption migration (not built yet) — do not rotate casually |

## 7. Doctor verification backlog
Admin → Doctor verification. Check the registration number on the NMC / State Medical Council register before approving. Reject with a clear reason; the doctor can upload again.
