# Always-on server for ₹0 — Oracle Cloud Always Free

Mediaura.ai's web app stays on **Vercel** (free). The backend (database, file storage, API) moves from your PC to a free **Oracle Cloud** Linux server that never sleeps. Data stays in India.

```
Browser ──> Vercel (web) ──/api──> https://<ip-with-dashes>.sslip.io  (Caddy, free HTTPS)
                                        ├── API (Docker)
                                        ├── Postgres (Docker volume)
                                        └── SeaweedFS file storage (Docker volume)
```

## 1. Create the Oracle account (you, about 15 minutes)
1. Go to **cloud.oracle.com** → *Sign up*. Choose **Home region: India South (Hyderabad)** or **India West (Mumbai)**. You can't change the home region later.
2. A card is needed to verify your identity. **Always Free** resources are never charged. Don't click "Upgrade to paid".

## 2. Create the free server
1. Console → **Compute → Instances → Create instance**.
2. **Image:** Canonical **Ubuntu 24.04**.
3. **Shape:** *Change shape* → **Ampere** → **VM.Standard.A1.Flex**, **2 OCPU, 12 GB RAM** (well within Always Free).
   - If it says "out of capacity", try again later or pick another availability domain.
   - As a fallback, **VM.Standard.E2.1.Micro** (1 GB) works for a small demo, with a 2 GB swap file.
4. **Networking:** keep the default VCN and *Assign a public IPv4 address*.
5. **SSH key:** *Generate a key pair* → download the private key (keep it safe).
6. Create. Note the **Public IP address** (e.g. `152.67.10.20`).
7. Open the web ports: Instance → *Subnet* → *Default Security List* → **Add Ingress Rules**:
   - Source `0.0.0.0/0`, TCP, destination port **80**.
   - Same again for port **443**.

## 3. Install Mediaura on it (one command)
From your PC (PowerShell), connect:
```powershell
ssh -i C:\path\to\ssh-key.key ubuntu@152.67.10.20
```
Then on the server:
```bash
curl -fsSL https://raw.githubusercontent.com/sharrrr0001/mediiion/main/deploy/server/setup.sh | bash
```
This installs Docker, opens the firewall, downloads the code and creates `deploy/server/.env` with **fresh secrets**. It then builds and starts everything, sets up a daily backup, and prints your API address, e.g. `https://152-67-10-20.sslip.io`.

Add your keys (the same values you have in `.env.live` on your PC):
```bash
nano ~/medicos/deploy/server/.env     # SMTP_USER, SMTP_PASS, EMAIL_FROM, and one AI key
bash ~/medicos/deploy/server/setup.sh        # restarts with the new settings
```

## 4. Point the website at the server (on your PC)
```powershell
.\scripts\set-api-url.ps1 -Url https://152-67-10-20.sslip.io -Push
.\scripts\stop-all.ps1        # the PC tunnel is no longer needed
```
Vercel redeploys in 1–2 minutes. Your PC can now be switched off.

## 5. Make yourself admin (on the server)
```bash
cd ~/medicos/deploy/server
docker compose exec api sh -c "cd packages/db && npx tsx prisma/make-admin.ts --email you@example.com"
```
Then sign in at `/d/login` with that email and set up an authenticator app (2FA). You land in the admin panel.

## Everyday
| Task | Command (on the server) |
|---|---|
| Update to the latest code | `bash ~/medicos/deploy/server/setup.sh` |
| See API logs | `cd ~/medicos/deploy/server && docker compose logs -f api` |
| Restart | `docker compose restart api` |
| Backups | daily at 02:30 in `~/medicos-backups` (14 kept). Copy them to your PC now and then: `scp -i key ubuntu@IP:medicos-backups/*.dump .` |
| Health | `https://<your-host>/health` |

## Notes
- The free server has **one disk**. Back up regularly (above). Keys live only in `.env`, never inside the backups.
- `sslip.io` is a free public DNS service that maps `152-67-10-20.sslip.io` to your IP, so Caddy can get a real HTTPS certificate. You can switch to your own domain later: set `SITE_HOST` in `.env` and re-run setup.
- The site is in **demo mode** until a no-training AI key (Claude) is set. Real patients also need the safety-list review and the legal review (`docs/release-checklist.md`).
