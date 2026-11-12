# Release checklist

Tick every item before a release. **Pilot blockers** must all be done before any real patient uses Medicos.

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
- [ ] Doctor/staff 2FA live (Phase 4)
- [ ] External security audit done; findings fixed
- [ ] Backup restore drill documented
