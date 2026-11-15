# Release checklist

Tick every item before a release. **Pilot blockers** must all be done before any real patient uses Mediaura.

## Every release
- [ ] CI green: lint, typecheck, tests, build, migration drift, seed, dependency audit, secret scan
- [ ] `pnpm eval` green (all safety checks) and `pnpm eval:live` run on the target provider with no safety failures
- [ ] Migrations reviewed (reversible or documented); backup taken before applying
- [ ] Feature flags set as intended
- [ ] Rollback plan written for this release
- [ ] Privacy and legal text current (consent version bumped if the text changed)

## Pilot blockers (real patients)
- [ ] **Safety keyword list clinically reviewed by a doctor** — set `SAFETY_LIST_META.reviewStatus = 'reviewed'` and `reviewedBy` in `packages/ai/src/safety/keywords.ts` (decision by Pranov, 2026-11-12)
- [ ] Output-filter word lists (drug and condition names) reviewed with the safety list
- [ ] Safety-line wording confirmed by a lawyer (`packages/shared/src/safety-config.ts`)
- [ ] Healthcare + AI lawyer review: consent text, privacy policy, intended-use statement (`docs/safety.md`)
- [ ] LLM provider with no-training terms + DPA; zero data retention in place with the provider; `LLM_DATA_TERMS=no-training`
- [ ] Production in AWS ap-south-1; KMS field encryption replaces the env key
- [x] Doctor/staff/admin 2FA live (Phase 4)
- [ ] External security audit done; findings fixed
- [x] Backup restore drill scripted and passing (`scripts/restore-drill.ps1`; server backups daily)

## Done in Phase 6 (2026-11-15)
- [x] Strict CSP + HSTS on the web app; security headers on the API (helmet) and Caddy
- [x] Privacy policy and terms pages (drafts — lawyer review still a pilot blocker)
- [x] Load test: 200 concurrent full interviews, 0 errors (worst-case burst; see `scripts/load-test.mjs`)
- [x] Internal security review (`docs/security-review.md`), runbooks (`docs/runbooks`), doctor quick-start (`docs/pilot`)
- [x] Always-on free hosting option (`docs/deploy-oracle.md`); AWS Terraform deferred until paid hosting is approved
