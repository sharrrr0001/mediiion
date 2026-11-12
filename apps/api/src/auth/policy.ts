import type { Role } from '@medicos/shared';

/**
 * Single authorisation policy: `can(actor, action, resource)`. Deny by default.
 * Golden rule 10 — patient consent controls access:
 *  - a patient sees only profiles they own (self + family);
 *  - a VERIFIED doctor sees a patient only with an unexpired, unrevoked AccessGrant
 *    or a shared appointment; doctors never edit patient profiles;
 *  - staff see queue metadata via clinic membership (Phase 4), never clinical edits;
 *  - internal roles (admin/founder/developer) never see identifiable patient data here
 *    (they get de-identified views elsewhere).
 */
export interface Actor {
  userId: string;
  role: Role;
  doctor?: { id: string; verificationStatus: string } | null;
}

export interface GrantLike {
  doctorId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface PatientResource {
  kind: 'patient_profile';
  ownerUserId: string;
  grants: GrantLike[];
  /** Doctor ids with a non-cancelled appointment with this patient today/upcoming. */
  appointmentDoctorIds?: string[];
}

export type Action =
  | 'patient_profile.read'
  | 'patient_profile.update'
  | 'patient_profile.delete'
  | 'patient_record.read'
  | 'consent.manage';

const OWNER_ACTIONS: ReadonlySet<Action> = new Set([
  'patient_profile.read',
  'patient_profile.update',
  'patient_profile.delete',
  'patient_record.read',
  'consent.manage',
]);
const DOCTOR_ACTIONS: ReadonlySet<Action> = new Set(['patient_profile.read', 'patient_record.read']);

export function hasActiveGrant(grants: GrantLike[], doctorId: string, now: Date): boolean {
  return grants.some((g) => g.doctorId === doctorId && g.revokedAt === null && g.expiresAt.getTime() > now.getTime());
}

export function can(actor: Actor | null | undefined, action: Action, resource: PatientResource, now = new Date()): boolean {
  if (!actor) return false;

  switch (actor.role) {
    case 'patient':
      return resource.ownerUserId === actor.userId && OWNER_ACTIONS.has(action);

    case 'doctor': {
      if (!DOCTOR_ACTIONS.has(action)) return false;
      const doc = actor.doctor;
      if (!doc || doc.verificationStatus !== 'verified') return false;
      return (
        hasActiveGrant(resource.grants, doc.id, now) || (resource.appointmentDoctorIds ?? []).includes(doc.id)
      );
    }

    default:
      // staff, admin, founder, developer: no identifiable patient access through this path.
      return false;
  }
}
