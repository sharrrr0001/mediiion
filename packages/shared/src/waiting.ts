import { z } from 'zod';
import { WAITING_PING_COOLDOWN_SECONDS, WAITING_REPLY_MAX } from './waiting-consts';

/** A patient can send one waiting-room signal per visit every 150 seconds (server-enforced). */
export { WAITING_PING_COOLDOWN_SECONDS, WAITING_REPLY_MAX };

export const WaitingPingKind = z.enum(['arrived', 'may_i_come_in']);
export type WaitingPingKind = z.infer<typeof WaitingPingKind>;

export const SendWaitingPing = z.object({ kind: WaitingPingKind }).strict();
export type SendWaitingPing = z.infer<typeof SendWaitingPing>;

/** Doctor/staff reply. Short logistics only — never health advice. */
export const ReplyWaitingPing = z
  .object({
    response: z.enum(['come_in', 'busy', 'wait', 'custom']),
    waitMinutes: z.number().int().min(1).max(180).optional(),
    text: z.string().trim().min(1).max(WAITING_REPLY_MAX).optional(),
  })
  .strict()
  .refine((r) => r.response !== 'wait' || r.waitMinutes !== undefined, { message: 'Say how many minutes', path: ['waitMinutes'] })
  .refine((r) => r.response !== 'custom' || !!r.text, { message: 'Write a short message', path: ['text'] });
export type ReplyWaitingPing = z.infer<typeof ReplyWaitingPing>;

export interface WaitingReplyView {
  response: 'come_in' | 'busy' | 'wait' | 'custom';
  waitMinutes: number | null;
  text: string | null;
  at: string;
  by: 'doctor' | 'staff';
}

/** What the patient sees for each of today's visits. */
export interface PatientWaitingView {
  appointmentId: string;
  startsAt: string;
  doctor: string;
  clinic: string;
  profileName: string;
  arrived: boolean;
  lastPing: { kind: WaitingPingKind; at: string } | null;
  reply: WaitingReplyView | null;
  /** When the patient may send the next signal (ISO); null = now. */
  nextAllowedAt: string | null;
}

/** What doctor/staff see on the waiting-room panel (metadata only, no health data). */
export interface ClinicWaitingRow {
  pingId: string;
  appointmentId: string;
  kind: WaitingPingKind;
  at: string;
  patientLabel: string;
  medicosId: string;
  doctor: { id: string; name: string };
  appointmentTime: string;
  /** Times this patient signalled today (to spot someone waiting long). */
  signalsToday: number;
  reply: WaitingReplyView | null;
}
