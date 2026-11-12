/** Working brand name — rename in one place. */
export const APP_NAME = 'Medicos';

/** Rule 8: label on every summary surface (screen, print, PDF, WhatsApp). */
export const AI_DRAFT_LABEL =
  'AI-generated draft. Not a diagnosis or prescription. Treating doctor must review.';

/** Shown to patients on "What you told us". */
export const PATIENT_NOT_A_DIAGNOSIS = 'This is not a diagnosis. Your doctor will check you.';

/** Current version of the data-processing consent text. Bump when the text changes. */
export const CONSENT_VERSION = '2026-11-v1';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 30;

/** Default duration of a doctor's access grant after the patient approves (rule 10). */
export const ACCESS_GRANT_HOURS = 24;

export const ROLES = ['patient', 'doctor', 'staff', 'admin', 'founder', 'developer'] as const;
export type Role = (typeof ROLES)[number];
/** Roles that must use TOTP 2FA (spec §4). */
export const ROLES_REQUIRING_2FA: readonly Role[] = ['doctor', 'staff', 'admin', 'founder', 'developer'];

export const LANGUAGES = ['en', 'hi', 'hi-Latn'] as const;
export type Language = (typeof LANGUAGES)[number];
