import { z } from 'zod';
import { Email, IndianPhone } from './auth';

/** Doctor invites a receptionist (spec §7.4). Staff sign in at /d/login with OTP + 2FA. */
export const InviteStaff = z.union([z.object({ email: Email }).strict(), z.object({ phone: IndianPhone }).strict()]);
export type InviteStaff = z.infer<typeof InviteStaff>;

export const StaffWalkIn = z.object({ medicosId: z.string().trim().toUpperCase().max(20), doctorId: z.uuid() }).strict();
export type StaffWalkIn = z.infer<typeof StaffWalkIn>;

export interface StaffMemberView {
  userId: string;
  contact: string; // masked
  addedAt: string | null;
}

/**
 * Clinic queue for staff: who is coming and the visit status only — no complaint, no summary text
 * (staff make no clinical decisions; least privilege, docs/decisions.md).
 */
export interface ClinicQueueRow {
  appointmentId: string;
  time: string;
  medicosId: string;
  label: string;
  doctor: string;
  type: 'new' | 'follow_up' | 'walk_in';
  status: string;
  summaryReady: boolean;
}

export interface ClinicContext {
  clinic: { id: string; name: string };
  doctors: Array<{ id: string; name: string; specialty: string }>;
}
