# Medicos — Intended use and safety controls

## Intended use
Medicos is a **pre-visit history intake and documentation tool**. It collects a patient's own account of their symptoms and history before an OPD visit and organises it for the treating doctor.

It is **not** a diagnostic, triage, or treatment-recommendation tool. It does not:
- name, suggest or hint at diseases or conditions;
- suggest medicines, doses, tests, diet, remedies or treatment;
- rate urgency, triage, or choose a specialty;
- answer medical questions.

All clinical decisions are made by a verified, treating doctor. The AI output is always a **draft** until the doctor reviews and finalises it.

This positioning keeps Medicos outside the scope of a medical device under CDSCO / Medical Devices Rules 2017, consistent with the Telemedicine Practice Guidelines 2020 and ICMR's 2023 AI-in-health guidance (human oversight, transparency, source links). **To be confirmed by a healthcare + AI lawyer before the pilot.**

## Controls (spec §3) and where they live

| # | Rule | Control in code | Test |
|---|------|-----------------|------|
| 1 | Never diagnose | Intake prompt + output filter (condition-name list, "you have…", "aapko … hai", "lagta hai … hai") | `filter/output-filter.test.ts`, evals |
| 2 | Never prescribe / advise | Prompt + output filter (drug list, dosage regex, treatment verbs); fixed redirect line | `output-filter.test.ts`, evals |
| 3 | No triage | No urgency fields in schema or DB; doctor search uses filters only | schema review |
| 4 | Fixed safety line | Keyword rule (`packages/ai/src/safety`, **draft — doctor review before pilot**), text in `packages/shared/src/safety-config.ts`; `SafetyEvent` row + neutral queue marker | `safety/match.test.ts`, `intake.e2e.spec.ts`, Playwright, evals |
| 5 | Fixed schema without A/P | `PreVisitSummary` zod schema (`packages/shared`), `.strict()`; test asserts no assessment/plan/diagnosis keys | `packages/shared` tests |
| 6 | Output filter | `packages/ai/filter` on every AI message + summary; max 2 regenerations then canned question; `FilterBlockEvent` | `output-filter.test.ts`, `engine.test.ts`, evals |
| 7 | Source-linked lines | `Line.sources.min(1)`; summary writer drops lines whose `messageId` is not in the transcript | `summary.test.ts`, evals, `doctor.e2e.spec.ts` |
| 8 | Draft label | `AI_DRAFT_LABEL` constant in `packages/shared`, rendered on every surface | `doctor.spec.ts` (Playwright), record detail |
| 9 | Doctor decides | `PreVisitSummary.status` draft→delivered→reviewed; only `DoctorNote.finalisedAt` creates clinical record-book entries | `doctor.e2e.spec.ts` (record book only after finalise) |
| 10 | Consent controls access | `can()` policy (`apps/api/src/auth/policy.ts`): owner, or doctor with unexpired, unrevoked `AccessGrant`; deny by default; audit every read | `policy.spec.ts` (Phase 0) |
| 11 | No training, de-identify | De-identifier in `packages/ai` before every provider call; providers with no-training terms | `deidentify.test.ts`, `intake.e2e.spec.ts`, evals |
| 12 | Data in India | Prod infra in ap-south-1 only (Phase 6 Terraform) | infra review |

## Safety line (exact text, config-controlled)
> If you feel severely unwell, contact emergency services (112) or seek immediate in-person care. / Agar aap bahut bimaar mehsoos kar rahe hain, turant 112 par call karein ya nazdeeki hospital jaayein.

Wording to be confirmed by a lawyer. Source of truth: `packages/shared/src/safety-config.ts`.
